import * as THREE from "three";
import { CustomURDFDragControls } from "./CustomURDFDragControls";
import { DragControls } from "three/examples/jsm/controls/DragControls.js";
import { FontLoader, Font } from "three/examples/jsm/Addons";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

export enum MeasureMode {
    Distance = "Distance",
    Area = "Area",
    Angle = "Angle",
}

// 创建文字的 canvas 纹理
function createTextTexture(text: string, scale: number): THREE.Texture {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.width = 256 * scale;
    canvas.height = 128 * scale;

    context.font = `${50 * scale}px Arial`;
    context.fillStyle = "black";
    context.textAlign = "center";
    context.textBaseline = "bottom";
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return texture;
}

export class Measure {
    readonly LINE_MATERIAL = new THREE.LineBasicMaterial({
        color: 0xff0000,
        linewidth: 1,
        opacity: 0.8,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
    });
    readonly POINT_MATERIAL = new THREE.PointsMaterial({
        color: 0xff5000,
        size: 10,
        opacity: 0.6,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        sizeAttenuation: false, // do not change point size when zooming
    });
    readonly MESH_MATERIAL = new THREE.MeshBasicMaterial({
        color: 0x87cefa,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
    });

    readonly MAX_POINTS = 50; // TODO: better to remove this limitation
    readonly MAX_DISTANCE = 500; // when intersected object's distance is too far away, then ignore it
    readonly OBJ_NAME = "object_for_measure";
    readonly LABEL_NAME = "label_for_measure";

    mode: MeasureMode;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
    controls: CustomURDFDragControls;
    dragControls?: DragControls; // enable objects(labels) to be dragged
    raycaster?: THREE.Raycaster;
    mouseMoved = false;
    isCompleted = false;
    points?: THREE.Points; // used for measure distance and area
    polyline?: THREE.Line; // the line user draws while measuring distance
    faces?: THREE.Mesh; // the faces user draws while measuring area
    curve?: THREE.Line; // the arc curve to indicate the angle in degree
    tempPoints?: THREE.Points; // used to store temporary Points
    tempLine?: THREE.Line; // used to store temporary line, which is useful for drawing line as mouse moves
    tempLineForArea?: THREE.Line; // used to store temporary line, which is useful for drawing area as mouse moves
    tempLabel?: THREE.Sprite; // used to store temporary label as mouse moves
    pointCount = 0; // used to store how many points user have been picked
    pointArray: THREE.Vector3[] = [];
    lastClickTime?: number; // save the last click time, in order to detect double click event

    cancleCallback: () => void; // callback function when user cancels the measurement
    startMeasureCallback: () => void; // callback function when user starts the measurement
    continueMeasureCallback: () => void; // callback function when user continues the measurement
    completeMeasureCallback: () => void; // callback function when user completes the measurement
    closeMeasureCallback: () => void; // callback function when user closes the measurement
    onHoverCallback: () => void; // callback function when user hovers on the object
    onUnhoverCallback: () => void; // callback function when user unhovers on the object

    constructor(
        renderer: THREE.WebGLRenderer,
        scene: THREE.Scene,
        camera: THREE.Camera,
        controls: CustomURDFDragControls,
        mode: MeasureMode = MeasureMode.Distance,
        cancleCallback = () => {},
        startMeasureCallback = () => {}, // 开始测量时的回调函数
        continueMeasureCallback = () => {}, // 继续测量时的回调函数
        completeMeasureCallback = () => {}, // 完成测量时的回调函数
        closeMeasureCallback = () => {}, // 取消测量时的回调函数
        onHoverCallback = () => {}, // 鼠标悬停在模型上的回调函数
        onUnhoverCallback = () => {} // 鼠标离开模型时的回调函数
    ) {
        this.mode = mode;
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;
        this.initDragControls();
        this.cancleCallback = cancleCallback;
        this.startMeasureCallback = startMeasureCallback;
        this.continueMeasureCallback = continueMeasureCallback;
        this.completeMeasureCallback = completeMeasureCallback;
        this.closeMeasureCallback = closeMeasureCallback;
        this.onHoverCallback = onHoverCallback;
        this.onUnhoverCallback = onUnhoverCallback;
    }

    get canvas(): HTMLCanvasElement {
        return this.renderer.domElement as HTMLCanvasElement;
    }

