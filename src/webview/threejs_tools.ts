import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

/**
 * 创建 three.js scene
 */
export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcccccc);

    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 10, 10);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    camera.layers.enable(1); // 显示关节轴等注释层

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0xffffff);
    renderer.setClearAlpha(0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const urdfViewerElement = document.getElementById("urdf-viewer");
    if (urdfViewerElement) {
        urdfViewerElement.appendChild(renderer.domElement);
    } else {
        throw new Error("urdf-viewer element not found");
    }

    const dirLight = new THREE.DirectionalLight(0xffffff, Math.PI);
    dirLight.position.set(4, 10, 10);
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.normalBias = 0.001;
    dirLight.castShadow = true;
    scene.add(dirLight);
    scene.add(dirLight.target);

    const ambientLight = new THREE.HemisphereLight("#fff", "#000");
    ambientLight.groundColor.lerp(ambientLight.color, 0.5 * Math.PI);
    ambientLight.intensity = 0.5;
    ambientLight.position.set(0, 0, 1);
    scene.add(ambientLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 0.1;
    controls.target.y = 1;
    controls.update();

    return { scene, camera, renderer, dirLight, ambientLight, controls };
}

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

export function createLabel(label: string, position: THREE.Vector3) {
    const resolution_scale = 0.5; // 提高基础清晰度
    const obj_scale = 0.3; // 调整整体缩放

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
 * 数字格式化
 * @param num 原始数值
 * @returns 格式化字符串(根据大小自动调整小数位数)
 */
export function numberToString(num: number): string {
    const absNum = Math.abs(num);
    if (absNum < 1e-6) {
        return "0";
    } else if (absNum < 1) {
        return num.toPrecision(2);
    } else {
        return num.toFixed(2);
    }
}

/**
 * 计算直线和角平分线方向
 * @param startPoint 起点
 * @param middlePoint 控制点
 * @param endPoint 终点
 * @return 返回一个数组,包含两条边的方向向量和角平分线方向向量,
 * 例如: [dir0, dir1, dir2], 其中dir0是起点到控制点的方向, dir1是角平分线方向, dir2是控制点到终点的方向.
 */
export function getAngleBisector(
    startPoint: THREE.Vector3,
    middlePoint: THREE.Vector3,
    endPoint: THREE.Vector3
) {
    // 获取两个边向量
    const dir0 = startPoint.clone().sub(middlePoint).normalize();
    const dir2 = endPoint.clone().sub(middlePoint).normalize();
    // 角平分线 = 单位化(两边向量之和)
    const dir1 = dir0.clone().add(dir2).normalize();
    return [dir0, dir1, dir2];
}

/**
 * 计算多边形面积(三角形分割法)
 * TODO: 对于凹多边形需要更复杂的算法
 * @param points 顶点数组
 * @returns 面积值(平方米)
 */
export function calculateArea(points: THREE.Vector3[]) {
    let area = 0;
    // 将多边形分割为多个三角形计算
    for (let i = 0, j = 1, k = 2; k < points.length; j++, k++) {
        const a = points[i].distanceTo(points[j]);
        const b = points[j].distanceTo(points[k]);
        const c = points[k].distanceTo(points[i]);
        // 海伦公式计算三角形面积
        const p = (a + b + c) / 2;
        area += Math.sqrt(p * (p - a) * (p - b) * (p - c));
    }
    return area;
}

/**
 * 计算两点间角度(角度制)
 * @param dir0 边1方向向量
 * @param dir2 边2方向向量
 * @returns 角度值(0-180度)
 */
export function calculateAngle(dir0: THREE.Vector3, dir2: THREE.Vector3) {
    // 计算夹角(弧度)并转为角度
    return (dir0.angleTo(dir2) * 180) / Math.PI;
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
 * Link 的坐标系辅助器
 */
export class LinkAxesHelper extends THREE.Group {
    private readonly dashSize = 0.02; // 虚线段的长度
    private readonly gapSize = 0.02; // 间隔的长度
    private readonly linewidth = 1; // 线宽(注意:实际效果可能受浏览器限制)
    private readonly hoveredLinewidth = 2; // 鼠标悬停时的线宽

    // 存储各坐标轴对象
    public xAxis: THREE.Line;
    public yAxis: THREE.Line;
    public zAxis: THREE.Line;

    /**
     * 创建一个虚线坐标系辅助器
     * @param size 轴线长度
     */
    constructor(size: number = 1) {
        super();

        // 创建虚线材质
        const dashMaterial = new THREE.LineDashedMaterial({
            color: 0xffffff,
            dashSize: this.dashSize,
            gapSize: this.gapSize,
            linewidth: this.linewidth,
        });

        // 创建X轴(红色)
        const xGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(1, 0, 0),
        ]);
        const xAxis = new THREE.Line(xGeometry, dashMaterial.clone());
        xAxis.computeLineDistances(); // 必须调用,否则虚线不生效
        // @ts-ignore
        xAxis.material.color.setHex(0xff0000); // 红色
        this.add(xAxis);

        // 创建Y轴(绿色)
        const yGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 1, 0),
        ]);
        const yAxis = new THREE.Line(yGeometry, dashMaterial.clone());
        yAxis.computeLineDistances();
        // @ts-ignore
        yAxis.material.color.setHex(0x00ff00); // 绿色
        this.add(yAxis);

        // 创建Z轴(蓝色)
        const zGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 1),
        ]);
        const zAxis = new THREE.Line(zGeometry, dashMaterial.clone());
        zAxis.computeLineDistances();
        // @ts-ignore
        zAxis.material.color.setHex(0x0000ff); // 蓝色
        this.add(zAxis);

        // 设置尺寸
        this.scale.set(size, size, size);

        // 存储轴线对象
        this.xAxis = xAxis;
        this.yAxis = yAxis;
        this.zAxis = zAxis;
    }

    /**
     * 设置渲染层(layers.set)
     * @param layer 目标层(0-31)
     */
    public setLayer(layer: number): void {
        this.layers.set(layer); // 设置 Group 的层
        this.xAxis.layers.set(layer); // 设置 X 轴的层
        this.yAxis.layers.set(layer); // 设置 Y 轴的层
        this.zAxis.layers.set(layer); // 设置 Z 轴的层
    }

    /**
     * 设置线长
     * @param size 新的轴线长度
     */
    public setSize(size: number): void {
        this.scale.set(size, size, size);
    }

    /**
     * 鼠标悬停时高亮显示
     * @param hovered 是否悬停
     */
    public setHovered(hovered: boolean): void {
        const linewidth = hovered ? this.hoveredLinewidth : this.linewidth;

        // 设置各轴线的线宽
        // @ts-ignore
        this.xAxis.material.linewidth = linewidth;
        // @ts-ignore
        this.yAxis.material.linewidth = linewidth;
        // @ts-ignore
        this.zAxis.material.linewidth = linewidth;

        // 重新更新材质
        // @ts-ignore
        this.xAxis.material.needsUpdate = true;
        // @ts-ignore
        this.yAxis.material.needsUpdate = true;
        // @ts-ignore
        this.zAxis.material.needsUpdate = true;
    }
}

