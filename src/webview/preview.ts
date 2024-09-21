declare function acquireVsCodeApi(): {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (newState: any) => void;
};
const vscode = acquireVsCodeApi();

import * as THREE from "three";
import { LoadingManager } from "three";
const { STLLoader } = require("three/examples/jsm/loaders/STLLoader.js");
const { GLTFLoader } = require("three/examples/jsm/loaders/GLTFLoader.js");
const {
    ColladaLoader,
} = require("three/examples/jsm/loaders/ColladaLoader.js");
const { OBJLoader } = require("three/examples/jsm/loaders/OBJLoader.js");
const {
    OrbitControls,
} = require("three/examples/jsm/controls/OrbitControls.js");
const URDFLoader = require("urdf-loader").default;
const { MeshLoadDoneFunc, URDFRobot, URDFJoint } = require("urdf-loader");

// 导入自定义URDFDragControls
const { CustomURDFDragControls } = require("./CustomURDFDragControls");

// 获取可操作元素
const reloadButton = document.getElementById("re-load");
const controlsToggle = document.getElementById("toggle-controls"); // 切换控制按钮的显示
const controlsel = document.getElementById("controls");
const showVisualToggle = document.getElementById("show-visual");
const showCollisionToggle = document.getElementById("show-collision");
const showJointsToggle = document.getElementById("show-joints");
const jointSizeInput = document.getElementById("joint-size");
const showLinksToggle = document.getElementById("show-links");
const linkSizeInput = document.getElementById("link-size");
const ulJoints = document.getElementById("ul-joints");
const tooltip = document.getElementById("tooltip") as HTMLDivElement;
const radiansButton = document.getElementById(
    "switch-radians"
) as HTMLButtonElement;
const degreesButton = document.getElementById(
    "switch-degrees"
) as HTMLButtonElement;

// 确保所有元素都已加载
if (
    !reloadButton ||
    !controlsToggle ||
    !controlsel ||
    !showVisualToggle ||
    !showCollisionToggle ||
    !showJointsToggle ||
    !jointSizeInput ||
    !showLinksToggle ||
    !linkSizeInput ||
    !ulJoints ||
    !tooltip ||
    !radiansButton ||
    !degreesButton
) {
    throw new Error("Element not found");
}

/**
 * init three.js scene
 */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcccccc);