    /**
     * Starts the measurement
     */
    open() {
        // add mouse 'click' event, but do not trigger highlight for mouse drag event
        this.canvas.addEventListener("mousedown", this.mousedown);
        this.canvas.addEventListener("mousemove", this.mousemove);
        this.canvas.addEventListener("mouseup", this.mouseup);
        this.canvas.addEventListener("dblclick", this.dblclick);
        window.addEventListener("keydown", this.keydown);

        this.pointArray = [];
        this.raycaster = new THREE.Raycaster();

        // points are required for measuring distance, area and angle
        this.points = this.createPoints();
        this.scene.add(this.points);
        // polyline is required for measuring distance, area and angle
        this.polyline = this.createLine();
        this.scene.add(this.polyline);
        if (this.mode === MeasureMode.Area) {
            this.faces = this.createFaces();
            this.scene.add(this.faces);
        }
        this.isCompleted = false;
        this.renderer.domElement.style.cursor = "crosshair";

        this.startMeasureCallback();
    }

    /**
     * Ends the measurement
     */
    close() {
        this.canvas.removeEventListener("mousedown", this.mousedown);
        this.canvas.removeEventListener("mousemove", this.mousemove);
        this.canvas.removeEventListener("mouseup", this.mouseup);
        this.canvas.removeEventListener("dblclick", this.dblclick);
        window.removeEventListener("keydown", this.keydown);

        this.tempPoints && this.scene.remove(this.tempPoints);
        this.tempLine && this.scene.remove(this.tempLine);
        this.tempLineForArea && this.scene.remove(this.tempLineForArea);
        this.tempLabel && this.scene.remove(this.tempLabel);
        this.points && this.scene.remove(this.points);
        this.polyline && this.scene.remove(this.polyline);
        this.faces && this.scene.remove(this.faces);
        this.curve && this.scene.remove(this.curve);
        this.pointArray = [];
        this.raycaster = undefined;
        this.tempPoints = undefined;
        this.tempLine = undefined;
        this.tempLineForArea = undefined;
        this.tempLabel = undefined;
        this.points = undefined;
        this.polyline = undefined;
        this.renderer.domElement.style.cursor = "";
        this.clearDraggableObjects();

        this.closeMeasureCallback();
    }

    /**
     * Creates THREE.Points
     */
    private createPoints(pointCount = this.MAX_POINTS): THREE.Points {
        const geom = new THREE.BufferGeometry();
        const pos = new Float32Array(this.MAX_POINTS * 3); // 3 vertices per point
        geom.setAttribute("position", new THREE.BufferAttribute(pos, 3)); // the attribute name cannot be 'positions'!
        geom.setDrawRange(0, 0); // do not draw anything yet, otherwise it may draw a point by default
        const obj = new THREE.Points(geom, this.POINT_MATERIAL);
        obj.name = this.OBJ_NAME;
        return obj;
    }

    /**
     * Creates THREE.Line
     */
    private createLine(pointCount = this.MAX_POINTS): THREE.Line {
        const geom = new THREE.BufferGeometry();
        const pos = new Float32Array(pointCount * 3); // 3 vertices per point
        geom.setAttribute("position", new THREE.BufferAttribute(pos, 3)); // the attribute name cannot be 'positions'!
        const obj = new THREE.Line(geom, this.LINE_MATERIAL);
        obj.name = this.OBJ_NAME;
        return obj;
    }

    /**
     * Creates THREE.Mesh
     */
    private createFaces() {
        const geom = new THREE.BufferGeometry();
        const obj = new THREE.Mesh(geom, this.MESH_MATERIAL);
        obj.name = this.OBJ_NAME;
        return obj;
    }

