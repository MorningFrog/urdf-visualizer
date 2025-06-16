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
    ambientLight: THREE.HemisphereLight;
    controls: OrbitControls;

    // 资源路径前缀
    uriPrefix = "https://file%2B.vscode-resource.vscode-cdn.net";

    constructor() {
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
            () => this.modelHoverCallback(),
            () => this.modelUnhoverCallback()
        );

        // 测量模块
        this.module_measure = new ModuleMeasure(
            this.renderer,
            this.scene,
            this.camera,
            this.module_urdf.dragControls,
            () => this.startMeasureCallback(),
            () => this.continueMeasureCallback(),
            () => this.completeMeasureCallback(),
            () => this.closeMeasureCallback(),
            () => this.measureHoverCallback(),
            () => this.measureUnhoverCallback()
        );

        // 添加鼠标离开渲染器时的事件处理
        this.renderer.domElement.addEventListener("mouseleave", (event) => {
            this.module_urdf.onMouseLeaveCallback();
        });
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

                const joint_name_processed =
                    this.module_urdf.postprocessIdAndClass(joint_name);

                const joint_limit = this.module_urdf.getJointLimit(joint_name);

                this.domElements.updateJointLimit(
                    joint_name_processed,
                    joint_limit
                );
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
                const joint_name_processed =
                    this.module_urdf.postprocessIdAndClass(joint_name);

                this.domElements.addJoint(
                    joint_name,
                    joint_name_processed,
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

    modelHoverCallback() {
        this.domElements.modelHoverCallback();
    }

    modelUnhoverCallback() {
        this.domElements.modelUnhoverCallback();
    }

    startMeasureCallback() {
        this.domElements.startMeasureCallback();
    }

    continueMeasureCallback() {
        this.domElements.continueMeasureCallback();
    }

    completeMeasureCallback() {
        this.domElements.completeMeasureCallback();
    }

    closeMeasureCallback() {
        this.domElements.closeMeasureCallback();
    }

    measureHoverCallback() {
        this.domElements.measureHoverCallback();
    }

    measureUnhoverCallback() {
        this.domElements.measureUnhoverCallback();
    }

    /**
     * VSCode 消息回调
     * @param message 必须包含 type 键
     */
    public vscodeMessageCallback(message: any) {
        if (message.type === "urdf") {
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
            if (message.reset_camera && message.reset_camera === true) {
                this.module_urdf.resetCamera = true;
            }
            if (message.urdfText) {
                this.module_measure.clearMeaure();
                this.module_urdf.urdfText = message.urdfText;
                this.loadRobot();
            }
        } else if (message.type === "settings") {
            if (message.backgroundColor) {
                this.scene.background = new THREE.Color(
                    message.backgroundColor
                );
                this.render();
            }
            if (message.showTips !== undefined) {
                this.domElements.setShowTips(message.showTips);
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

main = new Main();

// 监听来自 vscode 的消息
window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "init") {
    } else {
        main?.vscodeMessageCallback(message);
    }
});
