import { reactive } from "vue";
import { LengthUnit, AngleUnit } from "@/utils/units";

export interface VisualSettings {
    showVisual: boolean;
    showCollision: boolean;
    showWorldFrame: boolean;
    showJointFrames: boolean;
    showLinkFrames: boolean;
    jointFrameSize: number;
    linkFrameSize: number;
    lengthUnit: LengthUnit;
    angleUnit: AngleUnit;
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
});
