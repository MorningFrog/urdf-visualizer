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

/**
 * 寻找最近的 Link 元素
 * @param child
 * @returns 返回最近的 URDFLink 元素和悬浮的是否是 Visual 元素的布尔值
 */
function findNearestLink(child: THREE.Mesh): [URDFLink, boolean] {
    let curr: any = child;
    let isVisual = false;
    while (curr) {
        // @ts-ignore
        if (curr.isURDFVisual) {
            isVisual = true;
            curr = curr.parent;
        }

        // @ts-ignore
        if (curr.isURDFLink) {
            return [curr, isVisual];
        }
        curr = curr.parent;
    }
    return [curr, isVisual];
}

export class CustomURDFDragControls extends PointerURDFDragControls {
    private label: HTMLDivElement;
    private controls: OrbitControls;
    public enabled: boolean = true; // 控制是否启用拖拽
    private updateJointCallback: (joint: URDFJoint, angle: number) => void =
        () => {};
    private onHoverCallback?: (
        joint: URDFJoint | null,
        link: URDFLink | null
    ) => void;
    private onUnhoverCallback?: (
        joint: URDFJoint | null,
        link: URDFLink | null
    ) => void;

    public hoveredJoint: URDFJoint | null = null; // 当前悬停的 joint
    public hoveredLink: URDFLink | null = null; // 当前悬停的 link
    public isHoveredVisual: boolean = false; // 是否悬停在 Visual 元素上

    constructor(
        scene: THREE.Scene,
        camera: THREE.Camera,
        controls: OrbitControls,
        rendererDom: HTMLElement, // 传入渲染器的 DOM 元素
        updateJointCallback?: (joint: URDFJoint, angle: number) => void,
        onHoverCallback?: (
            joint: URDFJoint | null,
            link: URDFLink | null
        ) => void,
        onUnhoverCallback?: (
            joint: URDFJoint | null,
            link: URDFLink | null
        ) => void
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
        const { raycaster, hoveredJoint, hoveredLink, manipulating, scene } =
            this;

        if (manipulating) {
            return;
        }

        let currHoveredJoint: URDFJoint | null = null;
        let currHoveredLink: URDFLink | null = null;
        let currIsHoveredVisual: boolean = false;
        const intersections = raycaster.intersectObject(scene, true);
        if (intersections.length !== 0) {
            const hit = intersections[0];
            this.hitDistance = hit.distance;
            [currHoveredLink, currIsHoveredVisual] = findNearestLink(
                hit.object
            );
            currHoveredJoint = findNearestJoint(hit.object);
            this.initialGrabPoint.copy(hit.point);
        }

        if (
            currHoveredJoint !== hoveredJoint ||
            currHoveredLink !== hoveredLink ||
            currIsHoveredVisual !== this.isHoveredVisual
        ) {
            if (hoveredJoint || hoveredLink) {
                this.onUnhover(hoveredJoint, hoveredLink);
            }

            this.hoveredJoint = currHoveredJoint;
            this.hoveredLink = currHoveredLink;
            this.isHoveredVisual = currIsHoveredVisual;

            if (currHoveredJoint || currHoveredLink) {
                this.onHover(currHoveredJoint, currHoveredLink);
            }
        }
    }

    setGrabbed(grabbed) {
        const { hoveredJoint, manipulating } = this;

        if (grabbed) {
            if (manipulating !== null || hoveredJoint === null) {
                return;
            }

            this.manipulating = hoveredJoint;
            this.onDragStart(hoveredJoint);
        } else {
            if (this.manipulating === null) {
                return;
            }

            this.onDragEnd(this.manipulating);
            this.manipulating = null;
            this.update();
        }
    }

    onHover(joint: URDFJoint | null, link: URDFLink | null) {
        if (!this.enabled) {
            return;
        }
        // 显示 joint 和 link 名称
        if (!joint && !link) {
            this.label.style.display = "none";
        } else {
            if (joint && !link) {
                // @ts-ignore
                this.label.innerText = `Joint: ${joint.name}`;
            } else if (!joint && link) {
                // @ts-ignore
                this.label.innerText = `Link: ${link.name}\n${
                    this.isHoveredVisual ? "(Visual)" : "(Collider)"
                }`;
            } else {
                // @ts-ignore
                this.label.innerText = `Joint: ${joint.name}\nLink: ${
                    // @ts-ignore
                    link.name
                }\n${this.isHoveredVisual ? "(Visual)" : "(Collider)"}`;
            }
            this.label.style.display = "block";
        }
        // 执行自定义操作
        this.onHoverCallback && this.onHoverCallback(joint, link);
    }

    onUnhover(joint: URDFJoint | null, link: URDFLink | null) {
        if (!this.enabled) {
            return;
        }
        // 隐藏关节名称
        this.label.style.display = "none";
        // 执行自定义操作
        this.onUnhoverCallback && this.onUnhoverCallback(joint, link);
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

    /**
     * 鼠标移出画布回调
     */
    public onMouseLeaveCallback() {
        // 取消悬停状态
        this.hoveredJoint = null;
        this.hoveredLink = null;
        this.isHoveredVisual = false;
        // 隐藏标签
        this.label.style.display = "none";
        // 执行自定义操作
        this.onUnhoverCallback && this.onUnhoverCallback(null, null);
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
