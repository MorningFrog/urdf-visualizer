// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
    resolveVariablesInObject,
    getWebviewContent,
    isUrdfOrXacroFile,
    isXacroFile,
} from "./extension-utils";
const { XMLSerializer, XMLDocument } = require("xmldom");
import { xacroParser } from "./xacro-parser-instance";
import { localizeInstance } from "./localize";

interface WebviewVscodeSettingsPayload {
    cacheMesh?: boolean;
    showTips?: boolean;
    highlightJointWhenHover?: boolean;
    highlightLinkWhenHover?: boolean;
}

interface WebviewVisualSettingsPayload {
    showVisual?: boolean;
    showCollision?: boolean;
    showWorldFrame?: boolean;
    showJointFrames?: boolean;
    showLinkFrames?: boolean;
    jointFrameSize?: number;
    linkFrameSize?: number;
    lengthUnit?: string;
    angleUnit?: string;
    collisionColor?: string;
    backgroundColor?: string;
}

interface WebviewMeasureSettingsPayload {
    precision?: number;
    useSciNotation?: boolean;
    labelSize?: number;
    lineColor?: string;
    lineThickness?: number;
    pointColor?: string;
    pointSize?: number;
    surfaceColor?: string;
    labelColor?: string;
}

interface WebviewSettingsPayload {
    vscodeSettings: WebviewVscodeSettingsPayload;
    visualSettings: WebviewVisualSettingsPayload;
    measureSettings: WebviewMeasureSettingsPayload;
}

const webviewSettingSections = [
    "cacheMesh",
    "showTips",
    "highlightJointWhenHover",
    "highlightLinkWhenHover",
    "default.showVisual",
    "default.showCollision",
    "default.showWorldFrame",
    "default.showJointFrames",
    "default.showLinkFrames",
    "default.jointFrameSize",
    "default.linkFrameSize",
    "default.lengthUnit",
    "default.angleUnit",
    "default.collisionColor",
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
] as const;

