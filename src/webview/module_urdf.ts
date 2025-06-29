/* URDF 加载模块 */

import { vscode } from "./vscode_api";

import * as THREE from "three";
import { LoadingManager } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import URDFLoader from "urdf-loader";
import {
    URDFRobot,
    URDFJoint,
    URDFVisual,
    URDFLink,
    URDFCollider,
} from "urdf-loader";
import { LinkAxesHelper, JointAxesHelper } from "./threejs_tools";

// 导入自定义URDFDragControls
import { CustomURDFDragControls } from "./CustomURDFDragControls";

export class ModuleURDF {
    scene: THREE.Scene; // 场景
    camera: THREE.PerspectiveCamera; // 相机

    // HTML 元素
    showWorldFrameToggle = document.getElementById(
        "show-world-frame"
    ) as HTMLInputElement;
    showJointsToggle = document.getElementById(
        "show-joints"
    ) as HTMLInputElement;
    showLinksToggle = document.getElementById("show-links") as HTMLInputElement;
    showVisualToggle = document.getElementById(
        "show-visual"
    ) as HTMLInputElement;
    showCollisionToggle = document.getElementById(
        "show-collision"
    ) as HTMLInputElement;
    jointSizeInput = document.getElementById("joint-size") as HTMLInputElement;
    linkSizeInput = document.getElementById("link-size") as HTMLInputElement;

    // 默认碰撞体材料
    collisionMaterial = new THREE.MeshPhongMaterial({
        transparent: true,
        opacity: 0.35,
        shininess: 2.5,
        premultipliedAlpha: true,
        color: 0xffbe38,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
    });

    axesHelper: THREE.AxesHelper; // 世界坐标系

    // mesh文件加载器
    manager = new LoadingManager();
    loaderURDF = new URDFLoader(this.manager);
    loaderGLTF = new GLTFLoader(this.manager);
    loaderOBJ = new OBJLoader(this.manager);
    loaderCollada = new ColladaLoader(this.manager);
    loaderSTL = new STLLoader(this.manager);

    // 正在加载的 mesh 数量
    numMeshLoading = 0;
    // URDF 文本
    urdfText = "";
    // 机器人
    robot: URDFRobot | null = null;
    // 显示关节轴
    jointAxes: { [key: string]: JointAxesHelper } = {};
    jointAxesSize = 1.0;
    // 显示link坐标系
    linkAxes: { [key: string]: LinkAxesHelper } = {};
    linkAxesSize = 1.0;
    // 是否显示 visual 和 collision
    showVisual = true;
    showCollision = false;
    // 是否刷新视野
    resetCamera = false;

    // 资源路径前缀
    uriPrefix: string;

    controls: OrbitControls; // 控制器

    // URDFDragControls
    dragControls: CustomURDFDragControls;

    waitInterval = 5; // 等待间隔

    renderCallback: () => void; // 渲染回调
    modelHoverCallback: () => void; // 鼠标悬停模型回调
    modelUnhoverCallback: () => void; // 鼠标移出模型回调

