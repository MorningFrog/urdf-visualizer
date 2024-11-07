import * as THREE from "three";
const {
    OrbitControls,
} = require("three/examples/jsm/controls/OrbitControls.js");
const { DragControls } = require("three/examples/jsm/controls/DragControls.js");
const {
    FontLoader,
    Font,
} = require("three/examples/jsm/loaders/FontLoader.js");
const {
    TextGeometry,
} = require("three/examples/jsm/geometries/TextGeometry.js");

export enum MeasureMode {
    Distance = "Distance",
    Area = "Area",
    Angle = "Angle",
}

export default class Measure {
    readonly LINE_MATERIAL = new THREE.LineBasicMaterial({
        color: 0xff0000,
        linewidth: 3,
        opacity: 0.8,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
    });
    readonly POINT_MATERIAL = new THREE.PointsMaterial({
        color: 0xff5000,
        size: 1,
        opacity: 0.6,
        transparent: true,
        depthWrite: false,
        depthTest: false,
    });
    readonly MESH_MATERIAL = new THREE.MeshBasicMaterial({
        color: 0x87cefa,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
    });
    readonly MAX_POINTS = 100; // TODO: better to remove this limitation
    readonly MAX_DISTANCE = 500; // when intersected object's distance is too far away, then ignore it
    readonly OBJ_NAME = "object_for_measure";
    readonly LABEL_NAME = "label_for_measure";

    mode: MeasureMode;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
    controls: typeof OrbitControls;
    dragControls?: typeof DragControls; // enable objects(labels) to be dragged
    raycaster?: THREE.Raycaster;
    font?: typeof Font;
    mouseMoved = false;
    isCompleted = false;
    points?: THREE.Points; // used for measure distance and area
    polyline?: THREE.Line; // the line user draws while measuring distance
    faces?: THREE.Mesh; // the faces user draws while measuring area
    curve?: THREE.Line; // the arc curve to indicate the angle in degree
    tempPoints?: THREE.Points; // used to store temporary Points
    tempLine?: THREE.Line; // used to store temporary line, which is useful for drawing line as mouse moves
    tempLineForArea?: THREE.Line; // used to store temporary line, which is useful for drawing area as mouse moves
    tempLabel?: THREE.Mesh; // used to store temporary label as mouse moves
    pointCount = 0; // used to store how many points user have been picked
    pointArray: THREE.Vector3[] = [];
    fontSize?: number = 0; // used to dymanically calculate a font size
    tempFontSize?: number = 0; // used to dymanically calculate a font size
    lastClickTime?: number; // save the last click time, in order to detect double click event

