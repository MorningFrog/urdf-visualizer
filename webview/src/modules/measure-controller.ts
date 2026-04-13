import { effectScope, type EffectScope, watch } from "vue";
import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { DragControls } from "three/examples/jsm/controls/DragControls.js";
import {
    measureStore,
    MeasureMode,
    MeasureStatus,
} from "@/stores/measure-store";
import { measureSettings } from "@/stores/measure-settings";
import { visualSettings } from "@/stores/visual-settings";
import { urdfStore } from "@/stores/urdf-store";
import { vscodeSettings } from "@/stores/vscode-settings";
import { CustomURDFDragControls } from "@/utils/CustomURDFDragControls";
import { isFrameHelper } from "@/utils/custom-axes";
import {
    calculateAngle,
    calculateArea,
    getLengthUnitMultiplier,
    measureNumberToString,
} from "@/utils/math-tools";
import {
    createCurve,
    createLabel,
    createLabelMaterial,
    extractAlphaFromRgbString,
} from "@/utils/threejs-tools";
import { AngleUnit, LengthUnit } from "@/utils/units";

/**
 * 在拾取阶段用于标记“这是测量覆盖层对象”的字段名。
 * 使用 userData 而不是单纯比对名称, 可以更稳定地过滤整个对象树。
 */
const MEASURE_OVERLAY_FLAG = "__isMeasureOverlay";

/** 鼠标双击判定阈值, 用于忽略 dblclick 前多余的一次 click。 */
const DOUBLE_CLICK_THRESHOLD_MS = 500;

/** 测量几何对象统一使用的名称。 */
const MEASURE_OBJECT_NAME = "measure-object";

/** 测量标签统一使用的名称。 */
const MEASURE_LABEL_NAME = "measure-label";

interface MeasureControllerOptions {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
    dragControls: CustomURDFDragControls;
    orbitControls: OrbitControls;
}

interface LabelRecord {
    /** 标签精灵对象 */
    sprite: THREE.Sprite;
    /** 在设置变化时重新生成标签文本 */
    buildText: () => string;
}

interface AngleMeasurementData {
    dir0: THREE.Vector3;
    dir1: THREE.Vector3;
    dir2: THREE.Vector3;
    label: string;
    labelPosition: THREE.Vector3;
    curveRadius: number;
    canRenderCurve: boolean;
}

/**
 * 新版 Webview 的测量控制器。
 *
 * 设计目标:
 * 1. 保留旧版 `Measure.ts` 的完整交互能力;
 * 2. 接入新版的 Vue store, 让 UI 和测量逻辑解耦;
 * 3. 对标签刷新、单位切换、资源清理等边界情况做补强。
 */
export class MeasureController {
    /** 单次测量最多允许的点数 */
    private readonly MAX_POINTS = 50;

    /** 拾取时允许的最大交点距离 */
    private readonly MAX_DISTANCE = 500;

    private readonly renderer: THREE.WebGLRenderer;
    private readonly scene: THREE.Scene;
    private readonly camera: THREE.Camera;
    private readonly dragControls: CustomURDFDragControls;
    private readonly orbitControls: OrbitControls;
    private readonly scope: EffectScope;

    /**
     * 标签拖拽控制器只负责已完成测量后的标签拖动。
     * 它与模型关节拖拽分离, 避免两套交互互相抢占。
     */
    private readonly labelDragControls: DragControls;

    /** 测量模式使用的共享材质, 会随着 store 设置自动更新。 */
    private readonly pointMaterial: THREE.PointsMaterial;
    private readonly lineMaterial: THREE.LineBasicMaterial;
    private readonly surfaceMaterial: THREE.MeshBasicMaterial;

    /** 当前正在进行的测量模式 */
    private currentMode: MeasureMode = MeasureMode.None;

    /** 当前测量是否已经完成 */
    private isCompleted = false;

    /** 鼠标按下后是否发生过移动, 用来区分 click 与 drag */
    private mouseMoved = false;

    /** 最近一次点击时间, 用于忽略双击中的第二次 click */
    private lastClickTime?: number;

    /** 已确认的测量点 */
    private pointArray: THREE.Vector3[] = [];

    /** 鼠标悬停时对应的当前交点 */
    private hoverPoint: THREE.Vector3 | null = null;

    /** 已确认的几何对象 */
    private ensuredPoints?: THREE.Points;
    private ensuredPolyline?: THREE.Line;
    private ensuredFaces?: THREE.Mesh;
    private ensuredCurve?: THREE.Line;

