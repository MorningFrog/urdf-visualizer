/* 测量模块 */

import * as THREE from "three";
import { CustomURDFDragControls } from "./CustomURDFDragControls";
// 导入测量模块
import { Measure, MeasureMode } from "./Measure";

export class ModuleMeasure {
    dragControls: CustomURDFDragControls;
    measureCoordinatesTool: Measure;
    measureDistanceTool: Measure;
    measureAreaTool: Measure;
    measureAngleTool: Measure;

    measureCoordinatesButton = document.getElementById(
        "measure-coordinates"
    ) as HTMLButtonElement;
    measureDistanceButton = document.getElementById(
        "measure-distance"
    ) as HTMLButtonElement;
    measureAreaButton = document.getElementById(
        "measure-area"
    ) as HTMLButtonElement;
    measureAngleButton = document.getElementById(
        "measure-angle"
    ) as HTMLButtonElement;

    startMeasureCallback: () => void;
    continueMeasureCallback: () => void;
    completeMeasureCallback: () => void;
    closeMeasureCallback: () => void;
    onHoverCallback: () => void;
    onUnhoverCallback: () => void;

    constructor(
        renderer: THREE.WebGLRenderer,
        scene: THREE.Scene,
        camera: THREE.Camera,
        controls: CustomURDFDragControls,
        startMeasureCallback = () => {}, // 开始测量时的回调函数
        continueMeasureCallback = () => {}, // 继续测量时的回调函数
        completeMeasureCallback = () => {}, // 完成测量时的回调函数
        closeMeasureCallback = () => {}, // 取消测量时的回调函数
        onHoverCallback = () => {}, // 鼠标悬停在模型上的回调函数
        onUnhoverCallback = () => {} // 鼠标离开模型时的回调函数
    ) {
        // 确保所有元素都已加载
        if (
            !this.measureCoordinatesButton ||
            !this.measureDistanceButton ||
            !this.measureAreaButton ||
            !this.measureAngleButton
        ) {
            throw new Error("Element not found");
        }

        this.dragControls = controls;
        this.startMeasureCallback = startMeasureCallback;
        this.continueMeasureCallback = continueMeasureCallback;
        this.completeMeasureCallback = completeMeasureCallback;
        this.closeMeasureCallback = closeMeasureCallback;
        this.onHoverCallback = onHoverCallback;
        this.onUnhoverCallback = onUnhoverCallback;

        // 测量工具
        this.measureCoordinatesTool = new Measure(
            renderer,
            scene,
            camera,
            controls,
            MeasureMode.Coordinates,
            this.clearMeaure,
            this.startMeasureCallback,
            this.continueMeasureCallback,
            this.completeMeasureCallback,
            this.closeMeasureCallback,
            this.onHoverCallback,
            this.onUnhoverCallback
        );
        this.measureDistanceTool = new Measure(
            renderer,
            scene,
            camera,
            controls,
            MeasureMode.Distance,
            this.clearMeaure,
            this.startMeasureCallback,
            this.continueMeasureCallback,
            this.completeMeasureCallback,
            this.closeMeasureCallback,
            this.onHoverCallback,
            this.onUnhoverCallback
        );
        this.measureAreaTool = new Measure(
            renderer,
            scene,
            camera,
            controls,
            MeasureMode.Area,
            this.clearMeaure,
            this.startMeasureCallback,
            this.continueMeasureCallback,
            this.completeMeasureCallback,
            this.closeMeasureCallback,
            this.onHoverCallback,
            this.onUnhoverCallback
        );
        this.measureAngleTool = new Measure(
            renderer,
            scene,
            camera,
            controls,
            MeasureMode.Angle,
            this.clearMeaure,
            this.startMeasureCallback,
            this.continueMeasureCallback,
            this.completeMeasureCallback,
            this.closeMeasureCallback,
            this.onHoverCallback,
            this.onUnhoverCallback
        );

        this.measureCoordinatesButton.addEventListener("click", () => {
            if (this.measureCoordinatesButton.classList.contains("checked")) {
                this.handleMeasureCoordinates(false);
            } else {
                this.handleMeasureCoordinates(true);
            }
        });

        this.measureDistanceButton.addEventListener("click", () => {
            if (this.measureDistanceButton.classList.contains("checked")) {
                this.handleMeasureDistance(false);
            } else {
                this.handleMeasureDistance(true);
            }
        });

        this.measureAreaButton.addEventListener("click", () => {
            if (this.measureAreaButton.classList.contains("checked")) {
                this.handleMeasureArea(false);
            } else {
                this.handleMeasureArea(true);
            }
        });

        this.measureAngleButton.addEventListener("click", () => {
            if (this.measureAngleButton.classList.contains("checked")) {
                this.handleMeasureAngle(false);
            } else {
                this.handleMeasureAngle(true);
            }
        });
    }