const camera = new THREE.PerspectiveCamera();
camera.position.set(10, 10, 10);
camera.up.set(0, 0, 1);
camera.lookAt(0, 0, 0);
camera.layers.enable(1); // 显示关节轴

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0xffffff);
renderer.setClearAlpha(0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const urdfViewerElement = document.getElementById("urdf-viewer");
if (urdfViewerElement) {
    urdfViewerElement.appendChild(renderer.domElement);
} else {
    throw new Error("urdf-viewer element not found");
}

const dirLight = new THREE.DirectionalLight(0xffffff, Math.PI);
dirLight.position.set(4, 10, 10);
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.normalBias = 0.001;
dirLight.castShadow = true;
scene.add(dirLight);
scene.add(dirLight.target);

const ambientLight = new THREE.HemisphereLight("#fff", "#000");
ambientLight.groundColor.lerp(ambientLight.color, 0.5 * Math.PI);
ambientLight.intensity = 0.5;
ambientLight.position.set(0, 0, 1);
scene.add(ambientLight);

// 创建坐标系
const axesHelper = new THREE.AxesHelper(5); // 5 是坐标轴的长度
axesHelper.layers.set(1);
scene.add(axesHelper);

// 默认碰撞体材料
const collisionMaterial = new THREE.MeshPhongMaterial({
    transparent: true,
    opacity: 0.35,
    shininess: 2.5,
    premultipliedAlpha: true,
    color: 0xffbe38,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
});

const controls = new OrbitControls(camera, renderer.domElement);
controls.minDistance = 0.1;
controls.target.y = 1;
controls.update();

onResize();
window.addEventListener("resize", onResize);
render();

// mesh文件加载器
const manager = new THREE.LoadingManager();
const loader = new URDFLoader(manager);
const loaderGLTF = new GLTFLoader(manager);
const loaderOBJ = new OBJLoader(manager);
const loaderCollada = new ColladaLoader(manager);
const loaderSTL = new STLLoader(manager);

// 正在加载的 mesh 数量
let numMeshLoading = 0;
// URDF 文本
let urdfText = "";
// 机器人
let robot: typeof URDFRobot | null = null;
// 路径映射: 绝对路径 -> webview 资源路径
// let pathMapping: { [key: string]: string } = {};
// 待映射的路径
let pathsToResolve: string[] = [];
// 显示关节轴
let jointAxes: { [key: string]: THREE.AxesHelper } = {};
let jointAxesSize = 1.0;
// 显示link坐标系
let linkAxes: { [key: string]: THREE.AxesHelper } = {};
let linkAxesSize = 1.0;
// 角度制/弧度制
let isDegree = false;
// 设置ROS功能包所在的目录
loader.packages = {};
// 是否显示 visual 和 collision
let showVisual = true;
let showCollision = false;
// 解析visual和collison
loader.parseCollision = true;
loader.parseVisual = true;

// 设置 manager 报错时的处理
manager.onError = (url: string) => {
    vscode.postMessage({
        type: "error",
        message: `Failed to load ${url}`,
    });
};

// 设置资源处理函数
manager.setURLModifier((url: string): string => {
    // 删除其中的 `file://`
    url = url.replace("file://", "");
    // 替换其中的 `\` 为 `/`
    url = url.replace(/\\/g, "/");
    // 对于 Windows 系统, 添加 `/` 前缀
    if (!url.startsWith("/")) {
        url = "/" + url;
    }
    return "https://file%2B.vscode-resource.vscode-cdn.net" + url;
});

// 创建自定义的 URDF 控制器
const dragControls = new CustomURDFDragControls(
    scene,
    camera,
    controls,
    renderer.domElement,
    updateJointCallback
);

// 设置 mesh 处理函数
loader.loadMeshCb = function (
    path: string,
    manager: LoadingManager,
    onComplete: typeof MeshLoadDoneFunc
) {
    numMeshLoading += 1;
    const webview_path = path;
    // 扩展名
    const ext = webview_path?.split(/\./g)?.pop()?.toLowerCase();
    switch (ext) {
        case "gltf":
        case "glb":
            loaderGLTF.load(
                webview_path,
                (result: any) => {
                    onComplete(result.scene);
                    numMeshLoading -= 1;
                },
                null,
                (err: Error) => {
                    onComplete(null, err);
                    numMeshLoading -= 1;
                }
            );
            break;
        case "obj":
            loaderOBJ.load(
                webview_path,
                (result: any) => {
                    onComplete(result);
                    numMeshLoading -= 1;
                },
                null,
                (err: Error) => {
                    onComplete(null, err);
                    numMeshLoading -= 1;
                }
            );
            break;
        case "dae":
            loaderCollada.load(
                webview_path,
                (result: any) => {
                    onComplete(result.scene);
                    numMeshLoading -= 1;
                },
                null,
                (err: Error) => {
                    onComplete(null, err);
                    numMeshLoading -= 1;
                }
            );
            break;
        case "stl":
            loaderSTL.load(
                webview_path,
                (result: any) => {
                    const material = new THREE.MeshPhongMaterial();
                    const mesh = new THREE.Mesh(result, material);
                    onComplete(mesh);
                    numMeshLoading -= 1;
                },
                null,
                (err: Error) => {
                    onComplete(null, err);
                    numMeshLoading -= 1;
                }
            );
            break;
    }
};

const waitInterval = 5; // 等待间隔
function waitForNumMeshLoadingToZero(max_wait_time = 5000) {
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            max_wait_time -= waitInterval;
            if (numMeshLoading <= 0 || max_wait_time <= 0) {
                clearInterval(interval);
                resolve(null);
            }
        }, waitInterval); // 每 waitInterval 毫秒检查一次
    });
}

// 监听来自 vscode 的消息
window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "urdf") {
        if (message.packages) {
            loader.packages = message.packages;
        }
        if (message.workingPath) {
            if (message.workingPath.endsWith("/")) {
                loader.workingPath = message.workingPath;
            } else {
                loader.workingPath = message.workingPath + "/";
            }
        }
        if (message.urdfText) {
            urdfText = message.urdfText;
            loadRobot();

            if (pathsToResolve.length > 0) {
                vscode.postMessage({
                    type: "resolvePaths",
                    pathsToResolve: pathsToResolve,
                });
                pathsToResolve = [];
            }
        }
    } else if (message.type === "settings") {
        if (message.backgroundColor) {
            scene.background = new THREE.Color(message.backgroundColor);
            render();
        }
    }
});

/**
 * 加载机器人模型
 */