    /** 鼠标移动过程中的预览对象 */
    private tempPoints?: THREE.Points;
    private tempLine?: THREE.Line;
    private tempLabel?: THREE.Sprite;

    /** 已提交的标签列表, 用于完成后刷新文案与样式 */
    private committedLabels: LabelRecord[] = [];

    constructor(options: MeasureControllerOptions) {
        this.renderer = options.renderer;
        this.scene = options.scene;
        this.camera = options.camera;
        this.dragControls = options.dragControls;
        this.orbitControls = options.orbitControls;

        this.pointMaterial = new THREE.PointsMaterial({
            color: measureSettings.pointColor,
            size: measureSettings.pointSize,
            opacity: extractAlphaFromRgbString(measureSettings.pointColor) ?? 1,
            transparent: true,
            depthWrite: false,
            depthTest: false,
            sizeAttenuation: false,
        });
        this.lineMaterial = new THREE.LineBasicMaterial({
            color: measureSettings.lineColor,
            linewidth: measureSettings.lineThickness,
            opacity: extractAlphaFromRgbString(measureSettings.lineColor) ?? 1,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: false,
        });
        this.surfaceMaterial = new THREE.MeshBasicMaterial({
            color: measureSettings.surfaceColor,
            opacity:
                extractAlphaFromRgbString(measureSettings.surfaceColor) ?? 1,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: false,
        });

        this.labelDragControls = new DragControls(
            [],
            this.camera,
            this.canvas
        );
        this.labelDragControls.addEventListener("dragstart", () => {
            this.orbitControls.enabled = false;
        });
        this.labelDragControls.addEventListener("dragend", () => {
            this.orbitControls.enabled = true;
        });

        this.scope = effectScope();
        this.scope.run(() => {
            // 测量模式切换由 UI store 驱动, 控制器只负责执行具体开关逻辑。
            watch(
                () => measureStore.mode,
                (mode) => {
                    this.setMode(mode);
                },
                { immediate: true }
            );

            // 材质相关设置是共享资源, 直接增量更新即可。
            watch(
                () => measureSettings.pointColor,
                (newColor) => {
                    this.pointMaterial.color = new THREE.Color(newColor);
                    this.pointMaterial.opacity =
                        extractAlphaFromRgbString(newColor) ?? 1;
                    this.pointMaterial.needsUpdate = true;
                }
            );
            watch(
                () => measureSettings.pointSize,
                (newSize) => {
                    this.pointMaterial.size = newSize;
                    this.pointMaterial.needsUpdate = true;
                }
            );
            watch(
                () => measureSettings.lineColor,
                (newColor) => {
                    this.lineMaterial.color = new THREE.Color(newColor);
                    this.lineMaterial.opacity =
                        extractAlphaFromRgbString(newColor) ?? 1;
                    this.lineMaterial.needsUpdate = true;
                }
            );
            watch(
                () => measureSettings.lineThickness,
                (newThickness) => {
                    this.lineMaterial.linewidth = newThickness;
                    this.lineMaterial.needsUpdate = true;
                }
            );
            watch(
                () => measureSettings.surfaceColor,
                (newColor) => {
                    this.surfaceMaterial.color = new THREE.Color(newColor);
                    this.surfaceMaterial.opacity =
                        extractAlphaFromRgbString(newColor) ?? 1;
                    this.surfaceMaterial.needsUpdate = true;
                }
            );

            // 标签文本受单位、精度和样式共同影响, 统一在这里刷新。
            watch(
                () => [
                    measureSettings.precision,
                    measureSettings.useSciNotation,
                    measureSettings.labelSize,
                    measureSettings.labelColor,
                    visualSettings.lengthUnit,
                    visualSettings.angleUnit,
                ],
                () => {
                    this.refreshLabels();
                }
            );

            // 重新加载 URDF 时直接退出测量, 避免旧模型上的临时对象残留。
            watch(
                () => vscodeSettings.urdfText,
                (newUrdfText, oldUrdfText) => {
                    if (
                        oldUrdfText !== undefined &&
                        newUrdfText !== oldUrdfText
                    ) {
                        measureStore.mode = MeasureMode.None;
                        this.reset();
                    }
                }
            );
        });
    }

    /** 组件卸载时调用, 彻底释放事件、材质与拖拽控制器。 */
    dispose() {
        this.reset();
        this.scope.stop();
        this.labelDragControls.dispose();
        this.pointMaterial.dispose();
        this.lineMaterial.dispose();
        this.surfaceMaterial.dispose();
    }

    /** 统一获取渲染 canvas。 */
    private get canvas(): HTMLCanvasElement {
        return this.renderer.domElement as HTMLCanvasElement;
    }

