import * as THREE from "three";
const {
    OrbitControls,
} = require("three/examples/jsm/controls/OrbitControls.js");
const { URDFJoint } = require("urdf-loader");
const { PointerURDFDragControls } = require("urdf-loader/src/URDFDragControls");

export class CustomURDFDragControls extends PointerURDFDragControls {
    private label: HTMLDivElement;

    constructor(
        scene: THREE.Scene,
        camera: THREE.Camera,
        controls: typeof OrbitControls,
        rendererDom: HTMLElement, // 传入渲染器的 DOM 元素
        updateJointCallback?: (joint: typeof URDFJoint, angle: number) => void
    ) {
        super(scene, camera, rendererDom);

        this.controls = controls;

        // 创建并设置标签元素
        this.label = document.createElement("div");
        this.label.style.position = "absolute";
        this.label.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
        this.label.style.color = "#fff";
        this.label.style.padding = "5px";
        this.label.style.display = "none"; // 初始隐藏
        document.body.appendChild(this.label);

        this.enabled = true; // 默认启用

        // 绑定事件,使名称跟随鼠标移动
        rendererDom.addEventListener(
            "mousemove",
            this.updateLabelPosition.bind(this)
        );

        // 绑定回调函数
        if (updateJointCallback) {
            this.updateJointCallback = updateJointCallback;
        }
    }

    onHover(joint: typeof URDFJoint) {
        if (!this.enabled) {
            return;
        }
        // 显示关节名称
        this.label.innerText = `Joint: ${joint.name}`;
        this.label.style.display = "block";
    }

    onUnhover(joint: typeof URDFJoint) {
        if (!this.enabled) {
            return;
        }
        // 隐藏关节名称
        this.label.style.display = "none";
    }

    onDragStart(joint: typeof URDFJoint) {
        if (!this.enabled) {
            return;
        }
        // 关闭视角运动
        this.controls.enabled = false;
    }

    onDragEnd(joint: typeof URDFJoint) {
        if (!this.enabled) {
            return;
        }
        // 开启视角运动
        this.controls.enabled = true;
        // 隐藏关节名称
        this.label.style.display = "none";
    }

    // 更新标签位置
    updateLabelPosition(event: MouseEvent) {
        this.label.style.left = `${event.clientX}px`; // 偏移鼠标位置
        this.label.style.top = `${event.clientY + 10}px`;
    }

    // 更新关节角度
    updateJoint(joint: typeof URDFJoint, angle: number) {
        if (!this.enabled) {
            return;
        }
        super.updateJoint(joint, angle);
        // 执行自定义操作
        if (this.updateJointCallback) {
            this.updateJointCallback(joint, angle);
        }
    }

    // 清理事件监听器
    dispose() {
        super.dispose();
        document.body.removeChild(this.label); // 移除标签元素
    }

    // 禁用和启用
    set_enable(enabled: boolean) {
        this.enabled = enabled;
        if (!enabled) {
            // 隐藏标签
            this.label.style.display = "none";
            // 开启视角运动
            this.controls.enabled = true;
        }
    }
}
