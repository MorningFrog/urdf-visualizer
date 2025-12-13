import * as THREE from "three";
import { isFrameHelper } from "./custom-axes";

function createTextTexture(
    text: string,
    scale: number
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
    context.fillStyle = "#000000"; // 黑色文本
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

export function createLabel(
    label: string,
    position: THREE.Vector3,
    labelSize: number = 8
) {
    const resolution_scale = 0.5; // 提高基础清晰度
    const obj_scale = (0.3 * labelSize) / 8; // 调整整体缩放

    const { texture, width, height } = createTextTexture(
        label,
        resolution_scale
    );

    const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        sizeAttenuation: false,
        depthTest: false,
        depthWrite: false,
    });

    const obj = new THREE.Sprite(spriteMaterial);
    obj.raycast = () => {}; // 禁用射线检测

    // 关键:保持纹理原始宽高比
    const aspectRatio = width / height;
    const baseHeight = 0.15; // 场景中的基本高度
    const baseWidth = baseHeight * aspectRatio;

    obj.scale.set(baseWidth * obj_scale, baseHeight * obj_scale, 1);
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
