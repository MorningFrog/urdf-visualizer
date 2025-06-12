import * as THREE from "three";
import { CustomURDFDragControls } from "./CustomURDFDragControls";
import { DragControls } from "three/examples/jsm/controls/DragControls.js";
import { FontLoader, Font } from "three/examples/jsm/Addons";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import {
    createLabel,
    numberToString,
    getAngleBisector,
    calculateArea,
    calculateAngle,
    createCurve,
} from "./threejs_tools";

// 测量模式枚举
export enum MeasureMode {
    Coordinates = "Coordinates",
    Distance = "Distance",
    Area = "Area",
    Angle = "Angle",
}

export class Measure {
    readonly LINE_MATERIAL = new THREE.LineBasicMaterial({
        color: 0xff0000,
        linewidth: 1,
        opacity: 0.8,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false, // 禁用深度写入, 以便在测量时不受其他物体的影响
        depthTest: false, // 禁用深度测试, 确保线条始终可见
    });
    readonly POINT_MATERIAL = new THREE.PointsMaterial({
        color: 0xff5000,
        size: 10,
        opacity: 0.6,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        sizeAttenuation: false, // 禁用随距离缩放
    });
    readonly MESH_MATERIAL = new THREE.MeshBasicMaterial({
        color: 0x87cefa,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
    });

    // 配置参数
    readonly MAX_POINTS = 50; // 最大支持测量点数 TODO: better to remove this limitation
    readonly MAX_DISTANCE = 500; // 最大有效拾取距离
    readonly OBJ_NAME = "object_for_measure"; // 测量对象标识名称
    readonly LABEL_NAME = "label_for_measure"; // 标签对象标识名称

    // 状态变量
    mode: MeasureMode; // 当前测量模式
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
    controls: CustomURDFDragControls; // 自定义拖拽控制器
    dragControls?: DragControls; // 标签拖拽控制器

    // 射线检测相关
    raycaster?: THREE.Raycaster; // 用于鼠标拾取检测
    mouseMoved = false; // 标记鼠标是否移动

    // 测量完成状态
    isCompleted = false;

    // 几何对象：存储测量生成的图形
    EnsuredPoints?: THREE.Points; // 测量点集合
    EnsuredPolyline?: THREE.Line; // 测量线
    EnsuredFaces?: THREE.Mesh; // 测量面（面积测量专用）
    EnsuredCurve?: THREE.Line; // 角度测量弧线

    // 临时对象：用于鼠标移动过程中的预览
    tempPoints?: THREE.Points; // 临时点（鼠标当前位置）
    tempLine?: THREE.Line; // 临时线（最后一点到鼠标位置）
    tempLineForArea?: THREE.Line; // 面积测量专用临时线
    tempLabel?: THREE.Sprite; // 临时标签

    // 测量点管理
    pointCount = 0; // 已放置点数量
    pointArray: THREE.Vector3[] = []; // 存储所有测量点的坐标
    lastClickTime?: number; // 记录上次点击时间（用于双击检测）

    // 回调函数集合
    cancleCallback: () => void; // 取消测量回调
    startMeasureCallback: () => void; // 开始测量回调
    continueMeasureCallback: () => void; // 继续测量（添加点）回调
    completeMeasureCallback: () => void; // 完成测量回调
    closeMeasureCallback: () => void; // 关闭测量回调
    onHoverCallback: () => void; // 悬停模型回调
    onUnhoverCallback: () => void; // 离开模型回调

    constructor(
        renderer: THREE.WebGLRenderer,
        scene: THREE.Scene,
        camera: THREE.Camera,
        controls: CustomURDFDragControls,
        mode: MeasureMode = MeasureMode.Distance,
        cancleCallback = () => {},
        startMeasureCallback = () => {},
        continueMeasureCallback = () => {},
        completeMeasureCallback = () => {},
        closeMeasureCallback = () => {},
        onHoverCallback = () => {},
        onUnhoverCallback = () => {}
    ) {
        // 初始化核心参数
        this.mode = mode;
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;

        // 初始化拖拽控制
        this.initDragControls();

        // 设置回调函数
        this.cancleCallback = cancleCallback;
        this.startMeasureCallback = startMeasureCallback;
        this.continueMeasureCallback = continueMeasureCallback;
        this.completeMeasureCallback = completeMeasureCallback;
        this.closeMeasureCallback = closeMeasureCallback;
        this.onHoverCallback = onHoverCallback;
        this.onUnhoverCallback = onUnhoverCallback;
    }