/**
 * Joint 的坐标系辅助器
 */
export class JointAxesHelper extends THREE.Group {
    private readonly dashSize = 0.02; // 虚线段的长度
    private readonly gapSize = 0.02; // 间隔的长度
    private readonly linewidth = 1; // 线宽(注意:实际效果可能受浏览器限制)
    private readonly hoveredLinewidth = 2; // 鼠标悬停时的线宽
    // 存储各坐标轴对象
    public xAxis: THREE.Line;
    public yAxis: THREE.Line;
    public zAxis: THREE.Line;
    // 关节轴对象
    public jointAxis: THREE.Line;

    /**
     * 创建一个 Joint 坐标系辅助器
     * @param size 轴线长度
     * @param axis 关节轴线方向(默认沿Z轴)
     */
    constructor(
        size: number = 1,
        axis: THREE.Vector3 = new THREE.Vector3(0, 0, 1)
    ) {
        super();

        // 创建坐标系材质
        const xyzMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            linewidth: this.linewidth,
        });

        // 创建X轴(红色)
        const xGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(1, 0, 0),
        ]);
        this.xAxis = new THREE.Line(xGeometry, xyzMaterial.clone());
        // @ts-ignore
        this.xAxis.material.color.setHex(0xff0000); // 红色
        this.add(this.xAxis);

        // 创建Y轴(绿色)
        const yGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 1, 0),
        ]);
        this.yAxis = new THREE.Line(yGeometry, xyzMaterial.clone());
        // @ts-ignore
        this.yAxis.material.color.setHex(0x00ff00); // 绿色
        this.add(this.yAxis);

        // 创建Z轴(蓝色)
        const zGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 1),
        ]);
        this.zAxis = new THREE.Line(zGeometry, xyzMaterial.clone());
        // @ts-ignore
        this.zAxis.material.color.setHex(0x0000ff); // 蓝色
        this.add(this.zAxis);

        // 创建关节轴材质
        const axisMaterial = new THREE.LineDashedMaterial({
            color: 0x000000,
            dashSize: this.dashSize,
            gapSize: this.gapSize,
            linewidth: this.linewidth,
        });

        // 归一化axis
        const normalizedAxis = axis.clone().normalize();

        // 创建关节轴线
        const jointGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            normalizedAxis,
        ]);
        this.jointAxis = new THREE.Line(jointGeometry, axisMaterial);
        this.jointAxis.computeLineDistances(); // 必须调用,否则虚线不生效
        this.add(this.jointAxis);

        // 设置尺寸
        this.scale.set(size, size, size);
    }

    /**
     * 设置渲染层(layers.set)
     * @param layer 目标层(0-31)
     */
    public setLayer(layer: number): void {
        this.layers.set(layer); // 设置 Group 的层
        this.xAxis.layers.set(layer); // 设置 X 轴的层
        this.yAxis.layers.set(layer); // 设置 Y 轴的层
        this.zAxis.layers.set(layer); // 设置 Z 轴的层
        this.jointAxis.layers.set(layer); // 设置关节轴线的层
    }

    /**
     * 设置线长
     * @param size 新的轴线长度
     */
    public setSize(size: number): void {
        this.scale.set(size, size, size);
    }

    /**
     * 鼠标悬停时高亮显示
     * @param hovered 是否悬停
     */
    public setHovered(hovered: boolean): void {
        const linewidth = hovered ? this.hoveredLinewidth : this.linewidth;

        // 设置各轴线的线宽
        // @ts-ignore
        this.xAxis.material.linewidth = linewidth;
        // @ts-ignore
        this.yAxis.material.linewidth = linewidth;
        // @ts-ignore
        this.zAxis.material.linewidth = linewidth;
        // @ts-ignore
        this.jointAxis.material.linewidth = linewidth;

        // 重新更新材质
        // @ts-ignore
        this.xAxis.material.needsUpdate = true;
        // @ts-ignore
        this.yAxis.material.needsUpdate = true;
        // @ts-ignore
        this.zAxis.material.needsUpdate = true;
        // @ts-ignore
        this.jointAxis.material.needsUpdate = true;
    }
}
