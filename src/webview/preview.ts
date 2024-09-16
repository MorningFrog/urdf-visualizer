declare function acquireVsCodeApi(): {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (newState: any) => void;
};
const vscode = acquireVsCodeApi();

import * as THREE from "three";
import { LoadingManager } from "three";
const {
    OrbitControls,
} = require("three/examples/jsm/controls/OrbitControls.js");
const URDFLoader = require("urdf-loader").default;
const { MeshLoadDoneFunc, URDFRobot } = require("urdf-loader");

// init three.js scene

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcccccc);

const camera = new THREE.PerspectiveCamera();
camera.position.set(10, 10, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.setScalar(1024);
directionalLight.position.set(10, 30, 10);
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);

// const ground = new THREE.Mesh(
//     new THREE.PlaneGeometry(),
//     new THREE.ShadowMaterial({ opacity: 0.25 })
// );
// ground.rotation.x = -Math.PI / 2;
// ground.scale.setScalar(30);
// ground.receiveShadow = true;
// scene.add(ground);

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
let urdfText = "";
// 机器人
let robot: typeof URDFRobot | null = null;
// 路径映射: 绝对路径 -> webview 资源路径
let pathMapping: { [key: string]: string } = {};
// 待映射的路径
let pathsToResolve: string[] = [];

// 设置ROS功能包所在的目录
loader.packages = {};

// 设置 mesh 处理函数
loader.loadMeshCb = function (
    path: string,
    manager: LoadingManager,
    onComplete: typeof MeshLoadDoneFunc
) {
    if (path in pathMapping) {
        path = pathMapping[path];
        // 调用默认的加载函数
        loader.defaultMeshLoader(path, manager, onComplete);
    } else {
        pathsToResolve.push(path);
    }
};

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
function loadRobot() {
    // 删除旧机器人
    if (robot) {
        scene.remove(robot);
    }
    // 解析 URDF
    robot = loader.parse(urdfText);
    // 设置阴影
    // robot.traverse((c: THREE.Object3D) => {
    //     c.castShadow = true;
    // });

    // robot.updateMatrixWorld(true);
    // 添加到场景
    scene.add(robot);
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