    // 获取渲染器的画布元素
    get canvas(): HTMLCanvasElement {
        return this.renderer.domElement as HTMLCanvasElement;
    }

    /**
     * 启动测量流程
     * 1. 添加鼠标事件监听
     * 2. 创建初始测量对象
     * 3. 设置初始状态
     */
    open() {
        // 添加事件监听器
        this.canvas.addEventListener("mousedown", this.mousedown);
        this.canvas.addEventListener("mousemove", this.mousemove);
        this.canvas.addEventListener("mouseup", this.mouseup);
        this.canvas.addEventListener("dblclick", this.dblclick);
        window.addEventListener("keydown", this.keydown);

        // 重置状态
        this.pointArray = [];
        this.raycaster = new THREE.Raycaster();

        // 创建基础测量几何对象
        this.EnsuredPoints = this.createPoints(); // 测量点容器
        this.scene.add(this.EnsuredPoints);

        // 除了坐标测量模式，其他模式都需要创建测量线
        if (this.mode !== MeasureMode.Coordinates) {
            this.EnsuredPolyline = this.createLine(); // 测量线容器
            this.scene.add(this.EnsuredPolyline);
        }

        // 面积测量需要额外创建面
        if (this.mode === MeasureMode.Area) {
            this.EnsuredFaces = this.createFaces();
            this.scene.add(this.EnsuredFaces);
        }

        // 更新状态
        this.isCompleted = false;
        this.renderer.domElement.style.cursor = "crosshair";

        // 触发开始测量回调
        this.startMeasureCallback();
    }

    /**
     * 结束测量流程（清理资源）
     * 1. 移除所有事件监听
     * 2. 从场景中移除所有测量对象
     * 3. 重置所有状态变量
     */
    close() {
        // 移除事件监听器
        this.canvas.removeEventListener("mousedown", this.mousedown);
        this.canvas.removeEventListener("mousemove", this.mousemove);
        this.canvas.removeEventListener("mouseup", this.mouseup);
        this.canvas.removeEventListener("dblclick", this.dblclick);
        window.removeEventListener("keydown", this.keydown);

        // 从场景中移除所有对象
        this.tempPoints && this.scene.remove(this.tempPoints);
        this.tempLine && this.scene.remove(this.tempLine);
        this.tempLineForArea && this.scene.remove(this.tempLineForArea);
        this.tempLabel && this.scene.remove(this.tempLabel);
        this.EnsuredPoints && this.scene.remove(this.EnsuredPoints);
        this.EnsuredPolyline && this.scene.remove(this.EnsuredPolyline);
        this.EnsuredFaces && this.scene.remove(this.EnsuredFaces);
        this.EnsuredCurve && this.scene.remove(this.EnsuredCurve);

        // 重置状态
        this.pointArray = [];
        this.raycaster = undefined;
        this.tempPoints = undefined;
        this.tempLine = undefined;
        this.tempLineForArea = undefined;
        this.tempLabel = undefined;
        this.EnsuredPoints = undefined;
        this.EnsuredPolyline = undefined;
        this.renderer.domElement.style.cursor = ""; // 恢复默认光标
        this.clearDraggableObjects(); // 清理可拖拽对象

        // 触发关闭测量回调
        this.closeMeasureCallback();
    }

    /**
     * 创建点集合对象
     * @param pointCount 最大点数（默认MAX_POINTS）
     * @returns 配置好的Points对象
     */
    private createPoints(pointCount = this.MAX_POINTS): THREE.Points {
        const geom = new THREE.BufferGeometry();
        // 预先分配足够空间（MAX_POINTS个三维点）
        const pos = new Float32Array(this.MAX_POINTS * 3);
        geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geom.setDrawRange(0, 0); // 初始不绘制任何点
        const obj = new THREE.Points(geom, this.POINT_MATERIAL);
        obj.name = this.OBJ_NAME; // 设置标识名称
        return obj;
    }

