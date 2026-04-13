import { reactive } from "vue";

export enum MeasureMode {
    None = "none",
    Coordinates = "coordinates",
    Distance = "distance",
    Angle = "angle",
    Area = "area",
}

export enum MeasureStatus {
    Prepare = "prepare", // 准备测量
    FirstPoint = "firstPoint", // 已选择第一个点
    MorePoint = "morePoint", // 已选择多个点
    Complete = "complete", // 测量完成
}

export interface MeasureStoreState {
    mode: MeasureMode;
    status: MeasureStatus;
}

export const measureStore = reactive<MeasureStoreState>({
    mode: MeasureMode.None,
    status: MeasureStatus.Prepare,
});