    /**
     * Draw completed
     */
    complete(
        checkAndReload: boolean = false // 是否需要检查是否正常完成, 非正常完成则重新加载
    ) {
        if (this.isCompleted) {
            return; // avoid re-entry
        }
        let clearPoints = false;
        let clearPolyline = false;
        let reload = false;
        // for measure area, we need to make a close surface, then add area label
        const count = this.pointArray.length;
        if (this.mode === MeasureMode.Area && this.polyline) {
            if (count > 2) {
                const p0 = this.pointArray[0];
                const p1 = this.pointArray[1];
                const p2 = this.pointArray[count - 1];
                const dir1 = this.getAngleBisector(p1, p0, p2);
                const geom = this.polyline.geometry as any;
                const pos =
                    (geom.attributes && geom.attributes.position) || undefined;
                if (pos && count * 3 + 3 < this.MAX_POINTS) {
                    const i = count * 3;
                    pos.array[i] = p0.x;
                    pos.array[i + 1] = p0.y;
                    pos.array[i + 2] = p0.z;
                    geom.setDrawRange(0, count + 1);
                    pos.needsUpdate = true;
                }
                const area = this.calculateArea(this.pointArray);
                const label = `${this.numberToString(
                    area
                )} ${this.getUnitString()}`;
                // 将尺寸标签置于多边形的中心
                const position = new THREE.Vector3();
                for (let i = 0; i < count; i++) {
                    position.add(this.pointArray[i]);
                }
                position.divideScalar(count);
                this.addOrUpdateLabel(this.polyline, label, position);
            } else {
                clearPoints = true;
                clearPolyline = true;
                checkAndReload && (reload = true);
            }
        }
        if (this.mode === MeasureMode.Distance) {
            if (count < 2) {
                clearPoints = true;
                checkAndReload && (reload = true);
            }
        }
        if (this.mode === MeasureMode.Angle && this.polyline) {
            if (count >= 3) {
                const p0 = this.pointArray[0];
                const p1 = this.pointArray[1];
                const p2 = this.pointArray[2];
                const dir0 = new THREE.Vector3(
                    p0.x - p1.x,
                    p0.y - p1.y,
                    p0.z - p1.z
                ).normalize();
                const dir1 = this.getAngleBisector(p0, p1, p2);
                const dir2 = new THREE.Vector3(
                    p2.x - p1.x,
                    p2.y - p1.y,
                    p2.z - p1.z
                ).normalize();
                const angle = this.calculateAngle(p0, p1, p2);
                const label = `${this.numberToString(
                    angle
                )} ${this.getUnitString()}`;
                const distance = Math.min(p0.distanceTo(p1), p2.distanceTo(p1));
                let d = distance * 0.4; // distance from label to p1
                let position = p1
                    .clone()
                    .add(new THREE.Vector3(dir1.x * d, dir1.y * d, dir1.z * d));
                this.addOrUpdateLabel(this.polyline, label, position);

                d = distance * 0.2; // distance from curve to p1
                const arcP0 = p1
                    .clone()
                    .add(new THREE.Vector3(dir0.x * d, dir0.y * d, dir0.z * d));
                const arcP2 = p1
                    .clone()
                    .add(new THREE.Vector3(dir2.x * d, dir2.y * d, dir2.z * d));
                position = p1
                    .clone()
                    .add(new THREE.Vector3(dir1.x * d, dir1.y * d, dir1.z * d));
                this.curve = this.createCurve(arcP0, position, arcP2);
                this.scene.add(this.curve);
            } else {
                clearPoints = true;
                clearPolyline = true;
                checkAndReload && (reload = true);
            }
        }
        // invalid case, clear useless objects
        if (clearPoints && this.points) {
            this.scene.remove(this.points);
            this.points = undefined;
        }
        if (clearPolyline && this.polyline) {
            this.scene.remove(this.polyline);
            this.polyline = undefined;
        }
        // make labels draggable
        if (this.polyline) {
            this.polyline.traverse((object) => {
                if (object.name === this.LABEL_NAME) {
                    this.addDraggableObjects(object);
                }
            });
        }
        this.isCompleted = true;
        this.renderer.domElement.style.cursor = "";
        this.tempPoints && this.scene.remove(this.tempPoints);
        this.tempLine && this.scene.remove(this.tempLine);
        this.tempLineForArea && this.scene.remove(this.tempLineForArea);

        this.completeMeasureCallback();

        if (reload) {
            // 如果没有正常完成, 则重新加载
            this.cancel();
            this.open();
        }
    }

    /**
     * Draw canceled
     */
    cancel() {
        this.cancleCallback();
        this.close();
    }

    mousedown = (e: MouseEvent) => {
        this.mouseMoved = false;
    };