    constructor(
        scene: THREE.Scene, // 场景
        camera: THREE.PerspectiveCamera, // 相机
        controls: OrbitControls, // 控制器
        renderer: THREE.WebGLRenderer, // 渲染器
        uriPrefix: string, // 资源路径前缀
        renderCallback = () => {},
        modelHoverCallback = () => {},
        modelUnhoverCallback = () => {}
    ) {
        // 确保所有元素都已加载
        if (
            !this.showJointsToggle ||
            !this.showLinksToggle ||
            !this.showVisualToggle ||
            !this.showCollisionToggle ||
            !this.jointSizeInput ||
            !this.linkSizeInput
        ) {
            throw new Error("Element not found");
        }

        this.scene = scene;
        this.camera = camera;
        this.controls = controls;
        this.uriPrefix = uriPrefix;
        this.renderCallback = renderCallback;
        this.modelHoverCallback = modelHoverCallback;
        this.modelUnhoverCallback = modelUnhoverCallback;
        // 设置ROS功能包所在的目录
        this.loaderURDF.packages = {};
        // 解析visual和collison
        this.loaderURDF.parseCollision = true;
        this.loaderURDF.parseVisual = true;

        // 设置 manager 报错时的处理
        this.manager.onError = (url: string) => {
            // 删除 url 中 `vscode-cdn.net` 及其之前的部分
            const url_parts = url.split("vscode-cdn.net");
            if (url_parts.length > 1) {
                url = url_parts[1];
            }
            vscode.postMessage({
                type: "error",
                message: `Failed to load ${url}`,
            });
        };

        // 设置资源处理函数
        this.manager.setURLModifier((url: string): string => {
            // 删除其中的 `file://`
            url = url.replace("file://", "");
            // 替换其中的 `\` 为 `/`
            url = url.replace(/\\/g, "/");
            // 对于 Windows 系统, 添加 `/` 前缀
            if (!url.startsWith("/")) {
                url = "/" + url;
            }
            // 如果出现两个 `//` 忽略第一个 `/` 前的所有内容
            const doubleSlashIndex = url.indexOf("//");
            if (doubleSlashIndex !== -1) {
                url = url.slice(doubleSlashIndex + 1);
            }
            // console.log("url", url);
            return this.uriPrefix + url;
        });

        this.dragControls = new CustomURDFDragControls(
            scene,
            camera,
            controls,
            renderer.domElement,
            (joint: URDFJoint, angle: number) =>
                this.updateJointCallback(joint, angle),
            (joint: URDFJoint | null, link: URDFLink | null) =>
                this.onHoverCallback(joint, link),
            (joint: URDFJoint | null, link: URDFLink | null) =>
                this.onUnhoverCallback(joint, link)
        );

        // 创建坐标系
        this.axesHelper = new THREE.AxesHelper(1); // 1 是坐标轴的长度
        this.axesHelper.layers.set(1);
        this.axesHelper.visible = this.showWorldFrameToggle.checked;
        this.scene.add(this.axesHelper);

        // 设置 mesh 处理函数
        this.loaderURDF.loadMeshCb = (
            path: string,
            manager: LoadingManager,
            onComplete: (mesh: THREE.Object3D, err?: Error) => void
        ) => {
            this.numMeshLoading += 1;
            const webview_path = path;
            // 扩展名
            const ext = webview_path?.split(/\./g)?.pop()?.toLowerCase();
            switch (ext) {
                case "gltf":
                case "glb":
                    this.loaderGLTF.load(
                        webview_path,
                        (result: any) => {
                            onComplete(result.scene);
                            this.numMeshLoading -= 1;
                        },
                        // @ts-ignore
                        null,
                        (err: Error) => {
                            // @ts-ignore
                            onComplete(null, err);
                            this.numMeshLoading -= 1;
                        }
                    );
                    break;
                case "obj":
                    this.loaderOBJ.load(
                        webview_path,
                        (result: any) => {
                            onComplete(result);
                            this.numMeshLoading -= 1;
                        },
                        // @ts-ignore
                        null,
                        (err: Error) => {
                            // @ts-ignore
                            onComplete(null, err);
                            this.numMeshLoading -= 1;
                        }
                    );
                    break;
                case "dae":
                    this.loaderCollada.load(
                        webview_path,
                        (result: any) => {
                            onComplete(result.scene);
                            this.numMeshLoading -= 1;
                        },
                        // @ts-ignore
                        null,
                        (err: Error) => {
                            // @ts-ignore
                            onComplete(null, err);
                            this.numMeshLoading -= 1;
                        }
                    );
                    break;
                case "stl":
                    this.loaderSTL.load(
                        webview_path,
                        (result: any) => {
                            const material = new THREE.MeshPhongMaterial();
                            const mesh = new THREE.Mesh(result, material);
                            onComplete(mesh);
                            this.numMeshLoading -= 1;
                        },
                        // @ts-ignore
                        null,
                        (err: Error) => {
                            // @ts-ignore
                            onComplete(null, err);
                            this.numMeshLoading -= 1;
                        }
                    );
                    break;
            }
        };

        this.showWorldFrameToggle.addEventListener("change", () => {
            this.axesHelper.visible = this.showWorldFrameToggle.checked;
            this.render();
        });

        this.showJointsToggle.addEventListener("change", () => {
            this.loadJointAxes();
            this.render();
        });

        this.showLinksToggle.addEventListener("change", () => {
            this.loadLinkAxes();
            this.render();
        });

        this.showVisualToggle.addEventListener("change", () => {
            // @ts-ignore
            this.showVisual = this.showVisualToggle.checked;
            this.showVisualCollison();
        });

        this.showCollisionToggle.addEventListener("change", () => {
            // @ts-ignore
            this.showCollision = this.showCollisionToggle.checked;
            this.showVisualCollison();
        });

        this.jointSizeInput.addEventListener("input", () => {
            // @ts-ignore
            const size = parseFloat(this.jointSizeInput.value);
            this.jointAxesSize = size;
            Object.values(this.jointAxes).forEach((joint) => {
                joint.setSize(size);
            });
            this.render();
        });

        this.linkSizeInput.addEventListener("input", () => {
            // @ts-ignore
            const size = parseFloat(this.linkSizeInput.value);
            this.linkAxesSize = size;
            Object.values(this.linkAxes).forEach((link) => {
                link.setSize(size);
            });
            this.render();
        });
    }