    /**
     * 创建线对象
     * @param pointCount 最大点数（默认MAX_POINTS）
     * @returns 配置好的Line对象
     */
    private createLine(pointCount = this.MAX_POINTS): THREE.Line {
        const geom = new THREE.BufferGeometry();
        const pos = new Float32Array(pointCount * 3);
        geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const obj = new THREE.Line(geom, this.LINE_MATERIAL);
        obj.name = this.OBJ_NAME;
        return obj;
    }

    /**
     * 创建面对象（面积测量专用）
     * @returns 配置好的Mesh对象
     */
    private createFaces() {
        const geom = new THREE.BufferGeometry(); // 空几何体
        const obj = new THREE.Mesh(geom, this.MESH_MATERIAL);
        obj.name = this.OBJ_NAME;
        return obj;
    }

    /**
     * 完成测量并生成最终结果
     * @param checkAndReload 是否检查有效性并在无效时重新开始
     */
    complete(checkAndReload: boolean = false) {
        if (this.isCompleted) {
            return; // 避免重复进入
        }

        // 有效性检查标志
        let clearPoints = false;
        let clearPolyline = false;
        let reload = false;

        // 当前点数
        const count = this.pointArray.length;

        // 面积测量完成处理
        if (this.mode === MeasureMode.Area && this.EnsuredPolyline) {
            if (count > 2) {
                // 闭合多边形（连接首尾点）
                const p0 = this.pointArray[0];
                const p1 = this.pointArray[1];
                const p2 = this.pointArray[count - 1];
                const dir1 = getAngleBisector(p1, p0, p2)[1];
                const geom = this.EnsuredPolyline.geometry as any;
                const pos =
                    (geom.attributes && geom.attributes.position) || undefined;
                if (pos && count + 1 < this.MAX_POINTS) {
                    // 添加连接第一个点的线段
                    pos.setXYZ(count, p0.x, p0.y, p0.z);
                    geom.setDrawRange(0, count + 1);
                    pos.needsUpdate = true;
                }

                // 计算并添加面积标签
                const area = calculateArea(this.pointArray);
                const label = `${numberToString(area)} ${this.getUnitString()}`;
                // 计算多边形中心位置
                const position = new THREE.Vector3();
                for (let i = 0; i < count; i++) {
                    position.add(this.pointArray[i]);
                }
                position.divideScalar(count); // 求平均位置
                this.addOrUpdateLabel(this.EnsuredPolyline, label, position);
            } else {
                clearPoints = true;
                clearPolyline = true;
                checkAndReload && (reload = true);
            }
        }

        // 距离测量完成检查
        if (this.mode === MeasureMode.Distance) {
            if (count < 2) {
                clearPoints = true;
                checkAndReload && (reload = true);
            }
        }

        // 角度测量完成处理
        if (this.mode === MeasureMode.Angle && this.EnsuredPolyline) {
            if (count >= 3) {
                const p0 = this.pointArray[0];
                const p1 = this.pointArray[1];
                const p2 = this.pointArray[2];

                // 计算角度值并添加标签
                const angle = calculateAngle(p0, p1, p2);
                const label = `${numberToString(
                    angle
                )} ${this.getUnitString()}`;
                const distance = Math.min(p0.distanceTo(p1), p2.distanceTo(p1));
                const [dir0, dir1, dir2] = getAngleBisector(p0, p1, p2);
                const position = p1
                    .clone()
                    .add(dir1.multiplyScalar(distance * 0.5));
                this.addOrUpdateLabel(this.EnsuredPolyline, label, position);

                // 创建角度指示弧线
                const arcP0 = p1
                    .clone()
                    .add(dir0.multiplyScalar(distance * 0.2));
                const arcP1 = p1
                    .clone()
                    .add(dir1.multiplyScalar(distance * 0.4));
                const arcP2 = p1
                    .clone()
                    .add(dir2.multiplyScalar(distance * 0.2));

                this.EnsuredCurve = createCurve(
                    arcP0,
                    arcP1,
                    arcP2,
                    this.LINE_MATERIAL
                );
                this.EnsuredCurve.name = this.OBJ_NAME; // 设置标识名称
                this.scene.add(this.EnsuredCurve);
            } else {
                clearPoints = true;
                clearPolyline = true;
                checkAndReload && (reload = true);
            }
        }

        // 坐标测量模式不需要清理点和线
        if (this.mode === MeasureMode.Coordinates) {
            if (count < 1) {
                reload = true; // 无点时重新加载
            }
        }

        // 清理无效对象
        if (clearPoints && this.EnsuredPoints) {
            this.scene.remove(this.EnsuredPoints);
            this.EnsuredPoints = undefined;
        }
        if (clearPolyline && this.EnsuredPolyline) {
            this.scene.remove(this.EnsuredPolyline);
            this.EnsuredPolyline = undefined;
        }

        // 使标签可拖拽
        if (this.EnsuredPolyline) {
            this.EnsuredPolyline.traverse((object) => {
                if (object.name === this.LABEL_NAME) {
                    this.addDraggableObjects(object);
                }
            });
        }

        // 更新状态
        this.isCompleted = true;
        this.renderer.domElement.style.cursor = "";

        // 清理临时对象
        this.tempPoints && this.scene.remove(this.tempPoints);
        this.tempLine && this.scene.remove(this.tempLine);
        this.tempLineForArea && this.scene.remove(this.tempLineForArea);

        // 触发完成回调
        this.completeMeasureCallback();

        // 无效状态下的重新加载
        if (reload) {
            this.close();
            this.open();
        }
    }