    constructor(
        renderer: THREE.WebGLRenderer,
        scene: THREE.Scene,
        camera: THREE.Camera,
        controls: typeof OrbitControls,
        mode: MeasureMode = MeasureMode.Distance
    ) {
        this.mode = mode;
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;
        this.loadFont();
        this.initDragControls();
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
        this.fontSize = 0;
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
        this.points && this.scene.remove(this.points);
        this.polyline && this.scene.remove(this.polyline);
        this.faces && this.scene.remove(this.faces);
        this.curve && this.scene.remove(this.curve);
        this.pointArray = [];
        this.raycaster = undefined;
        this.tempPoints = undefined;
        this.tempLine = undefined;
        this.tempLineForArea = undefined;
        this.points = undefined;
        this.polyline = undefined;
        this.fontSize = 0;
        this.renderer.domElement.style.cursor = "";
        this.clearDraggableObjects();
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
    complete() {
        if (this.isCompleted) {
            return; // avoid re-entry
        }
        let clearPoints = false;
        let clearPolyline = false;
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
                const distance = p1.distanceTo(p0);
                const d = distance * 0.4; // distance from label to p0
                const position = p0
                    .clone()
                    .add(new THREE.Vector3(dir1.x * d, dir1.y * d, dir1.z * d));
                this.addOrUpdateLabel(
                    this.polyline,
                    label,
                    position,
                    dir1,
                    distance
                );
            } else {
                clearPoints = true;
                clearPolyline = true;
            }
        }
        if (this.mode === MeasureMode.Distance) {
            if (count < 2) {
                clearPoints = true;
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
                const d = distance * 0.2; // distance from label to p1
                const position = p1
                    .clone()
                    .add(new THREE.Vector3(dir1.x * d, dir1.y * d, dir1.z * d));
                this.addOrUpdateLabel(
                    this.polyline,
                    label,
                    position,
                    dir1,
                    distance
                );

                const arcP0 = p1
                    .clone()
                    .add(new THREE.Vector3(dir0.x * d, dir0.y * d, dir0.z * d));
                const arcP2 = p1
                    .clone()
                    .add(new THREE.Vector3(dir2.x * d, dir2.y * d, dir2.z * d));
                this.curve = this.createCurve(arcP0, position, arcP2);
                this.scene.add(this.curve);
            } else {
                clearPoints = true;
                clearPolyline = true;
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
        this.fontSize = 0;
    }

    /**
     * Draw canceled
     */
    cancel() {
        this.close();
    }

    mousedown = (e: MouseEvent) => {
        this.mouseMoved = false;
    };

    mousemove = (e: MouseEvent) => {
        this.mouseMoved = true;

        const point = this.getClosestIntersection(e);
        if (!point) {
            return;
        }

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
            if (this.mode === MeasureMode.Distance) {
                const dist = p0.distanceTo(point);
                const label = `${this.numberToString(
                    dist
                )} ${this.getUnitString()}`; // hard code unit to 'm' here
                const position = new THREE.Vector3(
                    (point.x + p0.x) / 2,
                    (point.y + p0.y) / 2,
                    (point.z + p0.z) / 2
                );
                const direction = new THREE.Vector3(
                    point.x - p0.x,
                    point.y - p0.y,
                    point.z - p0.z
                ).normalize();
                this.addOrUpdateLabel(
                    line,
                    label,
                    position,
                    direction,
                    point.distanceTo(p0)
                );
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
        this.complete();
    };

    onMouseClicked = (e: MouseEvent) => {
        if (
            !this.raycaster ||
            !this.camera ||
            !this.scene ||
            this.isCompleted
        ) {
            return;
        }

        const point = this.getClosestIntersection(e);
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
                if (this.fontSize === 0) {
                    this.fontSize = this.tempFontSize;
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
     * The the closest intersection
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
     * Loads font
     */
    loadFont() {
        new FontLoader().load(
            "media/fonts/helvetiker_regular.typeface.json",
            (font: typeof Font) => {
                this.font = font;
            }
        );
    }

    /**
     * Adds or update label
     */
    addOrUpdateLabel(
        obj: THREE.Object3D,
        label: string,
        position: THREE.Vector3,
        direction: THREE.Vector3,
        distance: number
    ) {
        if (!this.font) {
            console.warn("Font is not loaded yet!");
            return;
        }
        if (this.tempLabel) {
            // we have to remvoe the old text and create a new one, threejs doesn't support to change it dynamically
            obj.remove(this.tempLabel);
        }
        // make font size between 0.5 - 5
        // And, once font size is settled, all labels should have the same size
        let fontSize = this.fontSize;
        if (fontSize === 0) {
            fontSize = distance / 40;
            fontSize = Math.max(0.5, fontSize);
            fontSize = Math.min(5, fontSize);
            this.tempFontSize = fontSize;
        }
        this.tempLabel = this.createLabel(this.font, label, fontSize);
        const axisX = new THREE.Vector3(1, 0, 0);
        const axisY = new THREE.Vector3(0, 1, 0);
        const dirXZ = direction.clone().setY(0); // direction on XZ plane
        let angle = dirXZ.angleTo(axisX); // in XZ plane, the angle to x-axis
        if (dirXZ.z > 0) {
            angle = -angle;
        }
        this.tempLabel.rotateOnAxis(axisY, angle);
        this.tempLabel.position.set(position.x, position.y, position.z);
        obj.add(this.tempLabel);
    }

    /**
     * Creates label with proper style
     */
    createLabel(font: typeof Font, label: string, size?: number) {
        const textGeom = new TextGeometry(label, {
            font: font,
            size: size,
            height: (size || 0) / 3,
            curveSegments: 1,
            bevelEnabled: false,
            bevelThickness: 0,
            bevelSize: 0,
            bevelSegments: 1,
        });
        const textMat = new THREE.MeshNormalMaterial({
            flatShading: false,
            transparent: true,
            opacity: 0.6,
        });
        const obj = new THREE.Mesh(textGeom, textMat);
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
        dc.addEventListener("dragstart", (event: Event) => {
            this.controls.enabled = false;
        });
        // dragControls.addEventListener('drag', (event) => { console.log('dragging') })
        dc.addEventListener("dragend", (event: Event) => {
            this.controls.enabled = true;
        });
        this.dragControls = dc;
    }

    addDraggableObjects(objects: THREE.Object3D) {
        if (this.dragControls) {
            this.dragControls.getObjects().push(objects);
        }
    }

    clearDraggableObjects() {
        if (this.dragControls) {
            const objects = this.dragControls.getObjects();
            objects.splice(0, objects.length);
        }
    }
}