    mousemove = (e: MouseEvent) => {
        this.mouseMoved = true;

        const point = this.getClosestIntersection(e); // 获取垂直屏幕过鼠标点的线与模型最近的交点
        if (!point) {
            // 没有交点, 则清除临时点和线
            this.tempPoints && this.scene.remove(this.tempPoints);
            this.tempLine && this.scene.remove(this.tempLine);
            this.tempLineForArea && this.scene.remove(this.tempLineForArea);
            this.tempPoints = undefined;
            this.tempLine = undefined;
            this.tempLineForArea = undefined;

            this.onUnhoverCallback();
            return;
        }
        this.onHoverCallback();

        // draw the temp point as mouse moves
        const points = this.tempPoints || this.createPoints(1);
        const geom = points.geometry as any;
        const pos = (geom.attributes && geom.attributes.position) || undefined;
        if (pos) {
            let i = 0;
            pos.array[i++] = point.x;
            pos.array[i++] = point.y;
            pos.array[i++] = point.z;
            geom.setDrawRange(0, 1);
            pos.needsUpdate = true;
        }
        if (!this.tempPoints) {
            this.scene.add(points); // just add to scene once
            this.tempPoints = points;
        }

        // store the first point into tempLine
        if (this.mode === MeasureMode.Area && this.pointArray.length > 0) {
            const line = this.tempLine || this.createLine(3);
            const geom = line.geometry as any;
            const pos =
                (geom.attributes && geom.attributes.position) || undefined;
            if (pos) {
                let i = 6; // store the first point as the third point (a bit tricky here)
                pos.array[i++] = this.pointArray[0].x;
                pos.array[i++] = this.pointArray[0].y;
                pos.array[i++] = this.pointArray[0].z;
            }
        }
        // draw the temp line as mouse moves
        if (this.pointArray.length > 0) {
            const p0 = this.pointArray[this.pointArray.length - 1]; // get last point
            const line = this.tempLine || this.createLine(3);
            line.computeLineDistances(); // LineDashedMaterial requires to call this
            const geom = line.geometry as any;
            const pos =
                (geom.attributes && geom.attributes.position) || undefined;
            if (pos) {
                let i = 0;
                pos.array[i++] = p0.x;
                pos.array[i++] = p0.y;
                pos.array[i++] = p0.z;
                pos.array[i++] = point.x;
                pos.array[i++] = point.y;
                pos.array[i++] = point.z;
                const range =
                    this.mode === MeasureMode.Area &&
                    this.pointArray.length >= 2
                        ? 3
                        : 2;
                geom.setDrawRange(0, range);
                pos.needsUpdate = true;
            }
            // 在测量距离模式下, 添加距离标签
            if (
                this.mode === MeasureMode.Distance &&
                this.pointArray.length > 0
            ) {
                const dist = p0.distanceTo(point);
                const label = `${this.numberToString(
                    dist
                )} ${this.getUnitString()}`; // hard code unit to 'm' here
                const position = new THREE.Vector3(
                    (point.x + p0.x) / 2,
                    (point.y + p0.y) / 2,
                    (point.z + p0.z) / 2
                );
                this.addOrUpdateLabel(line, label, position);
            }
            if (!this.tempLine) {
                this.scene.add(line); // just add to scene once
                this.tempLine = line;
            }
        }
    };

    mouseup = (e: MouseEvent) => {
        // if mouseMoved is ture, then it is probably moving, instead of clicking
        if (!this.mouseMoved) {
            this.onMouseClicked(e);
        }
    };

    dblclick = (e: MouseEvent) => {
        // double click means to complete the draw operation
        this.complete(true);
    };

