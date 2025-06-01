/* URDF 加载模块 */

import * as THREE from "three";
import { LoadingManager } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import URDFLoader, { URDFVisual } from "urdf-loader";
import { URDFRobot, URDFJoint, URDFLink, URDFCollider } from "urdf-loader";

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
    jointAxes: { [key: string]: THREE.AxesHelper } = {};
    jointAxesSize = 1.0;
    // 显示link坐标系
    linkAxes: { [key: string]: THREE.AxesHelper } = {};
    linkAxesSize = 1.0;
    // 是否显示 visual 和 collision
    showVisual = true;
    showCollision = false;
    // 是否刷新视野
    resetCamera = false;

    // 资源路径前缀
    uriPrefix: string;

    // vscode 对象
    vscode: any;

    controls: OrbitControls; // 控制器

    // URDFDragControls
    dragControls: CustomURDFDragControls;

    waitInterval = 5; // 等待间隔

    renderCallback: () => void; // 渲染回调
    onHoverCallback: () => void; // 鼠标悬停关节回调
    onUnhoverCallback: () => void; // 鼠标移出关节回调

    constructor(
        scene: THREE.Scene, // 场景
        camera: THREE.PerspectiveCamera, // 相机
        controls: OrbitControls, // 控制器
        renderer: THREE.WebGLRenderer, // 渲染器
        uriPrefix: string, // 资源路径前缀
        vscode: any, // vscode 对象
        renderCallback = () => {}, // 渲染回调
        onHoverCallback = () => {}, // 鼠标悬停关节回调
        onUnhoverCallback = () => {} // 鼠标移出关节回调
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
        this.vscode = vscode;
        this.renderCallback = renderCallback;
        this.onHoverCallback = onHoverCallback;
        this.onUnhoverCallback = onUnhoverCallback;
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
            this.vscode.postMessage({
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
            // console.log("url", url);
            return this.uriPrefix + url;
        });

        this.dragControls = new CustomURDFDragControls(
            scene,
            camera,
            controls,
            renderer.domElement,
            this.updateJointCallback,
            this.onHoverCallback,
            this.onUnhoverCallback
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
                joint.scale.set(size, size, size);
            });
            this.render();
        });

        this.linkSizeInput.addEventListener("input", () => {
            // @ts-ignore
            const size = parseFloat(this.linkSizeInput.value);
            this.linkAxesSize = size;
            Object.values(this.linkAxes).forEach((link) => {
                link.scale.set(size, size, size);
            });
            this.render();
        });
    }

    /**
     * 处理拖动导致的关节角度变化
     */
    updateJointCallback = (joint: URDFJoint, angle: number) => {
        const joint_name = joint.name;
        const joint_name_processed = this.postprocessIdAndClass(joint_name);
        const slider = document.getElementById(
            `slider_joint_${joint_name_processed}`
        ) as HTMLInputElement;
        if (slider) {
            slider.value = angle.toString();
        }
    };

    /**
     * 处理 id 和 class, 将其中的 `/` 替换为 `__`
     * @param str
     */
    postprocessIdAndClass = (str: string) => {
        return str.replace(/\//g, "__");
    };

    // 等待所有 mesh 加载完成
    waitForNumMeshLoadingToZero = (max_wait_time = 5000) => {
        return new Promise((resolve) => {
            const interval = setInterval(() => {
                max_wait_time -= this.waitInterval;
                if (this.numMeshLoading <= 0 || max_wait_time <= 0) {
                    clearInterval(interval);
                    resolve(null);
                }
            }, this.waitInterval); // 每 waitInterval 毫秒检查一次
        });
    };

    // 删除机器人
    removeRobot = () => {
        if (this.robot) {
            this.scene.remove(this.robot);
            this.robot = null;
            this.jointAxes = {};
        }
    };

    // 加载 URDF
    LoadURDF = async () => {
        // 删除旧机器人
        this.removeRobot();
        // 解析 URDF
        this.robot = this.loaderURDF.parse(this.urdfText);
        // 添加到场景
        this.scene.add(this.robot);

        // 等待所有 mesh 加载完成
        await this.waitForNumMeshLoadingToZero();
        this.numMeshLoading = 0;

        // 切换显示Visual或Collision
        const colliders: URDFCollider[] = [];
        this.robot.traverse(
            // @ts-ignore
            (child: URDFLink | URDFCollider | URDFVisual | THREE.Mesh) => {
                // @ts-ignore
                if (child.isURDFCollider) {
                    child.visible = this.showCollision;
                    // @ts-ignore
                    colliders.push(child);
                }
                // @ts-ignore
                else if (child.isURDFVisual) {
                    child.visible = this.showVisual;
                }
            }
        );
        // 为 collider 设置默认材质
        colliders.forEach((coll: URDFCollider) => {
            // @ts-ignore
            coll.traverse((c: THREE.Mesh) => {
                c.material = this.collisionMaterial;
                c.castShadow = false;
            });
        });

        // 设置视野
        this.resetCameraView();

        // this.robot.updateMatrixWorld(true);

        // 添加关节轴
        this.loadJointAxes();
        // 添加 link 坐标系
        this.loadLinkAxes();
    };

    /**
     * 处理重置视野
     */
    resetCameraView = () => {
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
    };

    /**
     * 处理关节轴显示
     */
    loadJointAxes = () => {
        Object.entries<URDFJoint>(this.robot?.joints || {}).forEach(
            ([joint_name, joint]) => {
                if (joint.jointType === "fixed") {
                    return;
                }
                // @ts-ignore
                if (this.showJointsToggle.checked) {
                    const axes = new THREE.AxesHelper(this.jointAxesSize);
                    axes.layers.set(1); // 让 axes 不被 Raycaster 检测到
                    this.jointAxes[joint_name] = axes;
                    // @ts-ignore
                    joint.add(axes);
                } else {
                    if (this.jointAxes[joint_name]) {
                        // @ts-ignore
                        joint.remove(this.jointAxes[joint_name]);
                        delete this.jointAxes[joint_name];
                    }
                }
            }
        );
    };

    /**
     * 处理 link 坐标系显示
     */
    loadLinkAxes = () => {
        Object.entries<URDFLink>(this.robot?.links || {}).forEach(
            ([link_name, link]) => {
                if (this.showLinksToggle.checked) {
                    const axes = new THREE.AxesHelper(this.linkAxesSize);
                    axes.layers.set(1); // 让 axes 不被 Raycaster 检测到
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
    };

    /**
     * 更新关节值
     */
    updateJointValue = (joint_name: string, value: number) => {
        const joint = this.robot?.joints[joint_name];
        if (joint) {
            joint.setJointValue(value);
        }
    };

    /**
     * 处理 Visual 和 Collision 的显示切换
     */
    showVisualCollison = () => {
        // @ts-ignore
        this.robot.traverse((child: URDFRobot) => {
            // @ts-ignore
            if (child.isURDFCollider) {
                child.visible = this.showCollision;
            }
            // @ts-ignore
            else if (child.isURDFVisual) {
                child.visible = this.showVisual;
            }
        });
    };

    render = () => {
        this.renderCallback();
    };

    set packages(packages: { [key: string]: string }) {
        this.loaderURDF.packages = packages;
    }

    set workingPath(workingPath: string) {
        this.loaderURDF.workingPath = workingPath;
    }
}
