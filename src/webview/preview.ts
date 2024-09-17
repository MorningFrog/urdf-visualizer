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
const { MeshLoadDoneFunc, URDFRobot } = require("urdf-loader");

// 获取可操作元素
const reloadButton = document.getElementById("re-load");
const controlsToggle = document.getElementById("toggle-controls"); // 切换控制按钮的显示
const controlsel = document.getElementById("controls");
const showVisualToggle = document.getElementById("show-visual");
const showCollisionToggle = document.getElementById("show-collision");

// 确保所有元素都已加载
if (
    !reloadButton ||
    !controlsToggle ||
    !controlsel ||
    !showVisualToggle ||
    !showCollisionToggle
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

// load URDF model
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
let pathMapping: { [key: string]: string } = {};
// 待映射的路径
let pathsToResolve: string[] = [];

// 设置ROS功能包所在的目录
loader.packages = {};

// 是否显示 visual 和 collision
let showVisual = true;
let showCollision = false;

// 设置 mesh 处理函数
loader.loadMeshCb = function (
    path: string,
    manager: LoadingManager,
    onComplete: typeof MeshLoadDoneFunc
) {
    if (path in pathMapping) {
        numMeshLoading += 1;
        const webview_path = pathMapping[path];
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
    } else {
        pathsToResolve.push(path);
        onComplete(null);
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
    } else if (message.type === "resolvedPaths") {
        if (message.pathMapping) {
            // 在 pathMapping 中添加新的映射
            pathMapping = { ...pathMapping, ...message.pathMapping };
        }
        // 重新加载 URDF 模型
        loadRobot();
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
    // 解析 URDF
    loader.parseCollision = showCollision;
    loader.parseVisual = showVisual;
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
    colliders.forEach((coll: typeof URDFRobot) => {
        coll.traverse((c: typeof URDFRobot) => {
            c.material = collisionMaterial;
            c.castShadow = false;
        });
    });

    // robot.updateMatrixWorld(true);

    render();
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
    loadRobot();
});

showCollisionToggle.addEventListener("change", () => {
    // @ts-ignore
    showCollision = showCollisionToggle.checked;
    loadRobot();
});