async function loadRobot() {
    // 删除旧机器人
    if (robot) {
        scene.remove(robot);
    }
    jointAxes = {};

    // 解析 URDF
    robot = loader.parse(urdfText);

    // 添加到场景
    scene.add(robot);

    // 等待所有 mesh 加载完成
    await waitForNumMeshLoadingToZero();
    numMeshLoading = 0;

    // 切换显示Visual或Collision
    const colliders: (typeof URDFRobot)[] = [];
    robot.traverse((child: typeof URDFRobot) => {
        if (child.isURDFCollider) {
            child.visible = showCollision;
            colliders.push(child);
        } else if (child.isURDFVisual) {
            child.visible = showVisual;
        }
    });
    // 为 collider 设置默认材质
    colliders.forEach((coll: typeof URDFRobot) => {
        coll.traverse((c: typeof URDFRobot) => {
            c.material = collisionMaterial;
            c.castShadow = false;
        });
    });

    // robot.updateMatrixWorld(true);

    // 添加关节轴
    loadJointAxes();
    // 添加 link 坐标系
    loadLinkAxes();
    // 更新关节列表
    updateJointList();

    render();
}

/**
 * 处理关节轴显示
 */
function loadJointAxes() {
    Object.entries<{
        [key: string]: typeof URDFJoint;
    }>(robot?.joints || {}).forEach(([joint_name, joint]) => {
        if (joint.jointType === "fixed") {
            return;
        }
        // @ts-ignore
        if (showJointsToggle.checked) {
            const axes = new THREE.AxesHelper(jointAxesSize);
            axes.layers.set(1); // 让 axes 不被 Raycaster 检测到
            jointAxes[joint_name] = axes;
            joint.add(axes);
        } else {
            if (jointAxes[joint_name]) {
                joint.remove(jointAxes[joint_name]);
                delete jointAxes[joint_name];
            }
        }
    });
}

/**
 * 处理 link 坐标系显示
 */
function loadLinkAxes() {
    Object.entries<{
        [key: string]: typeof URDFRobot;
    }>(robot?.links || {}).forEach(([link_name, link]) => {
        // @ts-ignore
        if (showLinksToggle.checked) {
            const axes = new THREE.AxesHelper(linkAxesSize);
            axes.layers.set(1); // 让 axes 不被 Raycaster 检测到
            linkAxes[link_name] = axes;
            link.add(axes);
        } else {
            if (linkAxes[link_name]) {
                link.remove(linkAxes[link_name]);
                delete linkAxes[link_name];
            }
        }
    });
}

/**
 * 处理 Visual 和 Collision 的显示切换
 */
function showVisualCollison() {
    robot.traverse((child: typeof URDFRobot) => {
        if (child.isURDFCollider) {
            child.visible = showCollision;
        } else if (child.isURDFVisual) {
            child.visible = showVisual;
        }
    });
}

/**
 * 处理 id 和 class, 将其中的 `/` 替换为 `__`
 * @param str
 */
