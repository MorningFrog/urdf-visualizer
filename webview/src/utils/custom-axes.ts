import * as THREE from "three";

/**
 * 自定义的 LineMaterial 类型(包含 linewidth 等属性)
 */
type LineMaterialLike = THREE.Material & {
    linewidth?: number;
    depthTest?: boolean;
    needsUpdate?: boolean;
};

/**
 * 遍历 Line 的材质, 支持多材质情况
 * @param line  三维线对象
 * @param fn  对每个材质执行的函数
 */
function forEachLineMaterial(
    line: THREE.Line,
    fn: (m: LineMaterialLike) => void
): void {
    const m = line.material as unknown;
    if (Array.isArray(m)) m.forEach((mm) => fn(mm as LineMaterialLike));
    else fn(m as LineMaterialLike);
}

/** 设置线材质的属性
 * @param line 三维线对象
 * @param props 要设置的属性
 */
function setLineMaterialProps(
    line: THREE.Line,
    props: Partial<
        Pick<LineMaterialLike, "linewidth" | "depthTest" | "needsUpdate">
    >
): void {
    forEachLineMaterial(line, (m) => Object.assign(m, props));
}

/** 用于在 userData 上标记"这是 frame helper(不参与包围盒)" */
export const FRAME_HELPER_FLAG = "__isFrameHelper" as const;

export type FrameHelperUserData = {
    [FRAME_HELPER_FLAG]?: true;
};

/**
 * 将某个 Object3D 及其子树都标记为 frame helper
 * - 这样外部在计算 Box3 时可直接跳过
 */
export function markAsFrameHelper(root: THREE.Object3D): void {
    (root.userData as FrameHelperUserData)[FRAME_HELPER_FLAG] = true;
    root.traverse((o) => {
        (o.userData as FrameHelperUserData)[FRAME_HELPER_FLAG] = true;
    });
}

/** 判断一个 Object3D 是否被标记为 frame helper */
export function isFrameHelper(o: THREE.Object3D): boolean {
    return Boolean((o.userData as FrameHelperUserData)?.[FRAME_HELPER_FLAG]);
}

// 复用的 unit 轴 geometry（多个 helper 共享，减少分配）
const UNIT_X = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
]);
const UNIT_Y = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 1, 0),
]);
const UNIT_Z = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 1),
]);

const AXIS_COLORS = {
    x: 0xff0000,
    y: 0x00ff00,
    z: 0x0000ff,
} as const;

const DEFAULT_DASH_SIZE = 0.02;
const DEFAULT_GAP_SIZE = 0.02;
const DEFAULT_LINEWIDTH = 1;
const DEFAULT_HOVERED_LINEWIDTH = 2;

function createAxisLine(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    colorHex: number,
    dashed: boolean
): THREE.Line {
    const line = new THREE.Line(geometry, material);

    // 设置颜色（运行期 Line*Material 一定有 color）
    forEachLineMaterial(line, (m) => {
        (m as unknown as { color?: THREE.Color }).color?.setHex(colorHex);
    });

    // 虚线必须计算 lineDistance
    if (dashed) line.computeLineDistances();

    return line;
}

type XYZStyle =
    | { kind: "dashed"; dashSize: number; gapSize: number }
    | { kind: "basic" };

function createXYZAxes(
    style: XYZStyle,
    linewidth: number
): { x: THREE.Line; y: THREE.Line; z: THREE.Line } {
    const dashed = style.kind === "dashed";
    const base =
        style.kind === "dashed"
            ? new THREE.LineDashedMaterial({
                  color: 0xffffff,
                  dashSize: style.dashSize,
                  gapSize: style.gapSize,
                  linewidth,
              })
            : new THREE.LineBasicMaterial({ color: 0xffffff, linewidth });

    const x = createAxisLine(UNIT_X, base.clone(), AXIS_COLORS.x, dashed);
    const y = createAxisLine(UNIT_Y, base.clone(), AXIS_COLORS.y, dashed);
    const z = createAxisLine(UNIT_Z, base.clone(), AXIS_COLORS.z, dashed);

    return { x, y, z };
}

abstract class BaseAxesHelper extends THREE.Group {
    /** 全局尺寸缩放 */
    public globalScale: number;
    /** 本地尺寸值 */
    public localSize: number;

    /** 是否被悬停 */
    protected _isHovered = false;
    /** 是否被强制置于最上层 */
    protected _isForceTop = false;

    protected readonly linewidth: number;
    protected readonly hoveredLinewidth: number;

    // 子类需要赋值
    public xAxis!: THREE.Line;
    public yAxis!: THREE.Line;
    public zAxis!: THREE.Line;

    /** 统一收口 setLayer / setHovered / needsUpdate 的目标对象 */
    protected lines: THREE.Line[] = [];