    onMouseClicked = (e: MouseEvent) => {
        if (!this.raycaster || !this.camera || !this.scene) {
            return;
        }

        // if the draw is completed, then re-open it
        if (this.isCompleted) {
            this.close();
            this.open();
            return;
        }

        const point = this.getClosestIntersection(e); // 获取垂直屏幕过鼠标点的线与模型最近的交点
        if (!point) {
            return;
        }

        // double click triggers two click events, we need to avoid the second click here
        const now = Date.now();
        if (this.lastClickTime && now - this.lastClickTime < 500) {
            return;
        }
        this.lastClickTime = now;

        const count = this.pointArray.length;
        if (this.points) {
            const geom = this.points.geometry as any;
            const pos =
                (geom.attributes && geom.attributes.position) || undefined;
            if (pos && count * 3 + 3 < this.MAX_POINTS) {
                const i = count * 3;
                pos.array[i] = point.x;
                pos.array[i + 1] = point.y;
                pos.array[i + 2] = point.z;
                geom.setDrawRange(0, count + 1);
                pos.needsUpdate = true;
            }
        }
        if (
            (this.mode === MeasureMode.Distance ||
                this.mode === MeasureMode.Area ||
                this.mode === MeasureMode.Angle) &&
            this.polyline
        ) {
            const geom = this.polyline.geometry as any;
            const pos =
                (geom.attributes && geom.attributes.position) || undefined;
            if (pos && count * 3 + 3 < this.MAX_POINTS) {
                const i = count * 3;
                pos.array[i] = point.x;
                pos.array[i + 1] = point.y;
                pos.array[i + 2] = point.z;
                geom.setDrawRange(0, count + 1);
                pos.needsUpdate = true;
                if (this.tempLabel) {
                    // also add text for the line
                    this.polyline.add(this.tempLabel);
                }
            } else {
                console.error(
                    "Failed to get attributes.position, or number of points exceeded MAX_POINTS!"
                );
            }
            this.polyline.computeLineDistances(); // LineDashedMaterial requires to call this
        }
        if (this.mode === MeasureMode.Area && this.faces) {
            const geom = this.faces.geometry as THREE.BufferGeometry;

            // 获取当前顶点数据
            let positions = geom.getAttribute("position");
            let positionArray: number[] = [];

            if (positions) {
                positionArray = Array.from(positions.array);
            }

            // 添加新的点
            positionArray.push(point.x, point.y, point.z);

            // 更新 BufferGeometry 中的 position attribute
            const newPositions = new Float32Array(positionArray);
            geom.setAttribute(
                "position",
                new THREE.BufferAttribute(newPositions, 3)
            );

            // 如果有足够的顶点来创建一个面
            const len = newPositions.length / 3;
            if (len > 2) {
                // 获取现有的索引数据
                let indices: number[] = [];
                if (geom.index) {
                    indices = Array.from(geom.index.array);
                }

                // 添加新面
                indices.push(0, len - 2, len - 1);

                // 更新 BufferGeometry 中的索引
                geom.setIndex(indices);

                // 重新计算法线
                geom.computeVertexNormals();
            }

            geom.attributes.position.needsUpdate = true; // 标记需要更新位置属性
        }
        // If there is point added, then increase the count. Here we use one counter to count both points and line geometry.
        this.pointArray.push(point);

        this.continueMeasureCallback();

        // 测量角度时, 只需要 3 个点
        if (this.mode === MeasureMode.Angle && this.pointArray.length >= 3) {
            this.complete();
        }
    };

