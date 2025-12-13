import { LengthUnit, AngleUnit } from "./units";
import { measureSettings } from "@/stores/measure-settings";
import { visualSettings } from "@/stores/visual-settings";

/**
 * 获取测量长度单位转换倍率
 * @returns
 */
export function getMeasureLengthUnitMultiplier() {
    switch (measureSettings.lengthUnit) {
        case LengthUnit.Millimeters:
            return 1000;
        case LengthUnit.Centimeters:
            return 100;
        case LengthUnit.Meters:
            return 1;
        default:
            return 1;
    }
}

/**
 * 获取视觉长度单位转换倍率
 */
export function getVisualLengthUnitMultiplier() {
    switch (visualSettings.lengthUnit) {
        case LengthUnit.Millimeters:
            return 1000;
        case LengthUnit.Centimeters:
            return 100;
        case LengthUnit.Meters:
            return 1;
        default:
            return 1;
    }
}

/**
 * 计算两点间角度
 * @param dir0 边1方向向量
 * @param dir2 边2方向向量
 * @returns 角度值/弧度值(0-180度或0-pi弧度)
 */
export function calculateAngle(dir0: THREE.Vector3, dir2: THREE.Vector3) {
    // 计算夹角(弧度)
    const angleRad = dir0.angleTo(dir2);
    if (measureSettings.angleUnit === AngleUnit.Radians) {
        return angleRad;
    }
    // 转换为角度制
    return (angleRad * 180) / Math.PI;
}

/**
 * 计算直线和角平分线方向
 * @param startPoint 起点
 * @param middlePoint 控制点
 * @param endPoint 终点
 * @return 返回一个数组,包含两条边的方向向量和角平分线方向向量,
 * 例如: [dir0, dir1, dir2], 其中dir0是起点到控制点的方向, dir1是角平分线方向, dir2是控制点到终点的方向.
 */
export function getAngleBisector(
    startPoint: THREE.Vector3,
    middlePoint: THREE.Vector3,
    endPoint: THREE.Vector3
) {
    // 获取两个边向量
    const dir0 = startPoint.clone().sub(middlePoint).normalize();
    const dir2 = endPoint.clone().sub(middlePoint).normalize();
    // 角平分线 = 单位化(两边向量之和)
    const dir1 = dir0.clone().add(dir2).normalize();
    return [dir0, dir1, dir2];
}

/**
 * 计算多边形面积(三角形分割法)
 * TODO: 对于凹多边形需要更复杂的算法
 * @param points 顶点数组
 * @returns 面积值(根据 lengthUnit 确定单位)
 */
export function calculateArea(points: THREE.Vector3[]) {
    let area = 0;
    // 将多边形分割为多个三角形计算
    for (let i = 0, j = 1, k = 2; k < points.length; j++, k++) {
        const a = points[i].distanceTo(points[j]);
        const b = points[j].distanceTo(points[k]);
        const c = points[k].distanceTo(points[i]);
        // 海伦公式计算三角形面积
        const p = (a + b + c) / 2;
        area += Math.sqrt(p * (p - a) * (p - b) * (p - c));
    }
    // 单位转换
    const multiplier = getMeasureLengthUnitMultiplier();
    return area * multiplier * multiplier;
}

/**
 * 测量数字格式化
 * @param num 原始数值
 * @returns 格式化字符串(根据 precision 和 useSciNotation 调整小数位数)
 */
export function measureNumberToString(num: number): string {
    if (measureSettings.useSciNotation) {
        return num.toExponential(measureSettings.precision - 1);
    }

    const numAbs = Math.abs(num);
    const numSign = num < 0 ? -1 : 1;
    const precision = measureSettings.precision;

    // 根据数值大小动态调整小数位数
    if (numAbs !== 0) {
        const log10 = Math.log10(numAbs);
        if (log10 >= precision) {
            // 大于等于 10^precision 的数值
            return Math.round(num).toString();
        } else if (log10 >= 0) {
            // 介于 1 和 10^precision 之间的数值 (含 1)
            return num.toFixed(precision - Math.floor(log10) - 1);
        } else {
            // 小于 1 的数值
            return num.toFixed(precision + Math.ceil(-log10) - 1);
        }
    }

    return num.toString();
}

/**
 * 关节值格式化, 比 measureNumberToString 更简洁, 只需要保留 2 位小数
 * @param value
 * @param isAngle
 */
export function jointValueToString(value: number, isAngle: boolean): string {
    if (isAngle) {
        switch (visualSettings.angleUnit) {
            case AngleUnit.Degrees:
                // 弧度转角度
                value = (value * 180) / Math.PI;
                break;
            case AngleUnit.Radians:
                // 保持弧度制
                break;
        }
    } else {
        const multiplier = getVisualLengthUnitMultiplier();
        value = value * multiplier;
    }
    return value.toFixed(2);
}

export function formatJointValueWithUnit(
    value: number,
    isAngle: boolean
): string {
    let valueStr = jointValueToString(value, isAngle);
    if (isAngle) {
        switch (visualSettings.angleUnit) {
            case AngleUnit.Degrees:
                valueStr += "°";
                break;
            case AngleUnit.Radians:
                valueStr += " rad";
                break;
        }
    } else {
        switch (visualSettings.lengthUnit) {
            case LengthUnit.Millimeters:
                valueStr += " mm";
                break;
            case LengthUnit.Centimeters:
                valueStr += " cm";
                break;
            case LengthUnit.Meters:
                valueStr += " m";
                break;
        }
    }
    return valueStr;
}
