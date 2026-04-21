"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const extension_utils_1 = require("./extension-utils");
const { XMLSerializer, XMLDocument } = require("xmldom");
const xacro_parser_instance_1 = require("./xacro-parser-instance");
const localize_1 = __importStar(require("./localize"));
const webviewSettingSections = [
    "cacheMesh",
    "showTips",
    "highlightJointWhenHover",
    "highlightLinkWhenHover",
    "cacheCameraView",
    "cacheJointValues",
    "default.showVisual",
    "default.showCollision",
    "default.showInertia",
    "default.showWorldFrame",
    "default.showJointFrames",
    "default.showLinkFrames",
    "default.jointFrameSize",
    "default.linkFrameSize",
    "default.lengthUnit",
    "default.angleUnit",
    "default.collisionColor",
    "default.inertiaColor",
    "backgroundColor",
    "default.measurement.precision",
    "default.measurement.useSciNotation",
    "default.measurement.labelSize",
    "default.measurement.labelColor",
    "default.measurement.lineColor",
    "default.measurement.lineThickness",
    "default.measurement.pointColor",
    "default.measurement.pointSize",
    "default.measurement.surfaceColor",
];
function getWebviewSettingsPayload(config) {
    return {
        vscodeSettings: {
            cacheMesh: config.get("cacheMesh"),
            showTips: config.get("showTips"),
            highlightJointWhenHover: config.get("highlightJointWhenHover"),
            highlightLinkWhenHover: config.get("highlightLinkWhenHover"),
            cacheCameraView: config.get("cacheCameraView"),
            cacheJointValues: config.get("cacheJointValues"),
        },
        visualSettings: {
            showVisual: config.get("default.showVisual"),
            showCollision: config.get("default.showCollision"),
            showInertia: config.get("default.showInertia"),
            showWorldFrame: config.get("default.showWorldFrame"),
            showJointFrames: config.get("default.showJointFrames"),
            showLinkFrames: config.get("default.showLinkFrames"),
            jointFrameSize: config.get("default.jointFrameSize"),
            linkFrameSize: config.get("default.linkFrameSize"),
            lengthUnit: config.get("default.lengthUnit"),
            angleUnit: config.get("default.angleUnit"),
            collisionColor: config.get("default.collisionColor"),
            inertiaColor: config.get("default.inertiaColor"),
            backgroundColor: config.get("backgroundColor"),
        },
        measureSettings: {
            precision: config.get("default.measurement.precision"),
            useSciNotation: config.get("default.measurement.useSciNotation"),
            labelSize: config.get("default.measurement.labelSize"),
            labelColor: config.get("default.measurement.labelColor"),
            lineColor: config.get("default.measurement.lineColor"),
            lineThickness: config.get("default.measurement.lineThickness"),
            pointColor: config.get("default.measurement.pointColor"),
            pointSize: config.get("default.measurement.pointSize"),
            surfaceColor: config.get("default.measurement.surfaceColor"),
        },
    };
}
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    let config = vscode.workspace.getConfiguration("urdf-visualizer"); // 插件设置
    let packagesResolved = (0, extension_utils_1.resolveVariablesInObject)(
    // @ts-ignore
    config.get("packages"), vscode.workspace.workspaceFolders?.[0]); // ROS 功能包路径
    let activePanel = null; // 保存当前打开的 Webview panel
    let previousDocument = null; // 保存上一个document
    let uriPrefix = null; // 保存当前文件的 URI 前缀
    const serializer = new XMLSerializer(); // XML 序列化器
    const promptedMissingPackages = new Set();
    function formatMissingPackageNames(packageNames) {
        return packageNames.map((packageName) => `"${packageName}"`).join(", ");
    }
    async function promptMissingPackages(packageNames) {
        const newMissingPackages = packageNames.filter((packageName) => !promptedMissingPackages.has(packageName));
        if (newMissingPackages.length === 0) {
            return;
        }
        newMissingPackages.forEach((packageName) => promptedMissingPackages.add(packageName));
        const openSettingsLabel = (0, localize_1.default)("extension.message.packageMissing.openSettings");
        const message = newMissingPackages.length === 1
            ? (0, localize_1.default)("extension.message.packageMissing.single", `"${newMissingPackages[0]}"`)
            : (0, localize_1.default)("extension.message.packageMissing.multiple", formatMissingPackageNames(newMissingPackages));
        const selected = await vscode.window.showErrorMessage(message, openSettingsLabel);
        if (selected === openSettingsLabel) {
            await vscode.commands.executeCommand("workbench.action.openSettings", "@id:urdf-visualizer.packages");
        }
    }
    // 设置 ROS 功能包路径
    xacro_parser_instance_1.xacroParser.rospackCommands = {
        find: function (pkg) {
            if (packagesResolved && packagesResolved[pkg]) {
                return packagesResolved[pkg];
            }
            else {
                throw new Error(`Package "${pkg}" not found`);
            }
        },
    };
    // 向 webview 发送完整的 URDF 文件内容
    function sendURDFContent(document, other_params = {}, message_type = "urdf") {
        if (!activePanel) {
            return;
        }
        // 获取文件名和工作目录
        const workingPath = path.dirname(document.fileName);
        const fileName = path.basename(document.fileName);
        // 设置 Webview 标题为当前文件名+Preview
        activePanel.title = fileName + " Preview";
        if ((0, extension_utils_1.isXacroFile)(document)) {
            // console.log(document.getText());
            xacro_parser_instance_1.xacroParser.workingPath = workingPath;
            xacro_parser_instance_1.xacroParser
                .parse(document.getText())
                .catch((error) => {
                vscode.window.showErrorMessage(error.message);
            })
                // @ts-ignore
                .then((data) => {
                sendURDF(serializer.serializeToString(data));
            });
        }
        else {
            sendURDF(document.getText());
        }
        // 发送 URDF 文件内容
        function sendURDF(urdfText) {
            const missingPackages = (0, extension_utils_1.findMissingPackagesInUrdf)(urdfText, packagesResolved);
            void promptMissingPackages(missingPackages);
            activePanel?.webview.postMessage({
                type: message_type,
                urdfText: urdfText,
                packages: packagesResolved,
                workingPath: workingPath,
                filename: fileName,
                ...other_params,
            });
        }
    }
    const previewCommand = vscode.commands.registerCommand("urdf-visualizer.previewURDFXacro", // 预览 URDF 或 Xacro 文件
    () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && (0, extension_utils_1.isUrdfOrXacroFile)(editor.document)) {
            if (activePanel) {
                // 如果已有Webview panel,则直接重新显示
                activePanel.reveal(vscode.ViewColumn.Beside);
                // 更新 previousDocument
                previousDocument = editor.document;
            }
            else {
                // 还没有Webview panel, 则创建
                activePanel = vscode.window.createWebviewPanel("urdfVisualizer", "URDF/Xacro Preview", vscode.ViewColumn.Beside, {
                    enableScripts: true, // 启用 JS
                    retainContextWhenHidden: true, // 隐藏时保留内容
                });
                // 当用户关闭 Webview 时, 将 panel 设为 null
                activePanel.onDidDispose(() => {
                    activePanel = null;
                });
                // 渲染 HTML
                const htmlContent = (0, extension_utils_1.getWebviewContent)(context, activePanel);
                if (!htmlContent) {
                    vscode.window.showErrorMessage("Failed to load preview");
                    return;
                }
                activePanel.webview.html = htmlContent;
                activePanel.iconPath = vscode.Uri.file(path.join(context.extensionPath, "media", "icons", "URDF-Visualizer.png"));
                uriPrefix = activePanel.webview.asWebviewUri(vscode.Uri.file(path.dirname(editor.document.fileName))).authority;
                // 更新 previousDocument
                previousDocument = editor.document;
                // 监听 Webview 发送的消息
                activePanel.webview.onDidReceiveMessage((message) => {
                    if (message.type === "webviewReady") {
                        // Webview 已准备好, 发送初始化信息
                        sendURDFContent(editor.document, {
                            i18n: localize_1.localizeInstance.bundle,
                            reset_camera: true,
                            uriPrefix: uriPrefix,
                            ...getWebviewSettingsPayload(config),
                        }, "init");
                    }
                    else if (message.type === "getNewURDF") {
                        // 获取新的 URDF 文件内容
                        const editor = vscode.window.activeTextEditor;
                        let document = previousDocument;
                        if (editor && (0, extension_utils_1.isUrdfOrXacroFile)(editor.document)) {
                            document = editor.document;
                            previousDocument = document;
                        }
                        if (document) {
                            sendURDFContent(document, {
                                reset_camera: true,
                                uriPrefix: uriPrefix,
                            });
                        }
                    }
                    else if (message.type === "error") {
                        // 报错
                        const missingPackage = (0, extension_utils_1.extractMissingPackageFromErrorMessage)(message.message);
                        if (missingPackage) {
                            void promptMissingPackages([missingPackage]);
                        }
                        else {
                            vscode.window.showErrorMessage(message.message);
                        }
                    }
                });
            }
        }
    });
    // 监听文件保存,更新Webview内容
    const textSaveListener = vscode.workspace.onDidSaveTextDocument((document) => {
        // 检查文件是否为 .urdf 或 .xacro 文件
        if (config.get("renderOnSave", true) &&
            activePanel &&
            document.languageId === "xml" &&
            (0, extension_utils_1.isUrdfOrXacroFile)(document)) {
            sendURDFContent(document);
        }
    });
    // 监听活动编辑器变化
    const editorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!editor) {
            return;
        }
        if (previousDocument && previousDocument === editor.document) {
            return;
        }
        if (config.get("reRenderWhenSwitchFile", true) &&
            activePanel &&
            (0, extension_utils_1.isUrdfOrXacroFile)(editor.document)) {
            previousDocument = editor.document;
            sendURDFContent(editor.document, {
                reset_camera: true,
                uriPrefix: uriPrefix,
            });
        }
    });
    // 监听插件设置变化
    const configChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
        config = vscode.workspace.getConfiguration("urdf-visualizer");
        if (event.affectsConfiguration("urdf-visualizer.packages")) {
            packagesResolved = (0, extension_utils_1.resolveVariablesInObject)(
            // @ts-ignore
            config.get("packages"), vscode.workspace.workspaceFolders?.[0]);
            promptedMissingPackages.clear();
            if (activePanel) {
                activePanel.webview.postMessage({
                    type: "urdf",
                    packages: packagesResolved,
                });
            }
        }
        const affectsWebviewSettings = webviewSettingSections.some((settingKey) => event.affectsConfiguration(`urdf-visualizer.${settingKey}`));
        if (affectsWebviewSettings) {
            if (activePanel) {
                activePanel.webview.postMessage({
                    type: "settings",
                    ...getWebviewSettingsPayload(config),
                });
            }
        }
    });
    context.subscriptions.push(previewCommand);
    context.subscriptions.push(textSaveListener);
    context.subscriptions.push(editorChangeListener);
    context.subscriptions.push(configChangeListener);
}
// This method is called when your extension is deactivated
function deactivate() { }
//# sourceMappingURL=extension.js.map