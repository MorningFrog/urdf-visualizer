import * as THREE from "three";

export enum LengthUnit {
    Meters = "meter",
    Centimeters = "centimeter",
    Millimeters = "millimeter",
}

export enum AngleUnit {
    Degrees = "degree",
    Radians = "radian",
}

class MeasureSettings {
    lengthUnit: LengthUnit;
    angleUnit: AngleUnit;
    precision: number;
    useSciNotation: boolean;
    labelSize: number;
    private _lineColor: string;
    private _lineThickness: number;
    private _pointColor: string;
    private _pointSize: number;
    private _meshColor: string;

    private _lineMaterial: THREE.LineBasicMaterial;
    private _pointMaterial: THREE.PointsMaterial;
    private _meshMaterial: THREE.MeshBasicMaterial;

    constructor() {
        this.lengthUnit = LengthUnit.Meters;
        this.angleUnit = AngleUnit.Degrees;
        this.precision = 2;
        this.useSciNotation = false;
        this.labelSize = 8;
        this._lineColor = "#ff0000";
        this._lineThickness = 1;
        this._pointColor = "#ff5000";
        this._pointSize = 10;
        this._meshColor = "#87cefa";
        this._lineMaterial = new THREE.LineBasicMaterial();
        this._pointMaterial = new THREE.PointsMaterial();
        this._meshMaterial = new THREE.MeshBasicMaterial();
        this.updateLineMaterial();
        this.updatePointMaterial();
        this.updateMeshMaterial();
    }

    set lineColor(color: string) {
        this._lineColor = color;
        this.updateLineMaterial();
    }

    get lineColor(): string {
        return this._lineColor;
    }

    set lineThickness(thickness: number) {
        this._lineThickness = thickness;
        this.updateLineMaterial();
    }

    get lineThickness(): number {
        return this._lineThickness;
    }

    set pointColor(color: string) {
        this._pointColor = color;
        this.updatePointMaterial();
    }

    get pointColor(): string {
        return this._pointColor;
    }

    set pointSize(size: number) {
        this._pointSize = size;
        this.updatePointMaterial();
    }

    get pointSize(): number {
        return this._pointSize;
    }

    set meshColor(color: string) {
        this._meshColor = color;
        this.updateMeshMaterial();
    }

    get meshColor(): string {
        return this._meshColor;
    }

    get lineMaterial(): THREE.LineBasicMaterial {
        return this._lineMaterial;
    }
    private updateLineMaterial() {
        this._lineMaterial = new THREE.LineBasicMaterial({
            color: this._lineColor,
            linewidth: this._lineThickness,
            opacity: 0.8,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false, // 禁用深度写入, 以便在测量时不受其他物体的影响
            depthTest: false, // 禁用深度测试, 确保线条始终可见
        });
    }

    get pointMaterial(): THREE.PointsMaterial {
        return this._pointMaterial;
    }
    private updatePointMaterial() {
        this._pointMaterial = new THREE.PointsMaterial({
            color: this._pointColor,
            size: this._pointSize,
            opacity: 0.6,
            transparent: true,
            depthWrite: false,
            depthTest: false,
            sizeAttenuation: false, // 禁用随距离缩放
        });
    }

    get meshMaterial(): THREE.MeshBasicMaterial {
        return this._meshMaterial;
    }
    private updateMeshMaterial() {
        this._meshMaterial = new THREE.MeshBasicMaterial({
            color: this._meshColor,
            opacity: 0.3,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            depthTest: false,
        });
    }
}

export const measureSettings = new MeasureSettings();
