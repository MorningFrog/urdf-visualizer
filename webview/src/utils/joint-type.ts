export enum JointType {
    FIXED = "fixed",
    CONTINUOUS = "continuous",
    REVOLUTE = "revolute",
    PRISMATIC = "prismatic",
    PLANAR = "planar",
    FLOATING = "floating",
}

/** 判断关节类型是否为可拖动类型 */
export function isDraggableJoint(jointType: JointType): boolean {
    return (
        jointType === JointType.CONTINUOUS ||
        jointType === JointType.REVOLUTE ||
        jointType === JointType.PRISMATIC
    );
}

/** 判断关节类型是否为固定类型 */
export function isFixedJoint(jointType: JointType): boolean {
    return jointType === JointType.FIXED;
}

/** 判断关节是否为角度类型 */
export function isAngularJoint(jointType: JointType): boolean {
    return (
        jointType === JointType.CONTINUOUS || jointType === JointType.REVOLUTE
    );
}

/** 判断关节是否为线性类型 */
export function isLinearJoint(jointType: JointType): boolean {
    return jointType === JointType.PRISMATIC;
}
