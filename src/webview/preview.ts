declare function acquireVsCodeApi(): {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (newState: any) => void;
};
const vscode = acquireVsCodeApi();

import * as THREE from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { URDFJoint, URDFLink } from "urdf-loader";

// 导入测量模块
import { ModuleMeasure } from "./module_measure";

// 导入URDF模块
import { ModuleURDF } from "./module_urdf";

// 获取可操作元素
const reloadButton = document.getElementById("re-load") as HTMLButtonElement; // 重新加载按钮
const controlsToggle = document.getElementById(
    "toggle-controls"
) as HTMLDivElement; // 切换控制按钮的显示
const controlsel = document.getElementById("controls") as HTMLDivElement; // 控制按钮
const ulJoints = document.getElementById("ul-joints") as HTMLUListElement;
const tooltip = document.getElementById("tooltip") as HTMLDivElement;
const radiansButton = document.getElementById(
    "switch-radians"
) as HTMLButtonElement;
const degreesButton = document.getElementById(
    "switch-degrees"
) as HTMLButtonElement;
const notifyContainer = document.getElementById(
    "notify-container"
) as HTMLDivElement;
const notifyDragJoint = document.getElementById(
    "notify-drag-joint"
) as HTMLDivElement;
const notifyDragRotate = document.getElementById(
    "notify-drag-rotate"
) as HTMLDivElement;
const notifyDragMove = document.getElementById(
    "notify-drag-move"
) as HTMLDivElement;
const notifyClickFirstPoint = document.getElementById(
    "notify-click-first-point"
) as HTMLDivElement;
const notifyClickMorePoints = document.getElementById(
    "notify-click-more-points"
) as HTMLDivElement;
const notifyClickRestart = document.getElementById(
    "notify-click-restart"
) as HTMLDivElement;
const notifyDblclickComplete = document.getElementById(
    "notify-dblclick-complete"
) as HTMLDivElement;
const notifyEscCancle = document.getElementById(
    "notify-esc-cancle"
) as HTMLDivElement;