    protected constructor(
        size: number = 1,
        scale: number = 1.0,
        opts?: { linewidth?: number; hoveredLinewidth?: number }
    ) {
        super();

        this.linewidth = opts?.linewidth ?? DEFAULT_LINEWIDTH;
        this.hoveredLinewidth =
            opts?.hoveredLinewidth ?? DEFAULT_HOVERED_LINEWIDTH;

        this.globalScale = scale;
        this.localSize = size;

        // 仅影响 Group.scale，不依赖 lines 是否已创建
        this.setSize(size);

        // 标记为 frame helper（用于外部计算 bounds 时跳过）
        markAsFrameHelper(this);
    }

    protected registerLines(lines: THREE.Line[]): void {
        this.lines = lines;
    }

    /**
     * 设置渲染层(layers.set)
     * @param layer 目标层(0-31)
     */
    public setLayer(layer: number): void {
        this.layers.set(layer);
        this.lines.forEach((l) => l.layers.set(layer));
    }

    /**
     * 设置线长（通过缩放整个 helper）
     * @param size 新的轴线长度
     */
    public setSize(size: number): void {
        this.localSize = size;
        const s = size * this.globalScale;
        this.scale.set(s, s, s);
    }

    /**
     * 设置全局缩放
     * @param scale 新的全局缩放值
     */
    public setGlobalScale(scale: number): void {
        this.globalScale = scale;
        this.setSize(this.localSize);
    }

    /**
     * 鼠标悬停时高亮显示
     * @param hovered 是否悬停
     * @param forceTop 是否强制置于最上层
     */
    public setHovered(hovered: boolean, forceTop: boolean = false): void {
        if (this._isHovered === hovered && this._isForceTop === forceTop) {
            return;
        }

        this._isHovered = hovered;
        this._isForceTop = forceTop;

        const linewidth = hovered ? this.hoveredLinewidth : this.linewidth;
        const depthTest = !(hovered && forceTop);

        this.lines.forEach((l) => {
            setLineMaterialProps(l, {
                linewidth,
                depthTest,
                needsUpdate: true,
            });
        });
    }

    get isHovered(): boolean {
        return this._isHovered;
    }
    get isForceTop(): boolean {
        return this._isForceTop;
    }
}

/**
 * Link 的坐标系辅助器（XYZ 均为虚线）
 */
export class LinkAxesHelper extends BaseAxesHelper {
    /**
     * 创建一个虚线坐标系辅助器
     * @param size 轴线长度
     */
    constructor(size: number = 1, scale: number = 1.0) {
        super(size, scale);

        const { x, y, z } = createXYZAxes(
            {
                kind: "dashed",
                dashSize: DEFAULT_DASH_SIZE,
                gapSize: DEFAULT_GAP_SIZE,
            },
            this.linewidth
        );

        this.xAxis = x;
        this.yAxis = y;
        this.zAxis = z;

        this.add(x, y, z);
        this.registerLines([x, y, z]);
    }
}

/**
 * Joint 的坐标系辅助器（XYZ 为实线，jointAxis 为虚线）
 */
export class JointAxesHelper extends BaseAxesHelper {
    /** 关节轴对象 */
    public jointAxis: THREE.Line;

    /**
     * 创建一个 Joint 坐标系辅助器
     * @param size 轴线长度
     * @param axis 关节轴线方向(默认沿Z轴)
     */
    constructor(
        size: number = 1,
        scale: number = 1.0,
        axis: THREE.Vector3 = new THREE.Vector3(0, 0, 1)
    ) {
        super(size, scale);

        const { x, y, z } = createXYZAxes({ kind: "basic" }, this.linewidth);

        this.xAxis = x;
        this.yAxis = y;
        this.zAxis = z;
        this.add(x, y, z);

        // 关节轴(虚线)
        const axisMaterial = new THREE.LineDashedMaterial({
            color: 0x000000,
            dashSize: DEFAULT_DASH_SIZE,
            gapSize: DEFAULT_GAP_SIZE,
            linewidth: this.linewidth,
        });

        const normalizedAxis = axis.clone().normalize();
        const jointGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            normalizedAxis,
        ]);
        this.jointAxis = new THREE.Line(jointGeometry, axisMaterial);
        this.jointAxis.computeLineDistances();
        this.add(this.jointAxis);

        this.registerLines([x, y, z, this.jointAxis]);
    }

    /**
     * 更新关节轴方向（会自动归一化并刷新虚线距离）
     */
    public setAxis(axis: THREE.Vector3): void {
        const normalizedAxis = axis.clone().normalize();
        const geom = this.jointAxis.geometry as THREE.BufferGeometry;

        // 复用 attribute，避免频繁 new BufferGeometry
        const pos = geom.getAttribute("position") as THREE.BufferAttribute;
        if (pos && pos.count >= 2) {
            pos.setXYZ(0, 0, 0, 0);
            pos.setXYZ(1, normalizedAxis.x, normalizedAxis.y, normalizedAxis.z);
            pos.needsUpdate = true;
        } else {
            geom.setFromPoints([new THREE.Vector3(0, 0, 0), normalizedAxis]);
        }

        this.jointAxis.computeLineDistances();
        setLineMaterialProps(this.jointAxis, { needsUpdate: true });
    }
}
