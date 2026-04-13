import * as THREE from "three";
import { isFrameHelper } from "./custom-axes";

function createTextTexture(
    text: string,
    scale: number,
    color: string = "#000000"
): { texture: THREE.Texture; width: number; height: number } {
    const padding = 20 * scale; // 边距
    const fontSize = 50 * scale;
    const minHeight = 128 * scale;

    // 临时画布测量文本尺寸
    const tempCanvas = document.createElement("canvas");
    const tempContext = tempCanvas.getContext("2d")!;
    tempContext.font = `${fontSize}px Arial`;

    // 计算文本实际尺寸
    const metrics = tempContext.measureText(text);
    const textWidth = metrics.width;
    const textHeight = Math.min(minHeight, fontSize * 1.5); // 基础高度

    // 计算画布实际尺寸
    const canvasWidth = Math.min(textWidth + padding * 2, 2048); // 最大宽度2048px
    const canvasHeight = textHeight * 2;

    // 创建实际渲染画布
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // 设置高清渲染
    const renderScale = window.devicePixelRatio || 1; // 基于设备像素比
    canvas.width = canvasWidth * renderScale;
    canvas.height = canvasHeight * renderScale;

    const context = canvas.getContext("2d")!;
    context.scale(renderScale, renderScale); // 确保文本渲染位置正确
    context.font = `${fontSize}px Arial`;

    // 文本样式
    context.fillStyle = color;
    context.textAlign = "center";
    context.textBaseline = "bottom"; // 基线在底部

    // 填充文本
    context.fillText(
        text,
        canvas.width / (2 * renderScale),
        canvas.height / (2 * renderScale)
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return {
        texture,
        width: canvas.width,
        height: canvas.height,
    };
}

export interface LabelMaterialResult {
    material: THREE.SpriteMaterial;
    objScale: number;
    width: number;
    height: number;
}

export function createLabelMaterial(
    label: string,
    labelSize: number = 8,
    color: string = "#000000"
): LabelMaterialResult {
    const resolution_scale = 0.5; // 提高基础清晰度
    const objScale = (0.3 * labelSize) / 8; // 调整整体缩放

    const { texture, width, height } = createTextTexture(
        label,
        resolution_scale,
        color
    );

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        sizeAttenuation: false,
        depthTest: false,
        depthWrite: false,
    });

    return { material, objScale, width, height };
}

export function createLabel(
    label: string,
    position: THREE.Vector3,
    labelSize: number = 8,
    color: string = "#000000"
) {
    const { material, objScale, width, height } = createLabelMaterial(
        label,
        labelSize,
        color
    );
    const obj = new THREE.Sprite(material);
    // 关键:保持纹理原始宽高比
    const aspectRatio = width / height;
    const baseHeight = 0.15; // 场景中的基本高度
    const baseWidth = baseHeight * aspectRatio;

    obj.scale.set(baseWidth * objScale, baseHeight * objScale, 1);
    obj.position.copy(position);
    obj.renderOrder = 999; // 确保始终显示在前面

    return obj;
}

/**
 * 创建三维空间中的弧线几何体
 * @param dir0 - 边1的归一化方向向量
 * @param dir2 - 边2的归一化方向向量
 * @param center - 弧线的圆心
 * @param radius - 弧线的半径
 * @param material - 用于渲染弧线的材质
 * @returns 包含弧线点数据的BufferGeometry
 */
export function createCurve(
    dir0: THREE.Vector3,
    dir2: THREE.Vector3,
    center: THREE.Vector3,
    radius: number,
    material: THREE.Material
): THREE.Line {
    // 根据夹角判断是否需要交换

    // 计算旋转角度和弧线平面
    const normal = new THREE.Vector3().crossVectors(dir0, dir2).normalize();
    const angle = dir0.angleTo(dir2); // 弧度制的夹角

    // 在XY平面创建二维弧线(起点在正X轴,按逆时针旋转指定角度)
    const curve = new THREE.EllipseCurve(
        0,
        0, // 圆心在局部坐标原点
        radius,
        radius, // X/Y半径相同(正圆)
        0,
        angle, // 起始角到终止角(弧度)
        false, // 逆时针
        0 // 旋转偏移(弧度)
    );

    // 获取弧线点集(二维)
    const points2D = curve.getPoints(10); // 10个分段点

    // 创建旋转矩阵:使XY平面法线(Z轴)对齐实际法线方向
    const rotation1 = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        normal
    );
    // 创建旋转矩阵: 使 X 轴对齐到 dir0 方向
    const rotation2 = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(1, 0, 0).applyQuaternion(rotation1),
        dir0
    );

    // 将点从二维平面转换到三维空间
    const points3D = points2D.map((point) => {
        // 创建局部坐标点(Z=0)
        const vec = new THREE.Vector3(point.x, point.y, 0);

        // 使法线方向对齐
        vec.applyQuaternion(rotation1);

        // 使 X 轴对齐到 dir0 方向
        vec.applyQuaternion(rotation2);

        // 平移到实际圆心位置
        return vec.add(center);
    });

    // 创建并返回几何体
    const geometry = new THREE.BufferGeometry();
    geometry.setFromPoints(points3D);
    const obj = new THREE.Line(geometry, material);
    return obj;
}