    /**
     * 处理拖动导致的关节角度变化
     */
    updateJointCallback(joint: URDFJoint, angle: number) {
        const joint_name = joint.name;
        const joint_name_processed = this.postprocessIdAndClass(joint_name);
        const slider = document.getElementById(
            `slider_joint_${joint_name_processed}`
        ) as HTMLInputElement;
        if (slider) {
            slider.value = angle.toString();
        }
    }

    /**
     * 处理 id 和 class, 将其中的 `/` 替换为 `__`
     * @param str
     */
    public postprocessIdAndClass(str: string) {
        return str.replace(/\//g, "__");
    }

    // 等待所有 mesh 加载完成
    waitForNumMeshLoadingToZero(max_wait_time = 5000) {
        return new Promise((resolve) => {
            const interval = setInterval(() => {
                max_wait_time -= this.waitInterval;
                if (this.numMeshLoading <= 0 || max_wait_time <= 0) {
                    clearInterval(interval);
                    resolve(null);
                }
            }, this.waitInterval); // 每 waitInterval 毫秒检查一次
        });
    }

    // 删除机器人
    removeRobot() {
        if (this.robot) {
            this.scene.remove(this.robot);
            this.robot = null;
            this.jointAxes = {};
        }
    }

    // 加载 URDF
    public async LoadURDF() {
        // 删除旧机器人
        this.removeRobot();
        // 解析 URDF
        this.robot = this.loaderURDF.parse(this.urdfText);
        // 添加到场景
        this.scene.add(this.robot);

        // 等待所有 mesh 加载完成
        await this.waitForNumMeshLoadingToZero();
        this.numMeshLoading = 0;

        // 为 collider 设置默认材质
        this.robot.traverse(
            // @ts-ignore
            (child: URDFLink | URDFCollider | URDFVisual | THREE.Mesh) => {
                // @ts-ignore
                if (child.isURDFCollider) {
                    // @ts-ignore
                    child.traverse((c: THREE.Mesh) => {
                        c.material = this.collisionMaterial;
                        c.castShadow = false;
                    });
                }
            }
        );
        // 处理 Visual 和 Collision 的显示
        this.showVisualCollison();

        // 设置视野
        this.resetCameraView();

        // this.robot.updateMatrixWorld(true);

        // 添加 joint 坐标系
        this.loadJointAxes();
        // 添加 link 坐标系
        this.loadLinkAxes();
    }

    /**
     * 处理重置视野
     */
    resetCameraView() {
        if (!this.resetCamera) {
            return;
        }
        // 1. 计算物体的包围盒
        // @ts-ignore
        const box = new THREE.Box3().setFromObject(this.robot);

        // 2. 获取包围盒的中心和尺寸
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size); // 获取物体的大小
        box.getCenter(center); // 获取物体的中心

        // 3. 计算包围盒对角线长度,用于确定摄像机的合适距离
        const maxSize = Math.max(size.x, size.y, size.z);
        const distance =
            maxSize / (2 * Math.tan((this.camera.fov * Math.PI) / 360)); // 摄像机距离
        const offset = 1.0; // 添加偏移量,确保物体完全在视野内

        // 4. 设置摄像机位置并使其看向物体的中心
        this.camera.position.set(
            center.x + distance * offset,
            center.y + distance * offset,
            center.z + distance * offset
        );
        this.camera.lookAt(center);

        // 5. 更新摄像机的投影矩阵
        this.camera.updateProjectionMatrix();

        // 6. 设置OrbitControls的目标为物体中心
        this.controls.target.set(center.x, center.y, center.z);

        // 7. 更新OrbitControls
        this.controls.update();

        // 8. 清除重置视野标志
        this.resetCamera = false;

        // 重设坐标系尺寸
        const max_coord = Math.max(box.max.x, box.max.y, box.max.z) * 1.5;
        this.axesHelper.scale.set(max_coord, max_coord, max_coord);
    }

    /**
     * 处理 Joint 坐标系显示
     */
    loadJointAxes() {
        Object.entries<URDFJoint>(this.robot?.joints || {}).forEach(
            ([joint_name, joint]) => {
                if (joint.jointType === "fixed") {
                    return;
                }
                // @ts-ignore
                if (this.showJointsToggle.checked) {
                    // 显示 joint 坐标系

                    const axes = new JointAxesHelper(
                        this.jointAxesSize,
                        joint.axis
                    );
                    axes.setLayer(1); // 让 axes 不被 Raycaster 检测到
                    this.jointAxes[joint_name] = axes;
                    // @ts-ignore
                    joint.add(axes);
                } else {
                    // 隐藏 joint 坐标系

                    if (this.jointAxes[joint_name]) {
                        // @ts-ignore
                        joint.remove(this.jointAxes[joint_name]);
                        delete this.jointAxes[joint_name];
                    }
                }
            }
        );
    }