    /**
     * 取消测量
     */
    cancel() {
        this.cancleCallback();
        this.close();
    }

    // 鼠标按下事件处理
    mousedown = (e: MouseEvent) => {
        this.mouseMoved = false;
    };

    // 鼠标移动事件处理（实时更新预览）
    mousemove = (e: MouseEvent) => {
        this.mouseMoved = true; // 标记已移动

        // 获取垂直屏幕过鼠标点的线与模型最近的交点
        const point = this.getClosestIntersection(e);

        if (!point) {
            // 清理预览对象
            this.tempPoints && this.scene.remove(this.tempPoints);
            this.tempLine && this.scene.remove(this.tempLine);
            this.tempLineForArea && this.scene.remove(this.tempLineForArea);
            this.tempLabel && this.scene.remove(this.tempLabel);
            this.tempPoints = undefined;
            this.tempLine = undefined;
            this.tempLineForArea = undefined;
            this.tempLabel = undefined;

            this.onUnhoverCallback(); // 触发离开模型回调
            return;
        }
        this.onHoverCallback(); // 触发悬停回调

        // 更新/创建临时点（鼠标位置预览）
        const points = this.tempPoints || this.createPoints(1);
        const geom = points.geometry;
        const pos = (geom.attributes && geom.attributes.position) || undefined;
        if (pos) {
            pos.setXYZ(0, point.x, point.y, point.z);
            geom.setDrawRange(0, 1);
            pos.needsUpdate = true;
        }
        // 如果临时点不存在，则添加到场景中
        if (!this.tempPoints) {
            this.scene.add(points);
            this.tempPoints = points;
        }

        if (this.mode === MeasureMode.Coordinates) {
            // 坐标测量模式, 在临时点上添加标签

            const label = `${numberToString(point.x)}, ${numberToString(
                point.y
            )}, ${numberToString(point.z)} ${this.getUnitString()}`;
            const position = new THREE.Vector3(point.x, point.y, point.z);
            this.addOrUpdateLabel(points, label, position);
        } else if (this.pointArray.length > 0) {
            // 存在已定点时创建预览线(坐标测量模式除外)

            const p0 = this.pointArray[this.pointArray.length - 1]; // 上一个点

            const line = this.tempLine || this.createLine(3);
            line.computeLineDistances(); // 线虚线材质要求执行这条命令

            const geom = line.geometry as any;
            const pos =
                (geom.attributes && geom.attributes.position) || undefined;
            if (pos) {
                pos.setXYZ(0, p0.x, p0.y, p0.z); // 设置第一个点为上一个点
                pos.setXYZ(1, point.x, point.y, point.z); // 设置第二个点为当前鼠标位置
                let range = 2; // 默认绘制范围为2
                // 如果是面积测量模式，设置第三个点为起点（闭合预览）
                if (
                    this.mode === MeasureMode.Area &&
                    this.pointArray.length > 1
                ) {
                    pos.setXYZ(
                        2,
                        this.pointArray[0].x,
                        this.pointArray[0].y,
                        this.pointArray[0].z
                    );
                    range = 3; // 绘制范围为3
                }
                geom.setDrawRange(0, range);
                pos.needsUpdate = true;
            }

            // 距离测量预览：添加距离标签
            if (this.mode === MeasureMode.Distance) {
                const dist = p0.distanceTo(point);
                const label = `${numberToString(dist)} ${this.getUnitString()}`;
                const position = new THREE.Vector3(
                    (point.x + p0.x) / 2,
                    (point.y + p0.y) / 2,
                    (point.z + p0.z) / 2
                );
                this.addOrUpdateLabel(line, label, position);
            }

            // 首次创建时添加到场景
            if (!this.tempLine) {
                this.scene.add(line);
                this.tempLine = line;
            }
        }
    };

