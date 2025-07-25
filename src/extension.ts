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
} from "./extension_utils";
const { XMLSerializer, XMLDocument } = require("xmldom");
import { xacroParser } from "./xacro_parser_instance";

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
        // 设置 Webview 标题为当前文件名+Preview
        activePanel.title = path.basename(document.fileName) + " Preview";

        if (isXacroFile(document)) {
            const workingPath = path.dirname(document.fileName);
            // console.log(document.getText());
            xacroParser.workingPath = workingPath;
            xacroParser
                .parse(document.getText())
                .catch((error: { message: string }) => {
                    vscode.window.showErrorMessage(error.message);
                })
                // @ts-ignore
                .then((data: XMLDocument) => {
                    sendURDF(serializer.serializeToString(data), workingPath);
                });
        } else {
            sendURDF(document.getText(), path.dirname(document.fileName));
        }
        // 发送 URDF 文件内容
        function sendURDF(urdfText: string, workingPath: string) {
            activePanel?.webview.postMessage({
                type: message_type,
                urdfText: urdfText,
                packages: packagesResolved,
                workingPath: workingPath,
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

                    // 让 Webview 初始化页面并发送 URDF
                    sendURDFContent(
                        editor.document,
                        {
                            reset_camera: true,
                            uriPrefix: uriPrefix,
                            cacheMesh: config.get<boolean>("cacheMesh", true),
                            backgroundColor:
                                config.get<string>("backgroundColor"),
                            showTips: config.get<boolean>("showTips"),
                            highlightJointWhenHover: config.get<boolean>(
                                "highlightJointWhenHover"
                            ),
                            highlightLinkWhenHover: config.get<boolean>(
                                "highlightLinkWhenHover"
                            ),
                        },
                        "init"
                    );

                    // 更新 previousDocument
                    previousDocument = editor.document;

                    // 监听 Webview 发送的消息
                    activePanel.webview.onDidReceiveMessage((message) => {
                        if (message.type === "getNewURDF") {
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
            if (event.affectsConfiguration("urdf-visualizer.cacheMesh")) {
                if (activePanel) {
                    activePanel.webview.postMessage({
                        type: "settings",
                        cacheMesh: config.get<boolean>("cacheMesh", true),
                    });
                }
            }

            if (event.affectsConfiguration("urdf-visualizer.backgroundColor")) {
                if (activePanel) {
                    activePanel.webview.postMessage({
                        type: "settings",
                        backgroundColor: config.get<string>("backgroundColor"),
                    });
                }
            }
            if (event.affectsConfiguration("urdf-visualizer.showTips")) {
                if (activePanel) {
                    activePanel.webview.postMessage({
                        type: "settings",
                        showTips: config.get<boolean>("showTips"),
                    });
                }
            }
            if (
                event.affectsConfiguration(
                    "urdf-visualizer.highlightJointWhenHover"
                )
            ) {
                if (activePanel) {
                    activePanel.webview.postMessage({
                        type: "settings",
                        highlightJointWhenHover: config.get<boolean>(
                            "highlightJointWhenHover"
                        ),
                    });
                }
            }
            if (
                event.affectsConfiguration(
                    "urdf-visualizer.highlightLinkWhenHover"
                )
            ) {
                if (activePanel) {
                    activePanel.webview.postMessage({
                        type: "settings",
                        highlightLinkWhenHover: config.get<boolean>(
                            "highlightLinkWhenHover"
                        ),
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
