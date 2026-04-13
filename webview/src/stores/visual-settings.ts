import { reactive } from "vue";
import { LengthUnit, AngleUnit } from "@/utils/units";

export interface VisualSettings {
    /** 是否显示模型的 Visual */
    showVisual: boolean;
    /** 是否显示模型的 Collision */
    showCollision: boolean;
    /** 是否显示世界坐标系 */
    showWorldFrame: boolean;
    /** 是否始终显示关节坐标系 */
    showJointFrames: boolean;
    /** 是否始终显示连杆坐标系 */
    showLinkFrames: boolean;
    /** 关节坐标系大小 */
    jointFrameSize: number;
    /** 连杆坐标系大小 */
    linkFrameSize: number;
    /** 长度单位 */
    lengthUnit: LengthUnit;
    /** 角度单位 */
    angleUnit: AngleUnit;
    /** 模型的 collision 颜色 */
    collisionColor: string;
    /** 背景颜色 */
    backgroundColor: string;
}

export const visualSettings = reactive<VisualSettings>({
    showVisual: true,
    showCollision: false,
    showWorldFrame: true,
    showJointFrames: false,
    showLinkFrames: false,
    jointFrameSize: 0.25,
    linkFrameSize: 0.25,
    lengthUnit: LengthUnit.Meters,
    angleUnit: AngleUnit.Degrees,
    collisionColor: "rgba(255, 190, 56, 0.35)",
    backgroundColor: "#cccccc",
});
