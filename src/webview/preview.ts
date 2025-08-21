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

let main: Main | undefined = undefined;

/**
 * 主程序类
 */
class Main {
    domElements: DomElements;
    module_urdf: ModuleURDF;
    module_measure: ModuleMeasure;

    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    dirLight: THREE.DirectionalLight;
    ambientLight: THREE.AmbientLight;
    controls: OrbitControls;

    // 资源路径前缀
    uriPrefix = "https://file%2B.vscode-resource.vscode-cdn.net";

    constructor(message: any = undefined) {
        this.domElements = new DomElements(() => {
            this.updateDegreeRadians();
        });

        // init three.js scene
        const { scene, camera, renderer, dirLight, ambientLight, controls } =
            createScene();
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.dirLight = dirLight;
        this.ambientLight = ambientLight;
        this.controls = controls;

        this.onResize();
        window.addEventListener("resize", () => this.onResize());
        this.render();

        // URDF 模块
        this.module_urdf = new ModuleURDF(
            this.scene,
            this.camera,
            this.controls,
            this.renderer,
            this.uriPrefix,
            () => this.render(),
            (joint, angle) => this.domElements.updateJointValue(joint, angle),
            (joint, link) => this.domElements.modelHoverCallback(joint, link),
            (joint, link, fullUnhover) =>
                this.domElements.modelUnhoverCallback(joint, link, fullUnhover)
        );

        // 测量模块
        this.module_measure = new ModuleMeasure(
            this.renderer,
            this.scene,
            this.camera,
            this.module_urdf.dragControls,
            () => this.domElements.startMeasureCallback(),
            () => this.domElements.continueMeasureCallback(),
            () => this.domElements.completeMeasureCallback(),
            () => this.domElements.closeMeasureCallback(),
            () => this.domElements.measureHoverCallback(),
            () => this.domElements.measureUnhoverCallback()
        );

        // 添加鼠标离开渲染器时的事件处理
        this.renderer.domElement.addEventListener("mouseleave", (event) => {
            this.module_urdf.onMouseLeaveCallback();
        });

        // 处理消息
        message && this.vscodeMessageCallback(message);
    }

    /**
     * 加载机器人模型
     */
    async loadRobot() {
        await this.module_urdf.LoadURDF();

        // 更新关节列表
        this.updateJointList();

        this.render();
    }

    /**
     * 根据显示弧度制和角度制切换显示
     */
    updateDegreeRadians() {
        Object.entries<URDFJoint>(this.module_urdf.robot?.joints || {}).forEach(
            ([joint_name, joint]) => {
                if (joint.jointType === "fixed") {
                    return;
                }

                const joint_limit = this.module_urdf.getJointLimit(joint_name);

                this.domElements.updateJointLimit(joint_name, joint_limit);
            }
        );
    }

    /**
     * 更新 Joint 列表
     */
    updateJointList() {
        this.domElements.clearJointList();
        Object.entries<URDFJoint>(this.module_urdf.robot?.joints || {}).forEach(
            ([joint_name, joint]) => {
                if (joint.jointType === "fixed") {
                    return;
                }

                const joint_limit = this.module_urdf.getJointLimit(joint_name);

                this.domElements.addJoint(
                    joint_name,
                    joint.jointType,
                    joint_limit,
                    (value: number, joint_name: string) => {
                        this.module_urdf.updateJointValue(joint_name, value);
                    }, // 处理滑块导致的关节角度变化
                    (joint_name: string) => {
                        this.module_urdf.selfHoverCallback(joint, null);
                    }, // 处理悬浮事件
                    (joint_name: string) => {
                        this.module_urdf.selfUnhoverCallback(joint, null);
                    } // 处理取消悬浮事件
                );
            }
        );
        this.updateDegreeRadians();
    }

    /**
     * 更新 Link 列表
     */
    updateLinkList() {}

    /**
     * VSCode 消息回调
     * @param message 必须包含 type 键
     */
    public vscodeMessageCallback(message: any) {
        if (message.type === "settings" || message.type === "init") {
            if (message.cacheMesh !== undefined) {
                this.module_urdf.cacheMesh = message.cacheMesh;
            }
            if (message.backgroundColor) {
                this.scene.background = new THREE.Color(
                    message.backgroundColor
                );
                this.render();
            }
            if (message.showTips !== undefined) {
                this.domElements.setShowTips(message.showTips);
            }
            if (message.highlightJointWhenHover !== undefined) {
                this.module_urdf.highlightJointWhenHover =
                    message.highlightJointWhenHover;
            }
            if (message.highlightLinkWhenHover !== undefined) {
                this.module_urdf.highlightLinkWhenHover =
                    message.highlightLinkWhenHover;
            }
        }
        if (message.type === "urdf" || message.type === "init") {
            if (message.uriPrefix) {
                // 去除末尾的 `/`
                if (message.uriPrefix.endsWith("/")) {
                    this.uriPrefix = message.uriPrefix.slice(0, -1);
                } else {
                    this.uriPrefix = message.uriPrefix;
                }
                this.uriPrefix = "https://" + this.uriPrefix;
                this.module_urdf.uriPrefix = this.uriPrefix;
            }
            if (message.packages) {
                this.module_urdf.packages = message.packages;
            }
            if (message.workingPath) {
                if (message.workingPath.endsWith("/")) {
                    this.module_urdf.workingPath = message.workingPath;
                } else {
                    this.module_urdf.workingPath = message.workingPath + "/";
                }
            }
            if (message.filename) {
                this.module_urdf.filename = message.filename;
            }
            if (message.reset_camera && message.reset_camera === true) {
                this.module_urdf.resetCamera = true;
            }
            if (message.urdfText) {
                this.module_measure.clearMeaure();
                this.module_urdf.urdfText = message.urdfText;
                this.loadRobot();
            }
        }
    }

    /**
     * 处理窗口大小变化
     */
    onResize() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    /**
     * 渲染循环
     */
    render() {
        requestAnimationFrame(() => this.render());
        this.renderer.render(this.scene, this.camera);
    }
}

// 监听来自 vscode 的消息
window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "init") {
        main = new Main(message);
    } else {
        main?.vscodeMessageCallback(message);
    }
});
