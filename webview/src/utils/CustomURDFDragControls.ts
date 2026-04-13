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

/** Find the nearest parent that is a joint */
function isJoint(j: URDFLink | URDFJoint | URDFVisual) {
    // @ts-ignore
    return j.isURDFJoint && j.jointType !== "fixed";
}

/**
 * 找到最近的可见 Link 和 Joint,
 */
function findVisibleIntersection(intersections: THREE.Intersection[]): {
    hit: THREE.Intersection | null;
    link: URDFLink | null;
    isVisual: boolean;
    joint: URDFJoint | null;
} {
    for (const hit of intersections) {
        const { link, isVisual, isVisible } = findNearestLink(hit.object);
        if (!link || !isVisible) {
            continue;
        }

        let tempIsVisible = true;
        let tempLink = link;
        while (tempLink) {
            if (tempIsVisible) {
                ({ link: tempLink, isVisible: tempIsVisible } = findNearestLink(
                    tempLink.parent
                ));
            } else {
                break;
            }
        }
        if (tempIsVisible) {
            const joint = findNearestJoint(hit.object);
            return { hit, link, isVisual, joint };
        }
    }
    return { hit: null, link: null, isVisual: false, joint: null };
}

/** 找到最近的 Joint (向上搜索) */
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
 * 寻找最近的 Link (向上搜索)
 * @param child
 * @returns
 * { link: 找到的 Link, isVisual: 是否为 Visual, isVisible: 是否可视 }
 */
function findNearestLink(child: any): {
    link: URDFLink | null;
    isVisual: boolean;
    isVisible: boolean;
} {
    let curr: any = child;
    let isVisual = false;
    let isVisible = true;
    while (curr) {
        // @ts-ignore
        if (curr.isURDFVisual) {
            isVisual = true;
        }

        // @ts-ignore
        if (!curr.visible) {
            isVisible = false;
        }

        // @ts-ignore
        if (curr.isURDFLink) {
            return { link: curr, isVisual, isVisible };
        }

        curr = curr.parent;
    }
    return { link: null, isVisual, isVisible };
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

        const intersections = raycaster.intersectObject(scene, true);
        const {
            hit,
            link: currHoveredLink,
            isVisual: currIsHoveredVisual,
            joint: currHoveredJoint,
        } = findVisibleIntersection(intersections);
        if (hit) {
            this.hitDistance = hit.distance;
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