// 确保所有元素都已加载
if (
    !reloadButton ||
    !controlsToggle ||
    !controlsel ||
    !ulJoints ||
    !tooltip ||
    !radiansButton ||
    !degreesButton ||
    !notifyContainer ||
    !notifyDragJoint ||
    !notifyDragRotate ||
    !notifyDragMove ||
    !notifyClickFirstPoint ||
    !notifyClickMorePoints ||
    !notifyClickRestart ||
    !notifyDblclickComplete ||
    !notifyEscCancle
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

const controls = new OrbitControls(camera, renderer.domElement);
controls.minDistance = 0.1;
controls.target.y = 1;
controls.update();

onResize();
window.addEventListener("resize", onResize);
render();

// 资源路径前缀
let uriPrefix = "https://file%2B.vscode-resource.vscode-cdn.net";

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

// 角度制/弧度制
let isDegree = false;

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
            if (message.showTips === true) {
                notifyContainer.classList.remove("hidden");
            } else {
                notifyContainer.classList.add("hidden");
            }
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
 * 获取关节的最小和最大角度
 */
function getJointLimit(joint_name: string) {
    const joint = module_urdf.robot?.joints[joint_name];
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

/**
 * 更新关节列表
 */
function updateJointList() {
    if (ulJoints) {
        ulJoints.innerHTML = "";
    }
    Object.entries<URDFJoint>(module_urdf.robot?.joints || {}).forEach(
        ([joint_name, joint]) => {
            if (joint.jointType === "fixed") {
                return;
            }

            const joint_limit = getJointLimit(joint_name);

            const li = document.createElement("li"); // 列表项
            const joint_name_processed =
                module_urdf.postprocessIdAndClass(joint_name);
            li.id = `joint_${joint_name_processed}`;
            li.classList.add("joint-item");
            li.classList.add("width_wrapper");
            li.innerHTML = `
        <div class="div-joint-name width_full">
            <label>${joint_name}</label>
            <label class="joint_type ${joint.jointType}">${
                joint.jointType
            }</label>
        </div>
        <div class="div-slider width_full">
            <div>
                <input
                    type="range"
                    name="slider_joint_${joint_name_processed}"
                    id="slider_joint_${joint_name_processed}"
                    class="slider-joint"
                    min="${joint_limit.lower}"
                    max="${joint_limit.upper}"
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
                    // @ts-ignore
                    ((0 - joint_limit.lower) /
                        // @ts-ignore
                        (joint_limit.upper - joint_limit.lower)) *
                    // @ts-ignore
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

            // 悬停事件处理
            li.addEventListener("mouseenter", () => {
                module_urdf.selfHoverCallback(joint, null);
            });
            li.addEventListener("mouseleave", () => {
                module_urdf.selfUnhoverCallback(joint, null);
            });

            ulJoints?.appendChild(li);
        }
    );
    updateDegreeRadians();
}

/**
 * 根据显示弧度制和角度制切换显示
 */
function updateDegreeRadians() {
    Object.entries<URDFJoint>(module_urdf.robot?.joints || {}).forEach(
        ([joint_name, joint]) => {
            if (joint.jointType === "fixed") {
                return;
            }

            const joint_name_processed =
                module_urdf.postprocessIdAndClass(joint_name);

            const joint_limit = getJointLimit(joint_name);

            const element_joint_limit_upper = document.getElementById(
                `joint_${joint_name_processed}_limit_upper`
            ) as HTMLInputElement;
            const element_joint_limit_lower = document.getElementById(
                `joint_${joint_name_processed}_limit_lower`
            ) as HTMLInputElement;
            if (isDegree) {
                element_joint_limit_upper.innerText = Math.round(
                    // @ts-ignore
                    (joint_limit.upper * 180) / Math.PI
                ).toString();
                element_joint_limit_lower.innerText = Math.round(
                    // @ts-ignore
                    (joint_limit.lower * 180) / Math.PI
                ).toString();
            } else {
                element_joint_limit_upper.innerText =
                    joint_limit.upper.toFixed(2);
                element_joint_limit_lower.innerText =
                    joint_limit.lower.toFixed(2);
            }
        }
    );
}

/**
 * 处理滑块导致的关节角度变化
 */
function updateJointValueFromSlider(value: string, joint_name: string) {
    module_urdf.updateJointValue(joint_name, parseFloat(value));
    updateTooltipText(parseFloat(value));
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

function modelHoverCallback() {
    // 触发悬停
    // 更新操作提示
    notifyDragJoint.classList.remove("disabled");
    notifyDragRotate.classList.add("disabled");
    notifyDragMove.classList.add("disabled");
}

function modelUnhoverCallback() {
    // 更新操作提示
    notifyDragJoint.classList.add("disabled");
    notifyDragRotate.classList.remove("disabled");
    notifyDragMove.classList.remove("disabled");
}

let havePoints = false; // 是否已经有点了

function startMeasureCallback() {
    const notifyItems = document.querySelectorAll<HTMLElement>(".notify-item");
    notifyItems.forEach((item) => {
        if (item.classList.contains("case-measure")) {
            // 显示测量提示
            item.classList.remove("hidden");

            if (item.id === "notify-esc-cancle") {
                item.classList.remove("disabled");
            } else {
                item.classList.add("disabled");
            }
        } else if (item.classList.contains("case-all")) {
            item.classList.remove("disabled");
        } else {
            // 隐藏其他提示
            item.classList.add("hidden");
            item.classList.remove("disabled");
        }
    });
    notifyClickMorePoints.classList.add("hidden");
    notifyClickRestart.classList.add("hidden");
    notifyDblclickComplete.classList.remove("disabled");

    havePoints = false;
}

function continueMeasureCallback() {
    notifyDblclickComplete.classList.remove("disabled");
    notifyClickFirstPoint.classList.add("hidden");
    notifyClickMorePoints.classList.remove("hidden");
    havePoints = true;
}

function completeMeasureCallback() {
    notifyDblclickComplete.classList.add("hidden");
    notifyClickFirstPoint.classList.add("hidden");
    notifyClickMorePoints.classList.add("hidden");
    notifyClickRestart.classList.remove("hidden");
    notifyClickRestart.classList.remove("disabled");
}

function closeMeasureCallback() {
    const notifyItems = document.querySelectorAll<HTMLElement>(".notify-item");
    notifyItems.forEach((item) => {
        if (item.classList.contains("case-normal")) {
            item.classList.remove("hidden");
            item.classList.add("disabled");
        } else if (item.classList.contains("case-all")) {
            item.classList.remove("disabled");
        } else {
            item.classList.add("hidden");
            item.classList.remove("disabled");
        }
    });
}

function measureHoverCallback() {
    if (havePoints) {
        notifyClickMorePoints.classList.remove("disabled");
    } else {
        notifyClickFirstPoint.classList.remove("disabled");
    }
    notifyDragRotate.classList.add("disabled");
    notifyDragMove.classList.add("disabled");
}

function measureUnhoverCallback() {
    notifyClickFirstPoint.classList.add("disabled");
    notifyClickMorePoints.classList.add("disabled");
    notifyDragRotate.classList.remove("disabled");
    notifyDragMove.classList.remove("disabled");
}

/**
 * 鼠标离开渲染器时的事件处理
 */
renderer.domElement.addEventListener("mouseleave", (event) => {
    module_urdf.onMouseLeaveCallback();
});