    // 清除测量
    clearMeaure = () => {
        this.handleMeasureCoordinates(false);
        this.handleMeasureDistance(false);
        this.handleMeasureArea(false);
        this.handleMeasureAngle(false);
        this.closeMeasureCallback();
    };

    handleMeasureCoordinates = (isMeasureCoordinates: boolean) => {
        if (isMeasureCoordinates) {
            if (this.measureCoordinatesButton.classList.contains("checked")) {
                return;
            }
            this.measureCoordinatesButton.classList.add("checked");
            if (this.measureDistanceButton.classList.contains("checked")) {
                this.measureDistanceButton.classList.remove("checked");
                this.measureDistanceTool.close();
            }
            if (this.measureAreaButton.classList.contains("checked")) {
                this.measureAreaButton.classList.remove("checked");
                this.measureAreaTool.close();
            }
            if (this.measureAngleButton.classList.contains("checked")) {
                this.measureAngleButton.classList.remove("checked");
                this.measureAngleTool.close();
            }
            this.measureCoordinatesTool.open();
            this.dragControls.set_enable(false);
        } else {
            if (!this.measureCoordinatesButton.classList.contains("checked")) {
                return;
            }
            this.measureCoordinatesButton.classList.remove("checked");
            this.measureCoordinatesTool.close();
            this.dragControls.set_enable(true);
        }
    };

    handleMeasureDistance = (isMeasureDistance: boolean) => {
        if (isMeasureDistance) {
            if (this.measureDistanceButton.classList.contains("checked")) {
                return;
            }

            this.measureDistanceButton.classList.add("checked");
            if (this.measureCoordinatesButton.classList.contains("checked")) {
                this.measureCoordinatesButton.classList.remove("checked");
                this.measureCoordinatesTool.close();
            }
            if (this.measureAreaButton.classList.contains("checked")) {
                this.measureAreaButton.classList.remove("checked");
                this.measureAreaTool.close();
            }
            if (this.measureAngleButton.classList.contains("checked")) {
                this.measureAngleButton.classList.remove("checked");
                this.measureAngleTool.close();
            }
            this.measureDistanceTool.open();
            this.dragControls.set_enable(false);
        } else {
            if (!this.measureDistanceButton.classList.contains("checked")) {
                return;
            }
            this.measureDistanceButton.classList.remove("checked");
            this.measureDistanceTool.close();
            this.dragControls.set_enable(true);
        }
    };

    handleMeasureArea = (isMeasureArea: boolean) => {
        if (isMeasureArea) {
            if (this.measureAreaButton.classList.contains("checked")) {
                return;
            }
            this.measureAreaButton.classList.add("checked");
            if (this.measureCoordinatesButton.classList.contains("checked")) {
                this.measureCoordinatesButton.classList.remove("checked");
                this.measureCoordinatesTool.close();
            }
            if (this.measureDistanceButton.classList.contains("checked")) {
                this.measureDistanceButton.classList.remove("checked");
                this.measureDistanceTool.close();
            }
            if (this.measureAngleButton.classList.contains("checked")) {
                this.measureAngleButton.classList.remove("checked");
                this.measureAngleTool.close();
            }
            this.measureAreaTool.open();
            this.dragControls.set_enable(false);
        } else {
            if (!this.measureAreaButton.classList.contains("checked")) {
                return;
            }
            this.measureAreaButton.classList.remove("checked");
            this.measureAreaTool.close();
            this.dragControls.set_enable(true);
        }
    };

    handleMeasureAngle = (isMeasureAngle: boolean) => {
        if (isMeasureAngle) {
            if (this.measureAngleButton.classList.contains("checked")) {
                return;
            }
            this.measureAngleButton.classList.add("checked");
            if (this.measureCoordinatesButton.classList.contains("checked")) {
                this.measureCoordinatesButton.classList.remove("checked");
                this.measureCoordinatesTool.close();
            }
            if (this.measureDistanceButton.classList.contains("checked")) {
                this.measureDistanceButton.classList.remove("checked");
                this.measureDistanceTool.close();
            }
            if (this.measureAreaButton.classList.contains("checked")) {
                this.measureAreaButton.classList.remove("checked");
                this.measureAreaTool.close();
            }
            this.measureAngleTool.open();
            this.dragControls.set_enable(false);
        } else {
            if (!this.measureAngleButton.classList.contains("checked")) {
                return;
            }
            this.measureAngleButton.classList.remove("checked");
            this.measureAngleTool.close();
            this.dragControls.set_enable(true);
        }
    };
}
