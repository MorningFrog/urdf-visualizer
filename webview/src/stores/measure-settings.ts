import { reactive } from "vue";
import { LengthUnit, AngleUnit } from "@/utils/units";

export interface MeasureSettings {
    /** 精度(最少有效数字位数) */
    precision: number;
    /** 是否使用科学计数法 */
    useSciNotation: boolean;
    /** 标签大小 */
    labelSize: number;
    /** 线条颜色 */
    lineColor: string;
    /** 线条粗细 */
    lineThickness: number;
    /** 点颜色 */
    pointColor: string;
    /** 点大小 */
    pointSize: number;
    /** 面颜色 */
    surfaceColor: string;
    /** 标签颜色 */
    labelColor: string;
}

export const measureSettings = reactive<MeasureSettings>({
    precision: 2,
    useSciNotation: false,
    labelSize: 8,
    lineColor: "rgba(255, 0, 0, 0.8)",
    lineThickness: 1,
    pointColor: "rgba(255, 80, 0, 0.6)",
    pointSize: 10,
    surfaceColor: "rgba(135, 206, 250, 0.3)",
    labelColor: "#000000",
});
