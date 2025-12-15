import { reactive } from "vue";

import type {
    URDFRobot,
    URDFJoint,
    URDFVisual,
    URDFLink,
    URDFCollider,
} from "urdf-loader";

export interface URDFStoreState {
    /** 机器人 */
    robot: URDFRobot | null;
    /** 鼠标悬停的 link 名称 */
    hoveredLinkName: string | null;
    /** 鼠标悬停的 link 是否为 visual (否则为 collider) */
    isHoveredLinkVisual: boolean;
    /** 鼠标悬停的 joint 名称 */
    hoveredJointName: string | null;
    /** 各关节的名称-值对象 */
    jointValues: Map<string, number>;
    /** 是否需要重新加载 URDF */
    requireReload: boolean;
}

export const urdfStore = reactive<URDFStoreState>({
    robot: null,
    hoveredLinkName: null,
    isHoveredLinkVisual: false,
    hoveredJointName: null,
    jointValues: new Map<string, number>(),
    requireReload: false,
});
