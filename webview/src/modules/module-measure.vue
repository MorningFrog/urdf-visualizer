<script setup lang="ts">
import { ref, watch } from "vue";
import * as THREE from "three";
import { measureSettings } from "@/stores/measure-settings";
import {
    extractAlphaFromRgbString, createLabelMaterial, createLabel,
    setPointPosition, setLinePositions, setSurfacePositions
} from "@/utils/threejs-tools";

/** 最大支持测量点数 TODO: better to remove this limitation */
const MAX_POINT_COUNT = 20;
/** 最大支持测量线数 */
const MAX_LINE_COUNT = Math.floor(MAX_POINT_COUNT / 2);
/** 最大支持测量面数 */
const MAX_SURFACE_COUNT = Math.floor(MAX_POINT_COUNT / 3);
/** 最大支持标签数 */
const MAX_LABEL_COUNT = Math.floor(MAX_POINT_COUNT);
/** 测量对象标识名称 */
const MEASURE_OBJ_NAME = "measure-object";
/** 测量标签对象标识名称 */
const MEASURE_LABEL_NAME = "measure-label";

const numPoint = ref(0);
const numLine = ref(0);
const numSurface = ref(0);
const numLabel = ref(0);
const numTempPoint = ref(0);
const numTempLine = ref(0);
const numTempSurface = ref(0);
const numTempLabel = ref(0);
const numAngleArc = ref(0);


const { pointMaterial, lineMaterial, surfaceMaterial,
    ensuredPoints, ensuredLines, ensuredSurfaces, ensuredLabels,
    tempPoint, tempLines, tempSurface, tempLabel,
    angleArc
} = (() => {
    const pointMaterial = new THREE.PointsMaterial({
        color: measureSettings.pointColor,
        size: measureSettings.pointSize,
        opacity: extractAlphaFromRgbString(measureSettings.pointColor),
        transparent: true,
        depthWrite: false,
        depthTest: false,
        sizeAttenuation: false, // 禁用随距离缩放
    });
    watch(
        () => measureSettings.pointColor,
        (newColor) => {
            pointMaterial.color = new THREE.Color(newColor);
            pointMaterial.opacity = extractAlphaFromRgbString(newColor);
            pointMaterial.needsUpdate = true;
        }
    );
    watch(
        () => measureSettings.pointSize,
        (newSize) => {
            pointMaterial.size = newSize;
            pointMaterial.needsUpdate = true;
        }
    );

    const lineMaterial = new THREE.LineBasicMaterial({
        color: measureSettings.lineColor,
        linewidth: measureSettings.lineThickness,
        opacity: extractAlphaFromRgbString(measureSettings.lineColor),
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false, // 禁用深度写入, 以便在测量时不受其他物体的影响
        depthTest: false, // 禁用深度测试, 确保线条始终可见
    });
    watch(
        () => measureSettings.lineColor,
        (newColor) => {
            lineMaterial.color = new THREE.Color(newColor);
            lineMaterial.opacity = extractAlphaFromRgbString(newColor);
            lineMaterial.needsUpdate = true;
        }
    );
    watch(
        () => measureSettings.lineThickness,
        (newThickness) => {
            lineMaterial.linewidth = newThickness;
            lineMaterial.needsUpdate = true;
        }
    );

    const surfaceMaterial = new THREE.MeshBasicMaterial({
        color: measureSettings.surfaceColor,
        opacity: extractAlphaFromRgbString(measureSettings.surfaceColor),
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
    });
    watch(
        () => measureSettings.surfaceColor,
        (newColor) => {
            surfaceMaterial.color = new THREE.Color(newColor);
            surfaceMaterial.opacity = extractAlphaFromRgbString(newColor);
            surfaceMaterial.needsUpdate = true;
        }
    );

    const createGeometryWithMaxPoints = (
        pointCount: number
    ): THREE.BufferGeometry => {
        const geom = new THREE.BufferGeometry();
        // 预分配足够的空间 (MAX_POINT_COUNT 个点)
        const pos = new Float32Array(pointCount * 3);
        geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geom.setDrawRange(0, 0); // 初始不绘制任何点
        return geom;
    };
    const createPointsObject = (pointCount: number): THREE.Points => {
        const geom = createGeometryWithMaxPoints(pointCount);
        geom.setDrawRange(0, 0); // 初始不绘制任何点
        const obj = new THREE.Points(geom, pointMaterial);
        obj.name = MEASURE_OBJ_NAME; // 设置标识名称
        return obj;
    };
    const createLinesObject = (pointCount: number): THREE.Line => {
        const geom = createGeometryWithMaxPoints(pointCount);
        geom.setDrawRange(0, 0); // 初始不绘制任何线段
        const obj = new THREE.Line(geom, lineMaterial);
        obj.name = MEASURE_OBJ_NAME; // 设置标识名称
        return obj;
    };
    const createSurfacesObject = (pointCount: number): THREE.Mesh => {
        const geom = createGeometryWithMaxPoints(pointCount);
        geom.setDrawRange(0, 0); // 初始不绘制任何面
        const obj = new THREE.Mesh(geom, surfaceMaterial);
        obj.name = MEASURE_OBJ_NAME; // 设置标识名称
        return obj;
    };

    const ensuredPoints = createPointsObject(MAX_POINT_COUNT);
    watch(numPoint, (newNumPoint) => {
        const geom = ensuredPoints.geometry as THREE.BufferGeometry;
        geom.setDrawRange(0, newNumPoint);
    });
    const ensuredLines = createLinesObject(MAX_LINE_COUNT);
    watch(numLine, (newNumLine) => {
        const geom = ensuredLines.geometry as THREE.BufferGeometry;
        geom.setDrawRange(0, newNumLine * 2); // 每条线段由2个点组成
    });
    const ensuredSurfaces = createSurfacesObject(MAX_SURFACE_COUNT);
    watch(numSurface, (newNumSurface) => {
        const geom = ensuredSurfaces.geometry as THREE.BufferGeometry;
        geom.setDrawRange(0, newNumSurface * 3); // 每个面由3个点组成
    });
    const ensuredLabels: THREE.Sprite[] = [];
    for (let i = 0; i < MAX_POINT_COUNT / 2; i++) {
        const label = createLabel(
            "",
            new THREE.Vector3(0, 0, 0),
            measureSettings.labelSize,
            measureSettings.labelColor
        );
        label.name = MEASURE_LABEL_NAME;
        ensuredLabels.push(label);
    }
    // 不需要 watch numLabel, 因为标签每次创建时都会设置内容和位置
    watch(() => [measureSettings.labelSize, measureSettings.labelColor], () => {
        for (let i = 0; i < numLabel; i++) {
            const label = ensuredLabels[i];
            const newMaterial = createLabelMaterial(
                (label.material as THREE.SpriteMaterial).map!.image,
                measureSettings.labelSize,
                measureSettings.labelColor
            );
            label.material = newMaterial;
        }
    });

    const tempPoint = createPointsObject(1); // 临时点只需要一个
    const tempLines = createLinesObject(2 * 2); // 临时线段最多2条 (面积测量)
    const tempSurface = createSurfacesObject(3); // 临时面最多3个点
    const angleArc = createLinesObject(20); // 角度弧线使用20个点绘制圆弧

    return {
        pointMaterial,
        lineMaterial,
        surfaceMaterial,
        ensuredPoints,
        ensuredLines,
        ensuredSurfaces,
        ensuredLabels,
        tempPoint,
        tempLines,
        tempSurface,
        angleArc,
    };
})();



</script>
<template></template>