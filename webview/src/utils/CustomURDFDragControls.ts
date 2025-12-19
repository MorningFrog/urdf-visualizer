import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
// @ts-ignore
import { PointerURDFDragControls } from "urdf-loader/src/URDFDragControls";
import type {
    URDFJoint,
    URDFLink,
    URDFVisual,
    URDFCollider,
} from "urdf-loader";

import { urdfStore } from "@/stores/urdf-store";

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

    constructor(
        scene: THREE.Scene,
        camera: THREE.Camera,
        controls: OrbitControls,
        rendererDom: HTMLElement // 传入渲染器的 DOM 元素
    ) {
        super(scene, camera, rendererDom);

        this.controls = controls;
        this.enabled = true; // 默认启用
    }

    update() {
        const { raycaster, manipulating, scene } = this;

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

        // 赋值给 urdfStore
        urdfStore.hoveredJointName = currHoveredJoint
            ? currHoveredJoint.name
            : null;
        urdfStore.hoveredLinkName = currHoveredLink
            ? currHoveredLink.name
            : null;
        urdfStore.isHoveredLinkVisual = currIsHoveredVisual;
        urdfStore.isHoveredOnModel =
            currHoveredJoint !== null || currHoveredLink !== null;
    }

    setGrabbed(grabbed) {
        const { manipulating } = this;

        if (grabbed) {
            if (manipulating !== null || urdfStore.hoveredJointName === null) {
                return;
            }

            this.manipulating =
                urdfStore.robot.joints[urdfStore.hoveredJointName];
            this.onDragStart();
        } else {
            if (this.manipulating === null) {
                return;
            }

            this.onDragEnd();
            this.manipulating = null;
            this.update();
        }
    }

    onDragStart() {
        if (!this.enabled) {
            return;
        }
        // 关闭视角运动
        this.controls.enabled = false;
    }

    onDragEnd() {
        if (!this.enabled) {
            return;
        }
        // 开启视角运动
        this.controls.enabled = true;
    }

    // 更新关节角度
    updateJoint(joint: URDFJoint, angle: number) {
        if (!this.enabled) {
            return;
        }
        super.updateJoint(joint, angle);
        urdfStore.jointValues[joint.name] = angle;
    }

    /**
     * 鼠标移出画布回调
     */
    public onMouseLeaveCallback() {
        // 取消悬停状态
        urdfStore.hoveredJointName = null;
        urdfStore.hoveredLinkName = null;
        urdfStore.isHoveredLinkVisual = false;
        urdfStore.isHoveredOnModel = false;
    }

    // 清理事件监听器
    dispose() {
        super.dispose();
    }

    // 禁用和启用
    set_enable(enabled: boolean) {
        this.enabled = enabled;
        if (!enabled) {
            // 开启视角运动
            this.controls.enabled = true;
        }
    }
}
