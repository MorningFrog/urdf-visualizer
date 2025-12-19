import { createApp, type App as VueApp } from "vue";
import FloatingVue from "floating-vue";
import { vscodeSettings } from "@/stores/vscode-settings";
import { vscode } from "@/utils/vscode-api";
import { i18nMessages } from "@/stores/i18n";
import App from "@/App.vue";
import { vClampCenterX } from "@/directives/clampCenterX";

let app: VueApp<Element> | null = null;

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

// 监听来自 vscode 的消息
window.addEventListener("message", (event) => {
    const message = event.data;

    if (message.type === "settings" || message.type === "init") {
        if (message.i18n !== undefined) {
            // 翻译信息
            Object.assign(i18nMessages, message.i18n);
        }
        if (message.cacheMesh !== undefined) {
            vscodeSettings.cacheMesh = message.cacheMesh;
        }
        if (message.backgroundColor) {
            vscodeSettings.backgroundColor = message.backgroundColor;
        }
        if (message.showTips !== undefined) {
            vscodeSettings.showTips = message.showTips;
        }
        if (message.highlightJointWhenHover !== undefined) {
            vscodeSettings.highlightJointWhenHover =
                message.highlightJointWhenHover;
        }
        if (message.highlightLinkWhenHover !== undefined) {
            vscodeSettings.highlightLinkWhenHover =
                message.highlightLinkWhenHover;
        }
    }
    if (message.type === "urdf" || message.type === "init") {
        if (message.uriPrefix) {
            let uriPrefix: string = message.uriPrefix;
            // 去除末尾的 `/`
            if (message.uriPrefix.endsWith("/")) {
                uriPrefix = message.uriPrefix.slice(0, -1);
            }
            vscodeSettings.uriPrefix = "https://" + uriPrefix;
        }
        if (message.packages) {
            vscodeSettings.packages = message.packages;
        }
        if (message.workingPath) {
            if (message.workingPath.endsWith("/")) {
                vscodeSettings.workingPath = message.workingPath;
            } else {
                vscodeSettings.workingPath = message.workingPath + "/";
            }
        }
        if (message.filename) {
            vscodeSettings.filename = message.filename;
        }
        if (message.reset_camera && message.reset_camera === true) {
            vscodeSettings.requireResetCamera = true;
        }
        if (message.urdfText) {
            vscodeSettings.urdfText = message.urdfText;
        }
    }

    // 延迟创建 Vue 应用, 确保设置已应用
    if (message.type === "init") {
        if (app) return; // 避免重复初始化
        app = createApp(App);
        app.use(FloatingVue).directive("clamp-center-x", vClampCenterX);
        app.mount("#app");
    }
});

// 通知 VSCode Webview 已准备好接收消息
vscode.postMessage({ type: "webviewReady" });
