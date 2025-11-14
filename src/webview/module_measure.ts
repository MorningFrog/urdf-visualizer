/* 测量模块 */

import * as THREE from "three";
import { CustomURDFDragControls } from "./CustomURDFDragControls";

// 导入测量模块
import { Measure, MeasureMode } from "./Measure";
import { LengthUnit, AngleUnit, measureSettings } from "./measure_settings";

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

    measureSettingsButton = document.getElementById(
        "measure-settings"
    ) as HTMLButtonElement;
    measureSettingsPanel = document.getElementById(
        "measure-settings-panel"
    ) as HTMLDivElement;
    measureLengthUnitSelect = document.getElementById(
        "measure-length-unit"
    ) as HTMLSelectElement;
    measureAngleUnitSelect = document.getElementById(
        "measure-angle-unit"
    ) as HTMLSelectElement;
    measurePrecisionInput = document.getElementById(
        "measure-precision"
    ) as HTMLInputElement;
    measureUseSciNotationCheckbox = document.getElementById(
        "measure-use-sci-notation"
    ) as HTMLInputElement;
    measureLabelSizeInput = document.getElementById(
        "measure-label-size"
    ) as HTMLInputElement;
    measureLineColorInput = document.getElementById(
        "measure-line-color"
    ) as HTMLInputElement;
    measureLineThicknessInput = document.getElementById(
        "measure-line-thickness"
    ) as HTMLInputElement;
    measurePointColorInput = document.getElementById(
        "measure-point-color"
    ) as HTMLInputElement;
    measurePointSizeInput = document.getElementById(
        "measure-point-size"
    ) as HTMLInputElement;

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

        this.measureSettingsButton.addEventListener("click", () => {
            if (this.measureSettingsButton.classList.contains("checked")) {
                this.handleMeasureSettings(false);
            } else {
                this.handleMeasureSettings(true);
            }
        });

        this.measureLengthUnitSelect.addEventListener("change", () => {
            const lengthUnit = this.measureLengthUnitSelect.value;
            switch (lengthUnit) {
                case "meter":
                    measureSettings.lengthUnit = LengthUnit.Meters;
                    break;
                case "centimeter":
                    measureSettings.lengthUnit = LengthUnit.Centimeters;
                    break;
                case "millimeter":
                    measureSettings.lengthUnit = LengthUnit.Millimeters;
                    break;
            }
        });
        this.measureAngleUnitSelect.addEventListener("change", () => {
            const angleUnit = this.measureAngleUnitSelect.value;
            switch (angleUnit) {
                case "degree":
                    measureSettings.angleUnit = AngleUnit.Degrees;
                    break;
                case "radian":
                    measureSettings.angleUnit = AngleUnit.Radians;
                    break;
            }
        });
        this.measurePrecisionInput.addEventListener("change", () => {
            measureSettings.precision = parseInt(
                this.measurePrecisionInput.value
            );
        });
        this.measureUseSciNotationCheckbox.addEventListener("change", () => {
            measureSettings.useSciNotation =
                this.measureUseSciNotationCheckbox.checked;
        });
        this.measureLabelSizeInput.addEventListener("change", () => {
            measureSettings.labelSize = parseInt(
                this.measureLabelSizeInput.value
            );
        });
        this.measureLineColorInput.addEventListener("change", () => {
            measureSettings.lineColor = this.measureLineColorInput.value;
        });
        this.measureLineThicknessInput.addEventListener("change", () => {
            measureSettings.lineThickness = parseInt(
                this.measureLineThicknessInput.value
            );
        });
        this.measurePointColorInput.addEventListener("change", () => {
            measureSettings.pointColor = this.measurePointColorInput.value;
        });
        this.measurePointSizeInput.addEventListener("change", () => {
            measureSettings.pointSize = parseInt(
                this.measurePointSizeInput.value
            );
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
            if (this.measureSettingsButton.classList.contains("checked")) {
                this.measureSettingsButton.classList.remove("checked");
                this.measureSettingsPanel.classList.add("hidden");
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
            if (this.measureSettingsButton.classList.contains("checked")) {
                this.measureSettingsButton.classList.remove("checked");
                this.measureSettingsPanel.classList.add("hidden");
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
            if (this.measureSettingsButton.classList.contains("checked")) {
                this.measureSettingsButton.classList.remove("checked");
                this.measureSettingsPanel.classList.add("hidden");
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
            if (this.measureSettingsButton.classList.contains("checked")) {
                this.measureSettingsButton.classList.remove("checked");
                this.measureSettingsPanel.classList.add("hidden");
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

    handleMeasureSettings = (isOpen: boolean) => {
        if (isOpen) {
            if (this.measureSettingsButton.classList.contains("checked")) {
                return;
            }
            this.measureSettingsButton.classList.add("checked");
            this.measureSettingsPanel.classList.remove("hidden");
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
            if (this.measureAngleButton.classList.contains("checked")) {
                this.measureAngleButton.classList.remove("checked");
                this.measureAngleTool.close();
            }
        } else {
            if (!this.measureSettingsButton.classList.contains("checked")) {
                return;
            }
            this.measureSettingsButton.classList.remove("checked");
            this.measureSettingsPanel.classList.add("hidden");
        }
    };
}