    /**
     * 切换当前测量模式。
     * - `none`: 关闭测量
     * - 其他模式: 先清理旧状态, 再打开新模式
     */
    private setMode(mode: MeasureMode) {
        if (mode === this.currentMode) {
            return;
        }

        this.reset();

        if (mode === MeasureMode.None) {
            return;
        }

        this.open(mode);
    }

    /** 打开一次新的测量会话。 */
    private open(mode: MeasureMode) {
        this.currentMode = mode;
        this.isCompleted = false;
        this.mouseMoved = false;
        this.lastClickTime = undefined;
        this.pointArray = [];
        this.hoverPoint = null;
        this.clearHoveredModelInfo();

        this.ensureMeasurementObjects();
        this.addEventListeners();
        this.dragControls.set_enable(false);
        this.canvas.style.cursor = "crosshair";
        this.syncStatus();
    }

    /**
     * 彻底重置控制器状态。
     * 这个方法既用于关闭测量, 也用于模式切换 / URDF 重载 / 重新开始测量。
     */
    private reset() {
        this.removeEventListeners();
        this.clearPreviewObjects();
        this.clearCommittedLabels();
        this.clearGeometryObjects();
        this.clearDraggableObjects();
        this.clearHoveredModelInfo();

        this.currentMode = MeasureMode.None;
        this.isCompleted = false;
        this.mouseMoved = false;
        this.lastClickTime = undefined;
        this.pointArray = [];
        this.hoverPoint = null;

        this.dragControls.set_enable(true);
        this.orbitControls.enabled = true;
        this.canvas.style.cursor = "";
        measureStore.status = MeasureStatus.Prepare;
    }

    /** 重新开始当前模式的测量。 */
    private restartMeasurement() {
        const mode = this.currentMode;
        if (mode === MeasureMode.None) {
            return;
        }

        this.reset();
        this.open(mode);
    }

    /** 根据当前模式创建需要的基础几何对象。 */
    private ensureMeasurementObjects() {
        this.ensuredPoints = this.createPoints(this.MAX_POINTS);
        this.scene.add(this.ensuredPoints);

        if (this.currentMode !== MeasureMode.Coordinates) {
            this.ensuredPolyline = this.createLine(this.MAX_POINTS + 1);
            this.scene.add(this.ensuredPolyline);
        }

        if (this.currentMode === MeasureMode.Area) {
            this.ensuredFaces = this.createSurface();
            this.scene.add(this.ensuredFaces);
        }
    }

    /** 注册测量期间需要的鼠标与键盘事件。 */
    private addEventListeners() {
        this.canvas.addEventListener("mousedown", this.handleMouseDown);
        this.canvas.addEventListener("mousemove", this.handleMouseMove);
        this.canvas.addEventListener("mouseup", this.handleMouseUp);
        this.canvas.addEventListener("dblclick", this.handleDoubleClick);
        window.addEventListener("keydown", this.handleKeyDown);
    }

    /** 注销测量期间注册的事件。 */
    private removeEventListeners() {
        this.canvas.removeEventListener("mousedown", this.handleMouseDown);
        this.canvas.removeEventListener("mousemove", this.handleMouseMove);
        this.canvas.removeEventListener("mouseup", this.handleMouseUp);
        this.canvas.removeEventListener("dblclick", this.handleDoubleClick);
        window.removeEventListener("keydown", this.handleKeyDown);
    }

    private handleMouseDown = () => {
        this.mouseMoved = false;
    };

    /**
     * 鼠标移动时更新预览对象。
     * 预览只存在于“尚未完成”的测量过程, 完成后保留的只有最终结果。
     */
    private handleMouseMove = (event: MouseEvent) => {
        if (this.currentMode === MeasureMode.None || this.isCompleted) {
            return;
        }

        this.mouseMoved = true;
        this.clearHoveredModelInfo();

        const point = this.getClosestIntersection(event);
        this.hoverPoint = point?.clone() ?? null;

        if (!this.hoverPoint) {
            this.clearPreviewObjects();
            return;
        }

        this.ensureTempPoint(this.hoverPoint);

        if (this.currentMode === MeasureMode.Coordinates) {
            this.setPreviewLabel(
                this.tempPoints!,
                this.getCoordinateLabel(this.hoverPoint),
                this.hoverPoint
            );
            return;
        }

        if (this.pointArray.length === 0) {
            this.clearTempLine();
            this.clearTempLabel();
            return;
        }

        const previewVertices = [
            this.pointArray[this.pointArray.length - 1],
            this.hoverPoint,
        ];
        if (
            this.currentMode === MeasureMode.Area &&
            this.pointArray.length > 1
        ) {
            previewVertices.push(this.pointArray[0]);
        }
        this.ensureTempLine(previewVertices);

        if (this.currentMode === MeasureMode.Distance) {
            const start = this.pointArray[this.pointArray.length - 1];
            const middle = start.clone().add(this.hoverPoint).multiplyScalar(0.5);
            this.setPreviewLabel(
                this.tempLine!,
                this.getDistanceLabel(start, this.hoverPoint),
                middle
            );
            return;
        }

        this.clearTempLabel();
    };