function getWebviewSettingsPayload(
    config: vscode.WorkspaceConfiguration
): WebviewSettingsPayload {
    return {
        vscodeSettings: {
            cacheMesh: config.get<boolean>("cacheMesh"),
            showTips: config.get<boolean>("showTips"),
            highlightJointWhenHover: config.get<boolean>(
                "highlightJointWhenHover"
            ),
            highlightLinkWhenHover: config.get<boolean>(
                "highlightLinkWhenHover"
            ),
        },
        visualSettings: {
            showVisual: config.get<boolean>("default.showVisual"),
            showCollision: config.get<boolean>("default.showCollision"),
            showWorldFrame: config.get<boolean>("default.showWorldFrame"),
            showJointFrames: config.get<boolean>("default.showJointFrames"),
            showLinkFrames: config.get<boolean>("default.showLinkFrames"),
            jointFrameSize: config.get<number>("default.jointFrameSize"),
            linkFrameSize: config.get<number>("default.linkFrameSize"),
            lengthUnit: config.get<string>("default.lengthUnit"),
            angleUnit: config.get<string>("default.angleUnit"),
            collisionColor: config.get<string>("default.collisionColor"),
            backgroundColor: config.get<string>("backgroundColor"),
        },
        measureSettings: {
            precision: config.get<number>("default.measurement.precision"),
            useSciNotation: config.get<boolean>(
                "default.measurement.useSciNotation"
            ),
            labelSize: config.get<number>("default.measurement.labelSize"),
            labelColor: config.get<string>("default.measurement.labelColor"),
            lineColor: config.get<string>("default.measurement.lineColor"),
            lineThickness: config.get<number>(
                "default.measurement.lineThickness"
            ),
            pointColor: config.get<string>("default.measurement.pointColor"),
            pointSize: config.get<number>("default.measurement.pointSize"),
            surfaceColor: config.get<string>("default.measurement.surfaceColor"),
        },
    };
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    let config = vscode.workspace.getConfiguration("urdf-visualizer"); // 插件设置
    let packagesResolved = resolveVariablesInObject(
        // @ts-ignore
        config.get<object>("packages"),
        vscode.workspace.workspaceFolders?.[0]
    ); // ROS 功能包路径

    let activePanel: vscode.WebviewPanel | null = null; // 保存当前打开的 Webview panel

    let previousDocument: vscode.TextDocument | null = null; // 保存上一个document

    let uriPrefix: string | null = null; // 保存当前文件的 URI 前缀

    const serializer = new XMLSerializer(); // XML 序列化器

    // 设置 ROS 功能包路径
    xacroParser.rospackCommands = {
        find: function (pkg: string) {
            if (packagesResolved && packagesResolved[pkg]) {
                return packagesResolved[pkg];
            } else {
                throw new Error(`Package "${pkg}" not found`);
            }
        },
    };

    // 向 webview 发送完整的 URDF 文件内容
    function sendURDFContent(
        document: vscode.TextDocument,
        other_params: object = {},
        message_type = "urdf"
    ) {
        if (!activePanel) {
            return;
        }
        // 获取文件名和工作目录
        const workingPath = path.dirname(document.fileName);
        const fileName = path.basename(document.fileName);

        // 设置 Webview 标题为当前文件名+Preview
        activePanel.title = fileName + " Preview";

        if (isXacroFile(document)) {
            // console.log(document.getText());
            xacroParser.workingPath = workingPath;
            xacroParser
                .parse(document.getText())
                .catch((error: { message: string }) => {
                    vscode.window.showErrorMessage(error.message);
                })
                // @ts-ignore
                .then((data: XMLDocument) => {
                    sendURDF(serializer.serializeToString(data));
                });
        } else {
            sendURDF(document.getText());
        }
        // 发送 URDF 文件内容
        function sendURDF(urdfText: string) {
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

    const previewCommand = vscode.commands.registerCommand(
        "urdf-visualizer.previewURDFXacro", // 预览 URDF 或 Xacro 文件
        () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && isUrdfOrXacroFile(editor.document)) {
                if (activePanel) {
                    // 如果已有Webview panel,则直接重新显示
                    activePanel.reveal(vscode.ViewColumn.Beside);
                    // 更新 previousDocument
                    previousDocument = editor.document;
                } else {
                    // 还没有Webview panel, 则创建
                    activePanel = vscode.window.createWebviewPanel(
                        "urdfVisualizer",
                        "URDF/Xacro Preview",
                        vscode.ViewColumn.Beside,
                        {
                            enableScripts: true, // 启用 JS
                            retainContextWhenHidden: true, // 隐藏时保留内容
                        }
                    );

                    // 当用户关闭 Webview 时, 将 panel 设为 null
                    activePanel.onDidDispose(() => {
                        activePanel = null;
                    });

                    // 渲染 HTML
                    const htmlContent = getWebviewContent(context, activePanel);
                    if (!htmlContent) {
                        vscode.window.showErrorMessage(
                            "Failed to load preview"
                        );
                        return;
                    }
                    activePanel.webview.html = htmlContent;
                    activePanel.iconPath = vscode.Uri.file(
                        path.join(
                            context.extensionPath,
                            "media",
                            "icons",
                            "URDF-Visualizer.png"
                        )
                    );

                    uriPrefix = activePanel.webview.asWebviewUri(
                        vscode.Uri.file(path.dirname(editor.document.fileName))
                    ).authority;

                    // 更新 previousDocument
                    previousDocument = editor.document;

                    // 监听 Webview 发送的消息
                    activePanel.webview.onDidReceiveMessage((message) => {
                        if (message.type === "webviewReady") {
                            // Webview 已准备好, 发送初始化信息
                            sendURDFContent(
                                editor.document,
                                {
                                    i18n: localizeInstance.bundle,
                                    reset_camera: true,
                                    uriPrefix: uriPrefix,
                                    ...getWebviewSettingsPayload(config),
                                },
                                "init"
                            );
                        } else if (message.type === "getNewURDF") {
                            // 获取新的 URDF 文件内容
                            const editor = vscode.window.activeTextEditor;
                            let document = previousDocument;
                            if (editor && isUrdfOrXacroFile(editor.document)) {
                                document = editor.document;
                                previousDocument = document;
                            }
                            if (document) {
                                sendURDFContent(document, {
                                    reset_camera: true,
                                    uriPrefix: uriPrefix,
                                });
                            }
                        } else if (message.type === "error") {
                            // 报错
                            vscode.window.showErrorMessage(message.message);
                        }
                    });
                }
            }
        }
    );

    // 监听文件保存,更新Webview内容
    const textSaveListener = vscode.workspace.onDidSaveTextDocument(
        (document) => {
            // 检查文件是否为 .urdf 或 .xacro 文件
            if (
                config.get<boolean>("renderOnSave", true) &&
                activePanel &&
                document.languageId === "xml" &&
                isUrdfOrXacroFile(document)
            ) {
                sendURDFContent(document);
            }
        }
    );

    // 监听活动编辑器变化
    const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(
        (editor) => {
            if (!editor) {
                return;
            }
            if (previousDocument && previousDocument === editor.document) {
                return;
            }
            if (
                config.get<boolean>("reRenderWhenSwitchFile", true) &&
                activePanel &&
                isUrdfOrXacroFile(editor.document)
            ) {
                previousDocument = editor.document;
                sendURDFContent(editor.document, {
                    reset_camera: true,
                    uriPrefix: uriPrefix,
                });
            }
        }
    );

    // 监听插件设置变化
    const configChangeListener = vscode.workspace.onDidChangeConfiguration(
        (event) => {
            config = vscode.workspace.getConfiguration("urdf-visualizer");
            if (event.affectsConfiguration("urdf-visualizer.packages")) {
                packagesResolved = resolveVariablesInObject(
                    // @ts-ignore
                    config.get<object>("packages"),
                    vscode.workspace.workspaceFolders?.[0]
                );
                if (activePanel) {
                    activePanel.webview.postMessage({
                        type: "urdf",
                        packages: packagesResolved,
                    });
                }
            }

            const affectsWebviewSettings = webviewSettingSections.some(
                (settingKey) =>
                    event.affectsConfiguration(
                        `urdf-visualizer.${settingKey}`
                    )
            );
            if (affectsWebviewSettings) {
                if (activePanel) {
                    activePanel.webview.postMessage({
                        type: "settings",
                        ...getWebviewSettingsPayload(config),
                    });
                }
            }
        }
    );

    context.subscriptions.push(previewCommand);
    context.subscriptions.push(textSaveListener);
    context.subscriptions.push(editorChangeListener);
    context.subscriptions.push(configChangeListener);
}

// This method is called when your extension is deactivated
export function deactivate() {}