function postprocessIdAndClass(str: string) {
    return str.replace(/\//g, "__");
}

/**
 * 更新关节列表
 */
function updateJointList() {
    if (ulJoints) {
        ulJoints.innerHTML = "";
    }
    Object.entries<{
        [key: string]: typeof URDFJoint;
    }>(robot?.joints || {}).forEach(([joint_name, joint]) => {
        if (joint.jointType === "fixed") {
            return;
        }

        const li = document.createElement("li"); // 列表项
        const joint_name_processed = postprocessIdAndClass(joint_name);
        li.id = `joint_${joint_name_processed}`;
        li.innerHTML = `
        <div>
        <label>${joint_name}</label>
        </div>
        <div class="div-slider width_wrapper">
            <div>
                <input
                    type="range"
                    name="slider_joint_${joint_name_processed}"
                    id="slider_joint_${joint_name_processed}"
                    class="slider-joint"
                    min="${joint.limit.lower}"
                    max="${joint.limit.upper}"
                    step="0.01"
                    value="0.0"
                />
            </div>
            <div class="div-scale">
                <div class="div-scale-item lower-limit">
                    <div>|</div>
                    <div id="joint_${joint_name_processed}_limit_lower"></div>
                </div>
                <div class="div-scale-item" style="left: ${
                    ((0 - joint.limit.lower) /
                        (joint.limit.upper - joint.limit.lower)) *
                    100
                }%;">
                    <div>|</div>
                </div>
                <div class="div-scale-item upper-limit">
                    <div>|</div>
                    <div id="joint_${joint_name_processed}_limit_upper"></div>
                </div>
            </div>
        </div>
        `;
        // 绑定滑块事件
        const slider = li.querySelector(
            `#slider_joint_${joint_name_processed}`
        ) as HTMLInputElement;
        if (slider) {
            // 更新关节角度
            slider.addEventListener("input", () => {
                updateJointValueFromSlider(slider.value, joint_name);
            });
            // 显示值
            slider.addEventListener("mouseover", (event) => {
                const value = slider.value;
                updateTooltipText(parseFloat(value));
                tooltip.style.display = "block";
                tooltip.style.left = `${event.pageX}px`;
                const slider_top = slider.getBoundingClientRect().top;
                tooltip.style.top = `${slider_top - 30}px`;
            });
            // 隐藏值
            slider.addEventListener("mouseout", () => {
                tooltip.style.display = "none";
            });
            // 更改位置
            slider.addEventListener("mousemove", (event) => {
                tooltip.style.left = `${event.pageX}px`;
                const slider_top = slider.getBoundingClientRect().top;
                tooltip.style.top = `${slider_top - 30}px`;
            });
        }

        ulJoints?.appendChild(li);
    });
    updateDegreeRadians();
}

/**
 * 根据显示弧度制和角度制切换显示
 */
function updateDegreeRadians() {
    Object.entries<{
        [key: string]: typeof URDFJoint;
    }>(robot?.joints || {}).forEach(([joint_name, joint]) => {
        if (joint.jointType === "fixed") {
            return;
        }

        const joint_name_processed = postprocessIdAndClass(joint_name);

        const joint_limit_upper = document.getElementById(
            `joint_${joint_name_processed}_limit_upper`
        ) as HTMLInputElement;
        const joint_limit_lower = document.getElementById(
            `joint_${joint_name_processed}_limit_lower`
        ) as HTMLInputElement;
        if (isDegree) {
            joint_limit_upper.innerText = Math.round(
                (joint.limit.upper * 180) / Math.PI
            ).toString();
            joint_limit_lower.innerText = Math.round(
                (joint.limit.lower * 180) / Math.PI
            ).toString();
        } else {
            joint_limit_upper.innerText = joint.limit.upper.toFixed(2);
            joint_limit_lower.innerText = joint.limit.lower.toFixed(2);
        }
    });
}

/**
 * 处理拖动导致的关节角度变化
 */
function updateJointCallback(joint: typeof URDFJoint, angle: number) {
    const joint_name = joint.name;
    const joint_name_processed = postprocessIdAndClass(joint_name);
    const slider = document.getElementById(
        `slider_joint_${joint_name_processed}`
    ) as HTMLInputElement;
    if (slider) {
        slider.value = angle.toString();
    }
}

/**
 * 处理滑块导致的关节角度变化
 */
function updateJointValueFromSlider(value: string, joint_name: string) {
    const joint = robot?.joints[joint_name];
    if (joint) {
        const angle = parseFloat(value);
        joint.setJointValue(angle);

        updateTooltipText(angle);
    }
}

/**
 * 更新 tooltip 显示的文本
 */
function updateTooltipText(angle: number) {
    if (isDegree) {
        tooltip.textContent = Math.round((angle * 180) / Math.PI).toString();
    } else {
        tooltip.textContent = angle.toFixed(2);
    }
}

/**
 * 处理窗口大小变化
 */
function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

/**
 * 渲染循环
 */
function render() {
    requestAnimationFrame(render);
    renderer.render(scene, camera);
}

// 处理交互
reloadButton.addEventListener("click", () => {
    vscode.postMessage({ type: "getNewURDF" });
});

controlsToggle.addEventListener("click", () =>
    controlsel.classList.toggle("hidden")
);

showVisualToggle.addEventListener("change", () => {
    // @ts-ignore
    showVisual = showVisualToggle.checked;
    showVisualCollison();
});

showCollisionToggle.addEventListener("change", () => {
    // @ts-ignore
    showCollision = showCollisionToggle.checked;
    showVisualCollison();
});

showJointsToggle.addEventListener("change", () => {
    loadJointAxes();
    render();
});

jointSizeInput.addEventListener("input", () => {
    // @ts-ignore
    const size = parseFloat(jointSizeInput.value);
    jointAxesSize = size;
    Object.values(jointAxes).forEach((joint) => {
        joint.scale.set(size, size, size);
    });
    render();
});

showLinksToggle.addEventListener("change", () => {
    loadLinkAxes();
    render();
});

linkSizeInput.addEventListener("input", () => {
    // @ts-ignore
    const size = parseFloat(linkSizeInput.value);
    linkAxesSize = size;
    Object.values(linkAxes).forEach((link) => {
        link.scale.set(size, size, size);
    });
    render();
});

radiansButton.addEventListener("click", () => {
    if (!isDegree) {
        return;
    }
    isDegree = false;
    radiansButton.classList.add("checked");
    degreesButton.classList.remove("checked");
    updateDegreeRadians();
});

degreesButton.addEventListener("click", () => {
    if (isDegree) {
        return;
    }
    isDegree = true;
    degreesButton.classList.add("checked");
    radiansButton.classList.remove("checked");
    updateDegreeRadians();
});
