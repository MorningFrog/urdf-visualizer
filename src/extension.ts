// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

function checkURDFXacroFile(document: vscode.TextDocument) {
    return (
        document.languageId === "xml" &&
        (document.fileName.endsWith(".urdf") ||
            document.fileName.endsWith(".URDF") ||
            document.fileName.endsWith(".xacro"))
    );
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    let config = vscode.workspace.getConfiguration("urdf-visualizer"); // 插件设置

    let activePanel: vscode.WebviewPanel | null = null; // 保存当前打开的 Webview panel

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
                    activePanel.webview.postMessage({
                        type: "urdf",
                        urdfText: editor.document.getText(),
                        packages: config.get<object>("packages"),
                        workingPath: path.dirname(editor.document.fileName),
                    });

                    // 发送背景颜色
                    activePanel.webview.postMessage({
                        type: "settings",
                        backgroundColor: config.get<string>("backgroundColor"),
                    });

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
                            if (editor && checkURDFXacroFile(editor.document)) {
                                activePanel?.webview.postMessage({
                                    type: "urdf",
                                    urdfText: editor.document.getText(),
                                    packages: config.get<object>("packages"),
                                    workingPath: path.dirname(
                                        editor.document.fileName
                                    ),
                                });
                            }
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
                activePanel.webview.postMessage({
                    type: "urdf",
                    urdfText: document.getText(),
                    packages: config.get<object>("packages"),
                    workingPath: path.dirname(document.fileName),
                });
            }
        }
    );

    // 监听活动编辑器变化
    const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(
        (editor) => {
            if (
                config.get<boolean>("reRenderWhenSwitchFile", true) &&
                activePanel &&
                editor &&
                editor.document.languageId === "xml" &&
                checkURDFXacroFile(editor.document)
            ) {
                activePanel.webview.postMessage({
                    type: "urdf",
                    urdfText: editor.document.getText(),
                    packages: config.get<object>("packages"),
                    workingPath: path.dirname(editor.document.fileName),
                });
            }
        }
    );

    // 监听插件设置变化
    const configChangeListener = vscode.workspace.onDidChangeConfiguration(
        (event) => {
            config = vscode.workspace.getConfiguration("urdf-visualizer");
            if (event.affectsConfiguration("urdf-visualizer.packages")) {
                if (activePanel) {
                    activePanel.webview.postMessage({
                        type: "urdf",
                        packages: config.get<object>("packages"),
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