    private handleMouseUp = (event: MouseEvent) => {
        if (this.currentMode === MeasureMode.None) {
            return;
        }

        if (!this.mouseMoved) {
            this.handleCanvasClick(event);
        }
    };

    /** 双击用于结束当前测量。 */
    private handleDoubleClick = () => {
        if (this.currentMode === MeasureMode.None) {
            return;
        }

        // 双击语义统一为“切换测量阶段”:
        // 进行中 -> 完成
        // 已完成 -> 重新开始当前模式
        if (this.isCompleted) {
            this.restartMeasurement();
            return;
        }

        this.complete(true);
    };

    /**
     * 键盘交互与旧版保持一致:
     * - `Enter`: 结束测量
     * - `Escape`: 取消测量并退出当前模式
     */
    private handleKeyDown = (event: KeyboardEvent) => {
        if (this.currentMode === MeasureMode.None) {
            return;
        }

        if (event.key === "Enter") {
            this.complete(false);
            return;
        }

        if (event.key === "Escape") {
            measureStore.mode = MeasureMode.None;
        }
    };

    /**
     * 处理一次有效点击:
     * 1. 完成态时不再消费单击, 鼠标语义交还给视角/标签拖拽;
     * 2. 未完成时, 将当前交点落为正式测量点并更新几何。
     */
    private handleCanvasClick(event: MouseEvent) {
        if (this.isCompleted) {
            // 完成态不再把任何单击解释为“重新开始测量”。
            // 此时鼠标语义应该统一回到“视角操作 / 标签拖拽”。
            return;
        }

        const point = this.getClosestIntersection(event);
        if (!point) {
            return;
        }

        const now = Date.now();
        if (
            this.lastClickTime !== undefined &&
            now - this.lastClickTime < DOUBLE_CLICK_THRESHOLD_MS
        ) {
            return;
        }
        this.lastClickTime = now;

        if (this.pointArray.length >= this.MAX_POINTS) {
            console.warn(
                `[measure] Maximum number of points (${this.MAX_POINTS}) reached.`
            );
            this.complete(false);
            return;
        }

        const committedPoint = point.clone();
        const previousPoint = this.pointArray[this.pointArray.length - 1];
        this.pointArray.push(committedPoint);

        this.updateEnsuredPoints();

        if (this.currentMode === MeasureMode.Coordinates) {
            this.addCommittedLabel(
                this.ensuredPoints!,
                () => this.getCoordinateLabel(committedPoint),
                committedPoint
            );
        } else {
            this.updateEnsuredPolyline(this.pointArray);
        }

        if (this.currentMode === MeasureMode.Distance && previousPoint) {
            const middle = previousPoint
                .clone()
                .add(committedPoint)
                .multiplyScalar(0.5);
            this.addCommittedLabel(
                this.ensuredPolyline!,
                () => this.getDistanceLabel(previousPoint, committedPoint),
                middle
            );
        }

        if (this.currentMode === MeasureMode.Area) {
            this.updateEnsuredFaces(this.pointArray);
        }

        this.clearPreviewObjects();
        this.syncStatus();

        if (
            this.currentMode === MeasureMode.Angle &&
            this.pointArray.length >= 3
        ) {
            this.complete(false);
        }
    }

