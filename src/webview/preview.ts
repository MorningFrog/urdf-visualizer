import { vscode } from "./vscode_api";

import * as THREE from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { URDFJoint, URDFLink } from "urdf-loader";
import { ModuleMeasure } from "./module_measure";
import { ModuleURDF } from "./module_urdf";
import { DomElements } from "./dom_tools";
import { createScene } from "./threejs_tools";

// 重写 console.error
// 保存原始的 console.error
const originalConsoleError = console.error;
console.error = function (...args) {
    vscode.postMessage({
        type: "error",
        message: args.join(" "),
    });

    originalConsoleError.apply(console, args); // 继续调用原始的 console.error 输出到控制台
};

/**
 * 根据显示弧度制和角度制切换显示
 */
const updateDegreeRadians = () => {
    Object.entries<URDFJoint>(module_urdf.robot?.joints || {}).forEach(
        ([joint_name, joint]) => {
            if (joint.jointType === "fixed") {
                return;
            }

            const joint_name_processed =
                module_urdf.postprocessIdAndClass(joint_name);

            const joint_limit = module_urdf.getJointLimit(joint_name);

            domElements.updateJointLimit(joint_name_processed, joint_limit);
        }
    );
};

// 初始化 dom
const domElements = new DomElements(updateDegreeRadians);

/**
 * init three.js scene
 */
const { scene, camera, renderer, dirLight, ambientLight, controls } =
    createScene();

onResize();
window.addEventListener("resize", onResize);
render();

// 资源路径前缀
let uriPrefix = "https://file%2B.vscode-resource.vscode-cdn.net";

// URDF 模块
const module_urdf = new ModuleURDF(
    scene,
    camera,
    controls,
    renderer,
    uriPrefix,
    vscode,
    render,
    modelHoverCallback,
    modelUnhoverCallback
);

// 测量模块
const module_measure = new ModuleMeasure(
    renderer,
    scene,
    camera,
    module_urdf.dragControls,
    startMeasureCallback,
    continueMeasureCallback,
    completeMeasureCallback,
    closeMeasureCallback,
    measureHoverCallback,
    measureUnhoverCallback
);

// 监听来自 vscode 的消息
window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "urdf") {
        if (message.uriPrefix) {
            // 去除末尾的 `/`
            if (message.uriPrefix.endsWith("/")) {
                uriPrefix = message.uriPrefix.slice(0, -1);
            } else {
                uriPrefix = message.uriPrefix;
            }
            uriPrefix = "https://" + uriPrefix;
            module_urdf.uriPrefix = uriPrefix;
        }
        if (message.packages) {
            module_urdf.packages = message.packages;
        }
        if (message.workingPath) {
            if (message.workingPath.endsWith("/")) {
                module_urdf.workingPath = message.workingPath;
            } else {
                module_urdf.workingPath = message.workingPath + "/";
            }
        }
        if (message.reset_camera && message.reset_camera === true) {
            module_urdf.resetCamera = true;
        }
        if (message.urdfText) {
            module_measure.clearMeaure();
            module_urdf.urdfText = message.urdfText;
            loadRobot();
        }
    } else if (message.type === "settings") {
        if (message.backgroundColor) {
            scene.background = new THREE.Color(message.backgroundColor);
            render();
        }
        if (message.showTips !== undefined) {
            domElements.setShowTips(message.showTips);
        }
    }
});

/**
 * 加载机器人模型
 */
async function loadRobot() {
    await module_urdf.LoadURDF();

    // 更新关节列表
    updateJointList();

    render();
}

/**
 * 更新 Joint 列表
 */
function updateJointList() {
    domElements.clearJointList();
    Object.entries<URDFJoint>(module_urdf.robot?.joints || {}).forEach(
        ([joint_name, joint]) => {
            if (joint.jointType === "fixed") {
                return;
            }

            const joint_limit = module_urdf.getJointLimit(joint_name);
            const joint_name_processed =
                module_urdf.postprocessIdAndClass(joint_name);

            domElements.addJoint(
                joint_name,
                joint_name_processed,
                joint.jointType,
                joint_limit,
                (value: number, joint_name: string) => {
                    module_urdf.updateJointValue(joint_name, value);
                }, // 处理滑块导致的关节角度变化
                (joint_name: string) => {
                    module_urdf.selfHoverCallback(joint, null);
                }, // 处理悬浮事件
                (joint_name: string) => {
                    module_urdf.selfUnhoverCallback(joint, null);
                } // 处理取消悬浮事件
            );
        }
    );
    updateDegreeRadians();
}

/**
 * 更新 Link 列表
 */
function updateLinkList() {}

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

function modelHoverCallback() {
    domElements.modelHoverCallback();
}

function modelUnhoverCallback() {
    domElements.modelUnhoverCallback();
}

function startMeasureCallback() {
    domElements.startMeasureCallback();
}

function continueMeasureCallback() {
    domElements.continueMeasureCallback();
}

function completeMeasureCallback() {
    domElements.completeMeasureCallback();
}

function closeMeasureCallback() {
    domElements.closeMeasureCallback();
}

function measureHoverCallback() {
    domElements.measureHoverCallback();
}

function measureUnhoverCallback() {
    domElements.measureUnhoverCallback();
}

/**
 * 鼠标离开渲染器时的事件处理
 */
renderer.domElement.addEventListener("mouseleave", (event) => {
    module_urdf.onMouseLeaveCallback();
});