    // 鼠标释放事件处理
    mouseup = (e: MouseEvent) => {
        // 单击而非拖动
        if (!this.mouseMoved) {
            this.onMouseClicked(e);
        }
    };

    // 双击事件处理（完成测量）
    dblclick = (e: MouseEvent) => {
        this.complete(true); // 强制检查有效性
    };

    /**
     * 鼠标点击事件核心处理
     * - 添加测量点
     * - 更新几何对象
     * - 处理特殊模式逻辑
     */
    onMouseClicked = (e: MouseEvent) => {
        if (!this.raycaster || !this.camera || !this.scene) {
            return;
        }

        // if the draw is completed, then re-open it
        if (this.isCompleted) {
            this.close();
            this.open();
            return;
        }

        // 获取垂直屏幕过鼠标点的线与模型最近的交点
        const point = this.getClosestIntersection(e);
        if (!point) {
            return;
        }

        // 双击检测：如果上次点击时间在500毫秒内，则忽略此次点击
        const now = Date.now();
        if (this.lastClickTime && now - this.lastClickTime < 500) {
            return;
        }
        this.lastClickTime = now;

        // 当前点数
        const count = this.pointArray.length;

        // 更新测量点显示
        if (this.EnsuredPoints) {
            const geom = this.EnsuredPoints.geometry;
            const pos =
                (geom.attributes && geom.attributes.position) || undefined;
            if (pos && count * 3 + 3 < this.MAX_POINTS) {
                pos.setXYZ(count, point.x, point.y, point.z);
                geom.setDrawRange(0, count + 1);
                pos.needsUpdate = true;
            }
            if (this.mode === MeasureMode.Coordinates) {
                // 坐标测量模式：添加坐标标签
                if (this.tempLabel) {
                    this.EnsuredPoints.add(this.tempLabel);
                }
            }
        }

        if (this.mode !== MeasureMode.Coordinates && this.EnsuredPolyline) {
            // 更新测量线

            const geom = this.EnsuredPolyline.geometry;
            const pos =
                (geom.attributes && geom.attributes.position) || undefined;
            if (pos && count * 3 + 3 < this.MAX_POINTS) {
                pos.setXYZ(count, point.x, point.y, point.z);
                geom.setDrawRange(0, count + 1);
                pos.needsUpdate = true;

                // 转移临时标签
                if (this.tempLabel) {
                    this.EnsuredPolyline.add(this.tempLabel);
                }
            } else {
                console.error(
                    "Failed to get attributes.position, or number of points exceeded MAX_POINTS!"
                );
            }
            this.EnsuredPolyline.computeLineDistances(); // LineDashedMaterial requires to call this
        }

        // 面积测量：更新三角面
        if (this.mode === MeasureMode.Area && this.EnsuredFaces) {
            const geom = this.EnsuredFaces.geometry;

            // 添加新顶点
            let positions = geom.getAttribute("position");
            let positionArray = positions ? Array.from(positions.array) : [];
            positionArray.push(point.x, point.y, point.z);

            // 更新顶点缓冲
            const newPositions = new Float32Array(positionArray);
            geom.setAttribute(
                "position",
                new THREE.BufferAttribute(newPositions, 3)
            );

            // 当点数≥3时创建新三角面
            const len = newPositions.length / 3;
            if (len > 2) {
                // 添加顶点索引（新顶点与首两个顶点形成面）
                let indices = geom.index ? Array.from(geom.index.array) : [];
                indices.push(0, len - 2, len - 1); // 注意：这里形成面只连接首点

                // 更新索引缓冲
                geom.setIndex(indices);
                geom.computeVertexNormals(); // 重新计算法线
            }

            geom.attributes.position.needsUpdate = true; // 标记需要更新位置属性
        }

        // 保存新点并触发回调
        this.pointArray.push(point);
        this.continueMeasureCallback();

        // 角度测量：满足三点自动完成
        if (this.mode === MeasureMode.Angle && this.pointArray.length >= 3) {
            this.complete();
        }
    };