    /**
     * 尝试完成本次测量。
     * `restartIfInvalid` 用于双击场景时的行为: 若点数不足则直接重开一轮。
     */
    private complete(restartIfInvalid: boolean) {
        if (this.isCompleted || this.currentMode === MeasureMode.None) {
            return;
        }

        const pointCount = this.pointArray.length;

        if (this.currentMode === MeasureMode.Coordinates) {
            if (pointCount < 1) {
                if (restartIfInvalid) {
                    this.restartMeasurement();
                }
                return;
            }
        }

        if (this.currentMode === MeasureMode.Distance) {
            if (pointCount < 2) {
                if (restartIfInvalid) {
                    this.restartMeasurement();
                }
                return;
            }
        }

        if (this.currentMode === MeasureMode.Area) {
            if (pointCount < 3) {
                if (restartIfInvalid) {
                    this.restartMeasurement();
                }
                return;
            }

            this.updateEnsuredPolyline([
                ...this.pointArray,
                this.pointArray[0],
            ]);
            this.updateEnsuredFaces(this.pointArray);

            const labelPosition = this.getPolygonCenter(this.pointArray);
            this.addCommittedLabel(
                this.ensuredPolyline!,
                () => this.getAreaLabel(this.pointArray),
                labelPosition
            );
        }

        if (this.currentMode === MeasureMode.Angle) {
            if (pointCount < 3) {
                if (restartIfInvalid) {
                    this.restartMeasurement();
                }
                return;
            }

            const [p0, p1, p2] = this.pointArray;
            const angleData = this.getAngleMeasurementData(p0, p1, p2);
            this.addCommittedLabel(
                this.ensuredPolyline!,
                () => this.getAngleMeasurementData(p0, p1, p2).label,
                angleData.labelPosition
            );

            if (angleData.canRenderCurve) {
                this.ensuredCurve = createCurve(
                    angleData.dir0,
                    angleData.dir2,
                    p1,
                    angleData.curveRadius,
                    this.lineMaterial
                );
                this.markAsMeasurementOverlay(this.ensuredCurve);
                this.scene.add(this.ensuredCurve);
            }
        }

        this.isCompleted = true;
        this.canvas.style.cursor = "";
        this.clearPreviewObjects();
        this.registerCommittedLabelsAsDraggable();
        this.syncStatus();
    }

    /**
     * 重新生成所有标签的内容和样式。
     * 这里不会重置用户手动拖拽过的标签位置, 只更新文本与外观。
     */
    private refreshLabels() {
        this.committedLabels.forEach(({ sprite, buildText }) => {
            this.updateSpriteLabel(sprite, buildText());
        });

        if (this.hoverPoint && !this.isCompleted) {
            this.refreshPreviewLabelOnly();
        }
    }

    /**
     * `refreshLabels` 中只需要刷新当前临时标签的内容, 不需要再做一次射线检测。
     * 因此把“重新绘制 preview 标签”单独抽出来。
     */
    private refreshPreviewLabelOnly() {
        if (!this.hoverPoint || !this.tempLabel) {
            return;
        }

        if (this.currentMode === MeasureMode.Coordinates && this.tempPoints) {
            this.setPreviewLabel(
                this.tempPoints,
                this.getCoordinateLabel(this.hoverPoint),
                this.hoverPoint
            );
            return;
        }

        if (
            this.currentMode === MeasureMode.Distance &&
            this.tempLine &&
            this.pointArray.length > 0
        ) {
            const start = this.pointArray[this.pointArray.length - 1];
            const middle = start.clone().add(this.hoverPoint).multiplyScalar(0.5);
            this.setPreviewLabel(
                this.tempLine,
                this.getDistanceLabel(start, this.hoverPoint),
                middle
            );
        }
    }

    /** 根据当前点列表同步点对象显示。 */
    private updateEnsuredPoints() {
        if (!this.ensuredPoints) {
            return;
        }

        this.updateVertexBuffer(this.ensuredPoints, this.pointArray);
    }

    /** 根据当前点列表同步折线显示。 */
    private updateEnsuredPolyline(vertices: THREE.Vector3[]) {
        if (!this.ensuredPolyline) {
            return;
        }

        this.updateVertexBuffer(this.ensuredPolyline, vertices);
    }

