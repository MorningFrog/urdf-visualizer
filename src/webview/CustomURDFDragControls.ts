import * as THREE from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
const { PointerURDFDragControls } = require("urdf-loader/src/URDFDragControls");
import { URDFJoint, URDFLink, URDFVisual, URDFCollider } from "urdf-loader";

// Find the nearest parent that is a joint
function isJoint(j: URDFLink | URDFJoint | URDFVisual) {
    // @ts-ignore
    return j.isURDFJoint && j.jointType !== "fixed";
}

function findNearestJoint(child: THREE.Mesh): URDFJoint | null {
    let curr: any = child;
    while (curr) {
        if (isJoint(curr)) {
            return curr;
        }
        curr = curr.parent;
    }
    return curr;
}

export class CustomURDFDragControls extends PointerURDFDragControls {
    private label: HTMLDivElement;
    private controls: OrbitControls;
    enabled: boolean = true; // 控制是否启用拖拽
    private updateJointCallback: (joint: URDFJoint, angle: number) => void =
        () => {};
    private onHoverCallback: () => void = () => {};
    private onUnhoverCallback: () => void = () => {};

    constructor(
        scene: THREE.Scene,
        camera: THREE.Camera,
        controls: OrbitControls,
        rendererDom: HTMLElement, // 传入渲染器的 DOM 元素
        updateJointCallback?: (joint: URDFJoint, angle: number) => void,
        onHoverCallback?: () => void,
        onUnhoverCallback?: () => void
    ) {
        super(scene, camera, rendererDom);

        this.controls = controls;

        // 创建并设置标签元素
        this.label = document.createElement("div");
        this.label.style.position = "absolute";
        this.label.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
        this.label.style.color = "#fff";
        this.label.style.padding = "5px";
        this.label.style.userSelect = "none";
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
        if (onHoverCallback) {
            this.onHoverCallback = onHoverCallback;
        }
        if (onUnhoverCallback) {
            this.onUnhoverCallback = onUnhoverCallback;
        }
    }

    update() {
        const { raycaster, hovered, manipulating, scene } = this;

        if (manipulating) {
            return;
        }

        let hoveredJoint: URDFJoint | null = null;
        let hoveredLink: URDFLink | null = null;
        const intersections = raycaster.intersectObject(scene, true);
        if (intersections.length !== 0) {
            const hit = intersections[0];
            this.hitDistance = hit.distance;
            hoveredLink = hit.object.parent as URDFLink;
            console.log("hoveredLink", hit.object);
            hoveredJoint = findNearestJoint(hit.object);
            this.initialGrabPoint.copy(hit.point);
        }

        if (hoveredJoint !== hovered) {
            if (hovered) {
                this.onUnhover(hovered);
            }

            this.hovered = hoveredJoint;

            if (hoveredJoint) {
                this.onHover(hoveredJoint);
            }
        }
    }

    onHover(joint: URDFJoint) {
        if (!this.enabled) {
            return;
        }
        // 显示关节名称
        this.label.innerText = `Joint: ${joint.name}`;
        this.label.style.display = "block";
        // 执行自定义操作
        this.onHoverCallback && this.onHoverCallback();
    }

    onUnhover(joint: URDFJoint) {
        if (!this.enabled) {
            return;
        }
        // 隐藏关节名称
        this.label.style.display = "none";
        // 执行自定义操作
        this.onUnhoverCallback && this.onUnhoverCallback();
    }

    onDragStart(joint: URDFJoint) {
        if (!this.enabled) {
            return;
        }
        // 关闭视角运动
        this.controls.enabled = false;
    }

    onDragEnd(joint: URDFJoint) {
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
    updateJoint(joint: URDFJoint, angle: number) {
        if (!this.enabled) {
            return;
        }
        super.updateJoint(joint, angle);
        // 执行自定义操作
        this.updateJointCallback && this.updateJointCallback(joint, angle);
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
