// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { resolveVariablesInObject } from "./extension_utils";
const { XacroParser } = require("xacro-parser");
const { JSDOM } = require("jsdom");
const { XMLSerializer, XMLDocument } = require("xmldom");

global.DOMParser = new JSDOM().window.DOMParser;

/**
 * 获取文件扩展名
 * @param fileName 文件名
 * @returns 文件扩展名
 */
function getExt(fileName: string): string | null {
    // 扩展名
    const ext = fileName.split(/\./g)?.pop()?.toLowerCase();
    if (!ext) {
        return null;
    }
    return ext;
}

function checkURDFXacroFile(document: vscode.TextDocument) {
    const ext = getExt(document.fileName);
    return (
        ext &&
        document.languageId === "xml" &&
        (ext === "urdf" || ext === "xacro")
    );
}

/**
 * 判断是否为 Xacro 文件
 * @param document 文档
 * @returns 是否为 Xacro 文件
 */
function isXacroFile(document: vscode.TextDocument): boolean {
    const ext = getExt(document.fileName);
    if (!ext) {
        return false;
    }
    return ext === "xacro";
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

    const xacroParser = new XacroParser(); // xacro 解析器
    const serializer = new XMLSerializer(); // XML 序列化器

    // 在 xacroParser 中使用 fs 读取文件内容
    xacroParser.getFileContents = (filePath: string) => {
        return fs.readFileSync(filePath, { encoding: "utf8" });
    };
    // 设置 ROS 功能包路径
    xacroParser.rospackCommands = {
        find: function (pkg: string) {
            if (packagesResolved && packagesResolved[pkg]) {
                return packagesResolved[pkg];
            } else {
                return "";
            }
        },
    };

    // 向 webview 发送完整的 URDF 文件内容
    function sendURDFContent(document: vscode.TextDocument) {
        if (!activePanel) {
            return;
        }
        if (isXacroFile(document)) {
            const workingPath = path.dirname(document.fileName);
            // console.log(document.getText());
            xacroParser.workingPath = workingPath;
            xacroParser.parse(document.getText()).then((data: XMLDocument) => {
                sendURDF(serializer.serializeToString(data), workingPath);
            });
        } else {
            sendURDF(document.getText(), path.dirname(document.fileName));
        }
        // 发送 URDF 文件内容
        function sendURDF(urdfText: string, workingPath: string) {
            activePanel?.webview.postMessage({
                type: "urdf",
                urdfText: urdfText,
                packages: packagesResolved,
                workingPath: workingPath,
            });
        }
    }

    // 将 Webview 的内容替换为绝对路径
    function getWebviewContent(): string | undefined {
        const extensionPath = context.extensionPath;
        // 找到你的 index.html 所在文件夹的绝对路径
        const htmlRoot = path.join(extensionPath, "src", "webview");
        const htmlIndexPath = path.join(htmlRoot, "preview.html");
        const html = fs
            .readFileSync(htmlIndexPath, "utf-8")
            ?.replace(
                /(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g,
                (m: string, $1: string, $2: string) => {
                    const absLocalPath = path.resolve(htmlRoot, $2);
                    const webviewUri = activePanel?.webview.asWebviewUri(
                        vscode.Uri.file(absLocalPath)
                    );
                    const replaceHref = $1 + webviewUri?.toString() + '"';
                    return replaceHref;
                }
            );
        return html;
    }

    const previewCommand = vscode.commands.registerCommand(
        "urdf-visualizer.previewURDFXacro", // 预览 URDF 或 Xacro 文件
        () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && checkURDFXacroFile(editor.document)) {
                if (activePanel) {
                    // 如果已有Webview panel,则直接重新显示
                    activePanel.reveal(vscode.ViewColumn.Beside);
                    // 更新 previousDocument
                    previousDocument = editor.document;
                } else {
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
                    const htmlContent = getWebviewContent();
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
                            "URDF-Visualizer.png"
                        )
                    );

                    // 发送初始的 URDF 文件内容到 Webview
                    sendURDFContent(editor.document);

                    // 发送背景颜色
                    activePanel.webview.postMessage({
                        type: "settings",
                        backgroundColor: config.get<string>("backgroundColor"),
                    });

                    // 更新 previousDocument
                    previousDocument = editor.document;

                    // 监听 Webview 发送的消息
                    activePanel.webview.onDidReceiveMessage((message) => {
                        if (message.type === "resolvePaths") {
                            let pathMapping: { [key: string]: string } = {};
                            for (const pathToResolve of message.pathsToResolve) {
                                const webviewPath =
                                    activePanel?.webview.asWebviewUri(
                                        vscode.Uri.file(pathToResolve)
                                    );
                                if (webviewPath) {
                                    pathMapping[pathToResolve] =
                                        webviewPath.toString();
                                }
                            }
                            activePanel?.webview.postMessage({
                                type: "resolvedPaths",
                                pathMapping: pathMapping,
                            });
                        } else if (message.type === "getNewURDF") {
                            // 获取新的 URDF 文件内容
                            const editor = vscode.window.activeTextEditor;
                            let document = previousDocument;
                            if (editor && checkURDFXacroFile(editor.document)) {
                                document = editor.document;
                                previousDocument = document;
                            }
                            if (document) {
                                sendURDFContent(document);
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
                checkURDFXacroFile(document)
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
                editor.document.languageId === "xml" &&
                checkURDFXacroFile(editor.document)
            ) {
                previousDocument = editor.document;
                sendURDFContent(editor.document);
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
            if (event.affectsConfiguration("urdf-visualizer.backgroundColor")) {
                if (activePanel) {
                    activePanel.webview.postMessage({
                        type: "settings",
                        backgroundColor: config.get<string>("backgroundColor"),
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