    /**
     * 面积测量使用简单扇形三角剖分。
     * 这和旧版实现一致, 适合常见的凸多边形测量场景。
     */
    private updateEnsuredFaces(vertices: THREE.Vector3[]) {
        if (!this.ensuredFaces) {
            return;
        }

        const geometry = this.ensuredFaces.geometry as THREE.BufferGeometry;

        if (vertices.length < 3) {
            geometry.setAttribute(
                "position",
                new THREE.BufferAttribute(new Float32Array(0), 3)
            );
            geometry.setIndex([]);
            return;
        }

        const positionArray = new Float32Array(vertices.length * 3);
        vertices.forEach((point, index) => {
            positionArray[index * 3] = point.x;
            positionArray[index * 3 + 1] = point.y;
            positionArray[index * 3 + 2] = point.z;
        });

        const indices: number[] = [];
        for (let i = 2; i < vertices.length; i++) {
            indices.push(0, i - 1, i);
        }

        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(positionArray, 3)
        );
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
    }

    /** 创建正式标签并记录文本生成器, 便于后续响应设置变化。 */
    private addCommittedLabel(
        parent: THREE.Object3D,
        buildText: () => string,
        position: THREE.Vector3
    ) {
        const sprite = createLabel(
            buildText(),
            position,
            measureSettings.labelSize,
            measureSettings.labelColor
        );
        sprite.name = MEASURE_LABEL_NAME;
        this.markAsMeasurementOverlay(sprite);
        parent.add(sprite);
        this.committedLabels.push({ sprite, buildText });
    }

    /** 更新或创建临时标签。 */
    private setPreviewLabel(
        parent: THREE.Object3D,
        label: string,
        position: THREE.Vector3
    ) {
        if (!this.tempLabel) {
            this.tempLabel = createLabel(
                label,
                position,
                measureSettings.labelSize,
                measureSettings.labelColor
            );
            this.tempLabel.name = MEASURE_LABEL_NAME;
            this.markAsMeasurementOverlay(this.tempLabel);
            parent.add(this.tempLabel);
            return;
        }

        if (this.tempLabel.parent !== parent) {
            this.tempLabel.parent?.remove(this.tempLabel);
            parent.add(this.tempLabel);
        }

        this.updateSpriteLabel(this.tempLabel, label, position);
    }

    /**
     * 更新标签材质与尺寸。
     * 这里会替换整张文字纹理, 以保证标签内容、大小、颜色都能立即同步。
     */
    private updateSpriteLabel(
        sprite: THREE.Sprite,
        label: string,
        position?: THREE.Vector3
    ) {
        const oldMaterial = sprite.material as THREE.SpriteMaterial;
        const oldTexture = oldMaterial.map ?? null;
        const { material, objScale, width, height } = createLabelMaterial(
            label,
            measureSettings.labelSize,
            measureSettings.labelColor
        );

        sprite.material = material;
        oldTexture?.dispose();
        oldMaterial.dispose();

        const aspectRatio = width / height;
        const baseHeight = 0.15;
        const baseWidth = baseHeight * aspectRatio;
        sprite.scale.set(baseWidth * objScale, baseHeight * objScale, 1);
        if (position) {
            sprite.position.copy(position);
        }
        sprite.renderOrder = 999;
    }

    /** 为当前鼠标交点创建/更新一个临时点。 */
    private ensureTempPoint(position: THREE.Vector3) {
        if (!this.tempPoints) {
            this.tempPoints = this.createPoints(1);
            this.scene.add(this.tempPoints);
        }

        this.updateVertexBuffer(this.tempPoints, [position]);
    }

    /** 为当前鼠标交点创建/更新预览折线。 */
    private ensureTempLine(vertices: THREE.Vector3[]) {
        if (!this.tempLine) {
            this.tempLine = this.createLine(3);
            this.scene.add(this.tempLine);
        }

        this.updateVertexBuffer(this.tempLine, vertices);
    }

    /** 清理全部预览对象。 */
    private clearPreviewObjects() {
        this.clearTempLabel();
        this.clearTempLine();
        this.clearTempPoint();
        this.hoverPoint = null;
    }

    private clearTempPoint() {
        if (!this.tempPoints) {
            return;
        }

        this.tempPoints.parent?.remove(this.tempPoints);
        this.tempPoints.geometry.dispose();
        this.tempPoints = undefined;
    }

    private clearTempLine() {
        if (!this.tempLine) {
            return;
        }

        this.tempLine.parent?.remove(this.tempLine);
        this.tempLine.geometry.dispose();
        this.tempLine = undefined;
    }

    private clearTempLabel() {
        if (!this.tempLabel) {
            return;
        }

        this.disposeSprite(this.tempLabel);
        this.tempLabel = undefined;
    }

    /** 清除已提交标签。 */
    private clearCommittedLabels() {
        this.committedLabels.forEach(({ sprite }) => {
            this.disposeSprite(sprite);
        });
        this.committedLabels = [];
    }

    /** 清除正式几何对象。 */
    private clearGeometryObjects() {
        this.disposeGeometryObject(this.ensuredPoints);
        this.disposeGeometryObject(this.ensuredPolyline);
        this.disposeGeometryObject(this.ensuredFaces);
        this.disposeGeometryObject(this.ensuredCurve);

        this.ensuredPoints = undefined;
        this.ensuredPolyline = undefined;
        this.ensuredFaces = undefined;
        this.ensuredCurve = undefined;
    }

    /** 为完成后的标签启用拖拽。 */
    private registerCommittedLabelsAsDraggable() {
        this.clearDraggableObjects();

        if (this.currentMode === MeasureMode.Coordinates) {
            return;
        }

        this.committedLabels.forEach(({ sprite }) => {
            this.labelDragControls.objects.push(sprite);
        });
    }

    /** 清空标签拖拽对象列表。 */
    private clearDraggableObjects() {
        this.labelDragControls.objects.splice(
            0,
            this.labelDragControls.objects.length
        );
    }

    /** 用共享材质创建点对象。 */
    private createPoints(capacity: number): THREE.Points {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(new Float32Array(capacity * 3), 3)
        );
        geometry.setDrawRange(0, 0);

        const points = new THREE.Points(geometry, this.pointMaterial);
        points.name = MEASURE_OBJECT_NAME;
        this.markAsMeasurementOverlay(points);
        return points;
    }

    /** 用共享材质创建线对象。 */
    private createLine(capacity: number): THREE.Line {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(new Float32Array(capacity * 3), 3)
        );
        geometry.setDrawRange(0, 0);

        const line = new THREE.Line(geometry, this.lineMaterial);
        line.name = MEASURE_OBJECT_NAME;
        this.markAsMeasurementOverlay(line);
        return line;
    }

    /** 用共享材质创建面对象。 */
    private createSurface(): THREE.Mesh {
        const mesh = new THREE.Mesh(
            new THREE.BufferGeometry(),
            this.surfaceMaterial
        );
        mesh.name = MEASURE_OBJECT_NAME;
        this.markAsMeasurementOverlay(mesh);
        return mesh;
    }

    /**
     * 用给定顶点序列刷新 Points / Line 的几何缓冲。
     * 这里使用预分配 BufferAttribute, 避免鼠标移动时频繁 new 几何体。
     */
    private updateVertexBuffer(
        object: THREE.Points | THREE.Line,
        vertices: THREE.Vector3[]
    ) {
        const geometry = object.geometry as THREE.BufferGeometry;
        const position = geometry.getAttribute(
            "position"
        ) as THREE.BufferAttribute;

        if (position.count < vertices.length) {
            console.error(
                `[measure] Geometry capacity (${position.count}) is smaller than required vertex count (${vertices.length}).`
            );
            return;
        }

        vertices.forEach((point, index) => {
            position.setXYZ(index, point.x, point.y, point.z);
        });
        position.needsUpdate = true;
        geometry.setDrawRange(0, vertices.length);
        geometry.computeBoundingSphere();
    }

    /**
     * 获取距离鼠标最近的有效模型交点。
     * 这里修复了旧版直接使用 `clientWidth/clientHeight` 的问题:
     * 现在会正确扣除 canvas 在页面中的偏移量。
     */
    private getClosestIntersection(event: MouseEvent): THREE.Vector3 | null {
        if (this.isCompleted || !urdfStore.robot) {
            return null;
        }

        const rect = this.canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return null;
        }

        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        const intersections = raycaster.intersectObject(urdfStore.robot, true);
        const hit = intersections.find(
            (item) =>
                item.distance < this.MAX_DISTANCE &&
                this.isValidIntersectionObject(item.object)
        );

        return hit?.point ?? null;
    }

    /** 只允许命中真正的模型对象, 过滤掉 helper / 标签 / 测量覆盖层。 */
    private isValidIntersectionObject(object: THREE.Object3D): boolean {
        return (
            this.isObjectHierarchyVisible(object) &&
            !isFrameHelper(object) &&
            !this.isMeasurementOverlay(object)
        );
    }

    /** 任意祖先被隐藏时, 当前对象都不应参与测量拾取。 */
    private isObjectHierarchyVisible(object: THREE.Object3D): boolean {
        let current: THREE.Object3D | null = object;
        while (current) {
            if (!current.visible) {
                return false;
            }
            current = current.parent;
        }
        return true;
    }

    /** 判断一个对象是否属于测量覆盖层。 */
    private isMeasurementOverlay(object: THREE.Object3D | null): boolean {
        let current: THREE.Object3D | null = object;
        while (current) {
            if ((current.userData as Record<string, unknown>)[MEASURE_OVERLAY_FLAG]) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    /** 给对象及其子树打上“测量覆盖层”标记。 */
    private markAsMeasurementOverlay(object: THREE.Object3D) {
        object.userData[MEASURE_OVERLAY_FLAG] = true;
        object.traverse((child) => {
            child.userData[MEASURE_OVERLAY_FLAG] = true;
        });
    }

    /** 坐标标签文本。 */
    private getCoordinateLabel(point: THREE.Vector3): string {
        const multiplier = getLengthUnitMultiplier();
        return `${measureNumberToString(
            point.x * multiplier
        )}, ${measureNumberToString(
            point.y * multiplier
        )}, ${measureNumberToString(point.z * multiplier)} ${this.getLengthUnitString()}`;
    }

    /** 距离标签文本。 */
    private getDistanceLabel(start: THREE.Vector3, end: THREE.Vector3): string {
        const distance = start.distanceTo(end) * getLengthUnitMultiplier();
        return `${measureNumberToString(distance)} ${this.getLengthUnitString()}`;
    }

    /** 面积标签文本。 */
    private getAreaLabel(points: THREE.Vector3[]): string {
        return `${measureNumberToString(calculateArea(points))} ${this.getLengthUnitString(
            true
        )}`;
    }

    /** 角度测量的几何与标签信息。 */
    private getAngleMeasurementData(
        p0: THREE.Vector3,
        p1: THREE.Vector3,
        p2: THREE.Vector3
    ): AngleMeasurementData {
        const dir0 = p0.clone().sub(p1).normalize();
        const dir2 = p2.clone().sub(p1).normalize();
        const dir1 = dir0.clone().add(dir2);

        // 180° 时角平分线不存在唯一解, 这里退化为取与边垂直的稳定方向。
        if (dir1.lengthSq() < 1e-8) {
            dir1.crossVectors(dir0, new THREE.Vector3(0, 0, 1));
            if (dir1.lengthSq() < 1e-8) {
                dir1.crossVectors(dir0, new THREE.Vector3(0, 1, 0));
            }
        }
        dir1.normalize();

        const angle = calculateAngle(dir0, dir2);
        const label = `${measureNumberToString(angle)} ${this.getAngleUnitString()}`;
        const distance = Math.min(p0.distanceTo(p1), p2.distanceTo(p1));
        const labelPosition = p1
            .clone()
            .add(dir1.clone().multiplyScalar(distance * 0.35));
        const cross = new THREE.Vector3().crossVectors(dir0, dir2);

        return {
            dir0,
            dir1,
            dir2,
            label,
            labelPosition,
            curveRadius: distance * 0.2,
            canRenderCurve: cross.lengthSq() > 1e-8,
        };
    }

    /** 计算面积标签使用的简单中心点。 */
    private getPolygonCenter(points: THREE.Vector3[]): THREE.Vector3 {
        const center = new THREE.Vector3();
        points.forEach((point) => {
            center.add(point);
        });
        center.divideScalar(points.length);
        return center;
    }

    /** 获取当前长度单位字符串。 */
    private getLengthUnitString(square = false): string {
        switch (visualSettings.lengthUnit) {
            case LengthUnit.Meters:
                return square ? "m^2" : "m";
            case LengthUnit.Centimeters:
                return square ? "cm^2" : "cm";
            case LengthUnit.Millimeters:
                return square ? "mm^2" : "mm";
            default:
                return "";
        }
    }

    /** 获取当前角度单位字符串。 */
    private getAngleUnitString(): string {
        switch (visualSettings.angleUnit) {
            case AngleUnit.Degrees:
                return "°";
            case AngleUnit.Radians:
                return "rad";
            default:
                return "";
        }
    }

    /** 清空模型悬停信息, 避免测量模式下残留旧的 hover 信息面板。 */
    private clearHoveredModelInfo() {
        urdfStore.hoveredJointName = null;
        urdfStore.hoveredLinkName = null;
        urdfStore.isHoveredLinkVisual = false;
        urdfStore.isHoveredOnModel = false;
    }

    /** 根据当前状态同步 measureStore.status。 */
    private syncStatus() {
        if (this.isCompleted) {
            measureStore.status = MeasureStatus.Complete;
            return;
        }

        if (this.pointArray.length === 0) {
            measureStore.status = MeasureStatus.Prepare;
            return;
        }

        if (this.pointArray.length === 1) {
            measureStore.status = MeasureStatus.FirstPoint;
            return;
        }

        measureStore.status = MeasureStatus.MorePoint;
    }

    /** 释放几何对象本身, 但不释放共享材质。 */
    private disposeGeometryObject(
        object?: THREE.Points | THREE.Line | THREE.Mesh
    ) {
        if (!object) {
            return;
        }

        object.parent?.remove(object);
        object.geometry.dispose();
    }

    /** 释放标签精灵及其纹理资源。 */
    private disposeSprite(sprite: THREE.Sprite) {
        const material = sprite.material as THREE.SpriteMaterial;
        material.map?.dispose();
        material.dispose();
        sprite.parent?.remove(sprite);
    }
}