    // 键盘事件处理
    keydown = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
            this.complete(); // 回车键完成测量
        } else if (e.key === "Escape") {
            this.cancel(); // ESC键取消测量
        }
    };

    /**
     * 获取鼠标位置在模型上的交点
     * 1. 转换鼠标位置为标准化设备坐标
     * 2. 使用Raycaster进行射线检测
     * 3. 过滤有效交点
     */
    getClosestIntersection = (e: MouseEvent) => {
        if (
            !this.raycaster ||
            !this.camera ||
            !this.scene ||
            this.isCompleted
        ) {
            return null;
        }

        // 计算鼠标标准化坐标 ( -1 到 1 )
        const x = e.clientX;
        const y = e.clientY;
        const mouse = new THREE.Vector2();
        mouse.x = (x / this.renderer.domElement.clientWidth) * 2 - 1; // must use clientWidth rather than width here!
        mouse.y = -(y / this.renderer.domElement.clientHeight) * 2 + 1;

        // 设置射线并进行相交测试
        this.raycaster.setFromCamera(mouse, this.camera);
        let intersects = this.raycaster.intersectObject(this.scene, true) || [];

        if (intersects.length > 0) {
            // 过滤掉测量对象和标签对象
            intersects = intersects.filter(
                (item) =>
                    item.object.name !== this.OBJ_NAME &&
                    item.object.name !== this.LABEL_NAME
            );
            // 返回有效交点（在距离限制内）
            if (
                intersects.length > 0 &&
                intersects[0].distance < this.MAX_DISTANCE
            ) {
                return intersects[0].point;
            }
        }
        return null;
    };

    /**
     * 添加或更新标签
     * @param obj 父对象
     * @param label 标签文本
     * @param position 标签位置
     */
    addOrUpdateLabel(
        obj: THREE.Object3D,
        label: string,
        position: THREE.Vector3
    ) {
        // 移除旧标签
        if (this.tempLabel) {
            obj.remove(this.tempLabel);
        }

        // 创建新标签
        this.tempLabel = createLabel(label, position);
        this.tempLabel.name = this.LABEL_NAME; // 设置标签名称
        obj.add(this.tempLabel);
    }

    /**
     * 获取单位字符串
     * @returns 当前模式的单位符号
     */
    getUnitString() {
        switch (this.mode) {
            case MeasureMode.Coordinates:
                return "m";
            case MeasureMode.Distance:
                return "m";
            case MeasureMode.Area:
                return "m²";
            case MeasureMode.Angle:
                return "°";
            default:
                return "";
        }
    }

    /**
     * 初始化标签拖拽控制
     */
    initDragControls() {
        const dc = new DragControls([], this.camera, this.renderer.domElement);
        // @ts-ignore
        dc.addEventListener("dragstart", (event: Event) => {
            this.controls.enabled = false;
        });
        // dragControls.addEventListener('drag', (event) => { console.log('dragging') })
        // @ts-ignore
        dc.addEventListener("dragend", (event: Event) => {
            this.controls.enabled = true;
        });
        this.dragControls = dc;
    }

    /**
     * 添加可拖拽对象到控制器
     * @param objects 需添加的对象
     */
    addDraggableObjects(objects: THREE.Object3D) {
        if (this.dragControls) {
            this.dragControls.objects.push(objects);
        }
    }

    /**
     * 清空可拖拽对象列表
     */
    clearDraggableObjects() {
        if (this.dragControls) {
            const objects = this.dragControls.objects;
            objects.splice(0, objects.length);
        }
    }
}