/**
 * 计算机器人模型的三维包围盒, 忽略辅助对象(添加了 __isFrameHelper 标记的对象)
 * @param root - 机器人根对象
 * @returns 计算得到的包围盒
 */
export function computeRobotBounds(root: THREE.Object3D): THREE.Box3 {
    const box = new THREE.Box3();
    root.updateMatrixWorld(true);

    root.traverse((o: any) => {
        if (isFrameHelper(o)) return; // ✅ 跳过 helper 子树

        // 建议只统计 mesh（避免 line / helper / gizmo 干扰）
        if (!o.isMesh) return;

        box.expandByObject(o, true);
    });

    return box;
}

/**
 * 从字符串 `"rgba(r, g, b, a)"` 或 `"rgb(r, g, b)"` 中提取 alpha 值.
 * 兼容 `rgb(r g b / a)` 这种现代语法. 遇到 `#` 开头的颜色字符串会返回 1.
 */
export function extractAlphaFromRgbString(input: string): number | null {
    const s = input.trim();
    if (s.startsWith("#")) {
        return 1; // 十六进制颜色没有 alpha 信息
    }

    // 兼容: rgb(1 2 3 / 0.5) 这种现代语法也顺便支持一下(可选)
    // 这里允许逗号或空格分隔; alpha 允许小数; 允许百分比(如 50%)
    const re =
        /^rgba?\(\s*([0-9.]+%?)\s*(?:,|\s)\s*([0-9.]+%?)\s*(?:,|\s)\s*([0-9.]+%?)\s*(?:(?:,|\s*\/\s*)\s*([0-9.]+%?)\s*)?\)$/i;

    const m = s.match(re);
    if (!m) return null;

    const alphaRaw = m[4];
    if (!alphaRaw) return 1;

    // 处理百分比 alpha: 如 50% => 0.5
    if (alphaRaw.endsWith("%")) {
        const pct = Number(alphaRaw.slice(0, -1));
        if (Number.isNaN(pct)) return null;
        return clamp01(pct / 100);
    }

    const a = Number(alphaRaw);
    if (Number.isNaN(a)) return null;
    return clamp01(a);
}

function clamp01(x: number) {
    return Math.min(1, Math.max(0, x));
}

export function setPointPosition(
    obj: THREE.Points,
    index: number,
    position: THREE.Vector3
) {
    const geom = obj.geometry as THREE.BufferGeometry;
    const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
    posAttr.setXYZ(index, position.x, position.y, position.z);
    posAttr.needsUpdate = true;
}
export function setLinePositions(
    obj: THREE.Line,
    index: number,
    start: THREE.Vector3,
    end: THREE.Vector3
) {
    const geom = obj.geometry as THREE.BufferGeometry;
    const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
    posAttr.setXYZ(index * 2, start.x, start.y, start.z);
    posAttr.setXYZ(index * 2 + 1, end.x, end.y, end.z);
    posAttr.needsUpdate = true;
}
export function setSurfacePositions(
    obj: THREE.Mesh,
    index: number,
    v1: THREE.Vector3,
    v2: THREE.Vector3,
    v3: THREE.Vector3
) {
    const geom = obj.geometry as THREE.BufferGeometry;
    const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
    posAttr.setXYZ(index * 3, v1.x, v1.y, v1.z);
    posAttr.setXYZ(index * 3 + 1, v2.x, v2.y, v2.z);
    posAttr.setXYZ(index * 3 + 2, v3.x, v3.y, v3.z);
    posAttr.needsUpdate = true;
}