    keydown = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
            this.complete();
        } else if (e.key === "Escape") {
            this.cancel();
        }
    };

    /**
     * 获取垂直屏幕过鼠标点的线与模型最近的交点
     * @param e
     */
    getClosestIntersection = (e: MouseEvent) => {
        if (
            !this.raycaster ||
            !this.camera ||
            !this.scene ||
            this.isCompleted
        ) {
            return;
        }
        const x = e.clientX;
        const y = e.clientY;
        const mouse = new THREE.Vector2();
        mouse.x = (x / this.renderer.domElement.clientWidth) * 2 - 1; // must use clientWidth rather than width here!
        mouse.y = -(y / this.renderer.domElement.clientHeight) * 2 + 1;

        this.raycaster.setFromCamera(mouse, this.camera);
        let intersects = this.raycaster.intersectObject(this.scene, true) || [];
        if (intersects && intersects.length > 0) {
            // filter out the objects for measurement
            intersects = intersects.filter(
                (item) => item.object.name !== this.OBJ_NAME
            );
            if (
                intersects.length > 0 &&
                intersects[0].distance < this.MAX_DISTANCE
            ) {
                return intersects[0].point;
            }
        }
        return null;
    };

    /**
     * Adds or update label
     */
    addOrUpdateLabel(
        obj: THREE.Object3D,
        label: string,
        position: THREE.Vector3
    ) {
        if (this.tempLabel) {
            // we have to remove the old text and create a new one, threejs doesn't support to change it dynamically
            obj.remove(this.tempLabel);
        }

        this.tempLabel = this.createLabel(label, position);
        obj.add(this.tempLabel);
    }

    /**
     * Creates label with proper style
     */
    createLabel(label: string, position: THREE.Vector3) {
        // 创建文本并设置其位置
        const scale = 1; // 用于让文本更清晰, 越大越清晰
        const spriteMaterial = new THREE.SpriteMaterial({
            map: createTextTexture(label, scale),
            transparent: true,
            sizeAttenuation: false,
            depthTest: false,
            depthWrite: false,
        });
        const obj = new THREE.Sprite(spriteMaterial);
        obj.raycast = () => {}; // disable raycast
        obj.scale.set(0.1, 0.05, 1.0);
        obj.position.copy(position);
        obj.name = this.LABEL_NAME;
        return obj;
    }

    /**
     * Creates the arc curve to indicate the angle in degree
     */
    createCurve(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3) {
        const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
        const points = curve.getPoints(4); // get points
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const obj = new THREE.Line(geometry, this.LINE_MATERIAL);
        obj.name = this.LABEL_NAME;
        return obj;
    }

    /**
     * Calculates area
     * TODO: for concave polygon, the value doesn't right, need to fix it
     * @param points
     */
    calculateArea(points: THREE.Vector3[]) {
        let area = 0;
        for (let i = 0, j = 1, k = 2; k < points.length; j++, k++) {
            const a = points[i].distanceTo(points[j]);
            const b = points[j].distanceTo(points[k]);
            const c = points[k].distanceTo(points[i]);
            const p = (a + b + c) / 2;
            area += Math.sqrt(p * (p - a) * (p - b) * (p - c));
        }
        return area;
    }

    /**
     * Gets included angle of two lines in degree
     */
    calculateAngle(
        startPoint: THREE.Vector3,
        middlePoint: THREE.Vector3,
        endPoint: THREE.Vector3
    ) {
        const p0 = startPoint;
        const p1 = middlePoint;
        const p2 = endPoint;
        const dir0 = new THREE.Vector3(p0.x - p1.x, p0.y - p1.y, p0.z - p1.z);
        const dir1 = new THREE.Vector3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
        const angle = dir0.angleTo(dir1);
        return (angle * 180) / Math.PI; // convert to degree
    }

    /**
     * Gets angle bisector of two lines
     */
    getAngleBisector(
        startPoint: THREE.Vector3,
        middlePoint: THREE.Vector3,
        endPoint: THREE.Vector3
    ): THREE.Vector3 {
        const p0 = startPoint;
        const p1 = middlePoint;
        const p2 = endPoint;
        const dir0 = new THREE.Vector3(
            p0.x - p1.x,
            p0.y - p1.y,
            p0.z - p1.z
        ).normalize();
        const dir2 = new THREE.Vector3(
            p2.x - p1.x,
            p2.y - p1.y,
            p2.z - p1.z
        ).normalize();
        return new THREE.Vector3(
            dir0.x + dir2.x,
            dir0.y + dir2.y,
            dir0.z + dir2.z
        ).normalize(); // the middle direction between dir0 and dir2
    }

    /**
     * Gets unit string for distance, area or angle
     */
    getUnitString() {
        if (this.mode === MeasureMode.Distance) {
            return "m";
        }
        if (this.mode === MeasureMode.Area) {
            return "m²";
        }
        if (this.mode === MeasureMode.Angle) {
            return "°";
        }
        return "";
    }

    /**
     * Converts a number to a string with proper fraction digits
     */
    numberToString(num: number) {
        if (num < 0.0001) {
            return num.toString();
        }
        let fractionDigits = 2;
        if (num < 0.01) {
            fractionDigits = 4;
        } else if (num < 0.1) {
            fractionDigits = 3;
        }
        return num.toFixed(fractionDigits);
    }

    /**
     * Initialize drag control
     * Enables user to drag the label in case it is blocked by other objects
     */
    initDragControls() {
        const dc = new DragControls([], this.camera, this.renderer.domElement);
        // @ts-ignore
        dc.addEventListener("dragstart", (event: Event) => {
            this.controls.enabled = false;
        });
        // dragControls.addEventListener('drag', (event) => { console.log('dragging') })
        // @ts-ignore
        dc.addEventListener("dragend", (event: Event) => {
            this.controls.enabled = true;
        });
        this.dragControls = dc;
    }

    addDraggableObjects(objects: THREE.Object3D) {
        if (this.dragControls) {
            this.dragControls.objects.push(objects);
        }
    }

    clearDraggableObjects() {
        if (this.dragControls) {
            const objects = this.dragControls.objects;
            objects.splice(0, objects.length);
        }
    }
}