    /**
     * 处理 link 坐标系显示
     */
    loadLinkAxes() {
        Object.entries<URDFLink>(this.robot?.links || {}).forEach(
            ([link_name, link]) => {
                if (this.showLinksToggle.checked) {
                    const axes = new LinkAxesHelper(this.linkAxesSize);
                    axes.setLayer(1); // 让 axes 不被 Raycaster 检测到
                    this.linkAxes[link_name] = axes;
                    link.add(axes);
                } else {
                    if (this.linkAxes[link_name]) {
                        link.remove(this.linkAxes[link_name]);
                        delete this.linkAxes[link_name];
                    }
                }
            }
        );
    }

    /**
     * 更新关节值
     */
    public updateJointValue(joint_name: string, value: number) {
        const joint = this.robot?.joints[joint_name];
        if (joint) {
            joint.setJointValue(value);
        }
    }

    /**
     * 处理 Visual 和 Collision 的显示切换
     */
    showVisualCollison() {
        function setLayerRecursive(object: THREE.Object3D, layer: number) {
            object.layers.set(layer); // 设置当前对象
            object.traverse((child1) => child1.layers.set(layer)); // 递归子对象
        }
        // @ts-ignore
        this.robot.traverse((child: THREE.Object3D) => {
            // @ts-ignore
            if (child.isURDFCollider) {
                child.visible = this.showCollision;
                if (!this.showCollision) {
                    setLayerRecursive(child, 1); // 禁用 Raycaster 检测
                } else {
                    setLayerRecursive(child, 0); // 恢复 Raycaster 检测
                }
            }
            // @ts-ignore
            else if (child.isURDFVisual) {
                child.visible = this.showVisual;
                if (!this.showVisual) {
                    setLayerRecursive(child, 1); // 禁用 Raycaster 检测
                } else {
                    setLayerRecursive(child, 0); // 恢复 Raycaster 检测
                }
            }
        });
    }

    /**
     * 获取关节的最小和最大角度
     */
    public getJointLimit(joint_name: string) {
        const joint = this.robot?.joints[joint_name];
        if (joint) {
            if (joint.jointType === "continuous") {
                return {
                    lower: -2 * Math.PI,
                    upper: 2 * Math.PI,
                };
            }
            return {
                lower: joint.limit.lower,
                upper: joint.limit.upper,
            };
        }
        return {
            lower: 0,
            upper: 0,
        };
    }

    public render() {
        this.renderCallback();
    }

    /**
     * 鼠标悬停在模型上回调
     */
    onHoverCallback(joint: URDFJoint | null, link: URDFLink | null) {
        // 调用自身的悬停回调
        this.selfHoverCallback(joint, link);

        // 调用父类的悬停回调
        this.modelHoverCallback();
    }

    /**
     * 鼠标移出模型回调
     */
    onUnhoverCallback(joint: URDFJoint | null, link: URDFLink | null) {
        // 调用自身的移出回调
        this.selfUnhoverCallback(joint, link);

        // 调用父类的移出回调
        this.modelUnhoverCallback();
    }

    /**
     * 鼠标悬停在模型上回调
     */
    public selfHoverCallback(joint: URDFJoint | null, link: URDFLink | null) {
        if (joint) {
            this.jointAxes[joint.name]?.setHovered(true);
        }
        if (link) {
            this.linkAxes[link.name]?.setHovered(true);
        }
    }

    /**
     * 鼠标移出模型回调
     */
    public selfUnhoverCallback(
        joint: URDFJoint | null,
        link: URDFLink | null,
        fullUnhover = false
    ) {
        if (fullUnhover) {
            // 如果是全局移出, 则清除所有悬停状态
            Object.values(this.jointAxes).forEach((joint) => {
                joint.setHovered(false);
            });
            Object.values(this.linkAxes).forEach((link) => {
                link.setHovered(false);
            });
            return;
        }
        // 如果是局部移出, 则只清除当前悬停状态
        if (joint) {
            this.jointAxes[joint.name]?.setHovered(false);
        }
        if (link) {
            this.linkAxes[link.name]?.setHovered(false);
        }
    }

    /**
     * 鼠标移出画布回调
     */
    public onMouseLeaveCallback() {
        this.dragControls.onMouseLeaveCallback();
        // 清除所有悬停状态
        this.selfUnhoverCallback(null, null, true);
    }

    set packages(packages: { [key: string]: string }) {
        this.loaderURDF.packages = packages;
    }

    set workingPath(workingPath: string) {
        this.loaderURDF.workingPath = workingPath;
    }
}
