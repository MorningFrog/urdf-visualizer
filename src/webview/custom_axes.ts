import * as THREE from "three";

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

    // 全局尺寸缩放
    public globalScale: number;
    // size 值
    public localSize: number;

    /**
     * 创建一个虚线坐标系辅助器
     * @param size 轴线长度
     */
    constructor(size: number = 1, scale: number = 1.0) {
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

        // 存储轴线对象
        this.xAxis = xAxis;
        this.yAxis = yAxis;
        this.zAxis = zAxis;

        // 设置全局缩放
        this.globalScale = scale;

        // 设置尺寸
        this.localSize = size;
        this.setSize(size);
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
        this.localSize = size;
        this.scale.set(
            size * this.globalScale,
            size * this.globalScale,
            size * this.globalScale
        );
    }

    /**
     * 设置全局缩放
     * @param scale 新的全局缩放值
     */
    public setGlobalScale(scale: number): void {
        this.globalScale = scale;
        // 重新设置尺寸
        this.setSize(this.localSize);
    }

    /**
     * 鼠标悬停时高亮显示
     * @param hovered 是否悬停
     * @param forceTop 是否强制置于最上层
     */
    public setHovered(hovered: boolean, forceTop: boolean = false): void {
        const linewidth = hovered ? this.hoveredLinewidth : this.linewidth;

        // 设置各轴线的线宽
        // @ts-ignore
        this.xAxis.material.linewidth = linewidth;
        // @ts-ignore
        this.yAxis.material.linewidth = linewidth;
        // @ts-ignore
        this.zAxis.material.linewidth = linewidth;

        // 设置不被阻挡
        if (hovered && forceTop) {
            // @ts-ignore
            this.xAxis.material.depthTest = false;
            // @ts-ignore
            this.yAxis.material.depthTest = false;
            // @ts-ignore
            this.zAxis.material.depthTest = false;
        } else {
            // @ts-ignore
            this.xAxis.material.depthTest = true;
            // @ts-ignore
            this.yAxis.material.depthTest = true;
            // @ts-ignore
            this.zAxis.material.depthTest = true;
        }

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
    // 全局尺寸缩放
    public globalScale: number;
    // size 值
    public localSize: number;

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

        // 设置全局缩放
        this.globalScale = scale;

        // 设置尺寸
        this.localSize = size;
        this.setSize(size);
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
        this.localSize = size;
        this.scale.set(
            size * this.globalScale,
            size * this.globalScale,
            size * this.globalScale
        );
    }

    /**
     * 设置全局缩放
     * @param scale 新的全局缩放值
     */
    public setGlobalScale(scale: number): void {
        this.globalScale = scale;
        // 重新设置尺寸
        this.setSize(this.localSize);
    }

    /**
     * 鼠标悬停时高亮显示
     * @param hovered 是否悬停
     * @param forceTop 是否强制置于最上层
     */
    public setHovered(hovered: boolean, forceTop: boolean = false): void {
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

        // 设置不被阻挡
        if (hovered && forceTop) {
            // @ts-ignore
            this.xAxis.material.depthTest = false;
            // @ts-ignore
            this.yAxis.material.depthTest = false;
            // @ts-ignore
            this.zAxis.material.depthTest = false;
            // @ts-ignore
            this.jointAxis.material.depthTest = false;
        } else {
            // @ts-ignore
            this.xAxis.material.depthTest = true;
            // @ts-ignore
            this.yAxis.material.depthTest = true;
            // @ts-ignore
            this.zAxis.material.depthTest = true;
            // @ts-ignore
            this.jointAxis.material.depthTest = true;
        }

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
