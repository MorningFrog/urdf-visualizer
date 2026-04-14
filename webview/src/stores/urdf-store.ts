import { reactive } from "vue";

import type {
    URDFRobot,
    URDFJoint,
    URDFVisual,
    URDFLink,
    URDFCollider,
} from "urdf-loader";

import { JointType } from "@/utils/joint-type";

export type LinkTreeNode = {
    name: string;
    children: LinkTreeNode[];
};

export interface URDFStoreState {
    /** 机器人 */
    robot: URDFRobot | null;
    /** 鼠标悬停的 link 名称 */
    hoveredLinkName: string | null;
    /** 鼠标悬停的 link 是否为 visual (否则为 collider) */
    isHoveredLinkVisual: boolean;
    /** 鼠标悬停的 joint 名称 */
    hoveredJointName: string | null;
    /** 鼠标是否悬停在模型上(如果在 Settings 面板则应该为 false) */
    isHoveredOnModel: boolean;
    /** 关节类型 */
    jointTypes: Record<string, JointType>;
    /** 各关节的名称-值对象 */
    jointValues: Record<string, number>;
    /** 各关节的最小值 */
    jointLimitMin: Record<string, number>;
    /** 各关节的最大值 */
    jointLimitMax: Record<string, number>;
    /** link 树 */
    linkTree: LinkTreeNode | null;
    /** 各 link 的名称-显示 */
    linkVisibility: Record<string, boolean>;
    /** 是否需要重新加载 URDF */
    requireReload: boolean;
}

export const urdfStore = reactive<URDFStoreState>({
    robot: null,
    hoveredLinkName: null,
    isHoveredLinkVisual: false,
    hoveredJointName: null,
    isHoveredOnModel: false,
    jointTypes: {} as Record<string, JointType>,
    jointValues: {} as Record<string, number>,
    jointLimitMin: {} as Record<string, number>,
    jointLimitMax: {} as Record<string, number>,
    linkTree: null,
    linkVisibility: {} as Record<string, boolean>,
    requireReload: false,
});

const toFiniteJointValue = (value: number | string): number | null => {
    const numericValue =
        typeof value === "number" ? value : Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
};

export const setJointValue = (joint_name: string, value: number | string) => {
    const joint = urdfStore.robot?.joints[joint_name];
    if (!joint) {
        return;
    }
    const numericValue = toFiniteJointValue(value);
    if (numericValue === null) {
        return;
    }
    joint.setJointValue(numericValue);
    urdfStore.jointValues[joint_name] = numericValue;
};

export const setLinkVisibility = (link_name: string, visible: boolean) => {
    const link: URDFLink | undefined = urdfStore.robot?.links[link_name];
    if (!link) {
        return;
    }
    link.visible = visible;
    urdfStore.linkVisibility[link_name] = visible;
};
