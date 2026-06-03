// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as path from "path";
import * as vscode from "vscode";
import {
    extractMissingPackageFromErrorMessage,
    findMissingPackagesInUrdf,
    getWebviewContent,
    isUrdfOrXacroFile,
    isXacroFile,
    resolveVariablesInObject,
} from "./extension-utils";
import localize, { localizeInstance } from "./localize";
import { xacroParser } from "./xacro-parser-instance";
const { XMLSerializer, XMLDocument } = require("xmldom");

interface WebviewVscodeSettingsPayload {
    cacheMesh?: boolean;
    showTips?: boolean;
    highlightJointWhenHover?: boolean;
    highlightLinkWhenHover?: boolean;
    cacheCameraView?: boolean;
    cacheJointValues?: boolean;
    lockToPreviewedFile?: boolean;
}

interface WebviewVisualSettingsPayload {
    showVisual?: boolean;
    showCollision?: boolean;
    showInertia?: boolean;
    showInertiaWhenHover?: boolean;
    showWorldFrame?: boolean;
    showJointFrames?: boolean;
    showLinkFrames?: boolean;
    jointFrameSize?: number;
    linkFrameSize?: number;
    lengthUnit?: string;
    angleUnit?: string;
    collisionColor?: string;
    inertiaColor?: string;
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
    "cacheCameraView",
    "cacheJointValues",
    "default.showVisual",
    "default.showCollision",
    "default.showInertia",
    "default.showInertiaWhenHover",
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
            cacheCameraView: config.get<boolean>(
                "cacheCameraView"
            ),
            cacheJointValues: config.get<boolean>(
                "cacheJointValues"
            ),
        },
        visualSettings: {
            showVisual: config.get<boolean>("default.showVisual"),
            showCollision: config.get<boolean>("default.showCollision"),
            showInertia: config.get<boolean>("default.showInertia"),
            showInertiaWhenHover: config.get<boolean>(
                "default.showInertiaWhenHover"
            ),
            showWorldFrame: config.get<boolean>("default.showWorldFrame"),
            showJointFrames: config.get<boolean>("default.showJointFrames"),
            showLinkFrames: config.get<boolean>("default.showLinkFrames"),
            jointFrameSize: config.get<number>("default.jointFrameSize"),
            linkFrameSize: config.get<number>("default.linkFrameSize"),
            lengthUnit: config.get<string>("default.lengthUnit"),
            angleUnit: config.get<string>("default.angleUnit"),
            collisionColor: config.get<string>("default.collisionColor"),
            inertiaColor: config.get<string>("default.inertiaColor"),
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

// Pull <param name="initial_value">VALUE</param> out of
// <state_interface name="position"> inside each <joint name="X"> inside any
// <ros2_control> block. Values are radians for revolute joints / meters for
// prismatic, per URDF/ROS convention — no unit conversion needed.
function extractInitialJointValues(urdfText: string): Record<string, number> {
    const out: Record<string, number> = {};
    const blockRe =
        /<ros2_control\b[\s\S]*?<\/ros2_control>/g;
    const jointRe =
        /<joint\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/joint>/g;
    const initRe =
        /<state_interface\b[^>]*\bname="position"[^>]*>[\s\S]*?<param\b[^>]*\bname="initial_value"[^>]*>\s*([^<\s][^<]*?)\s*<\/param>/;

    let block: RegExpExecArray | null;
    while ((block = blockRe.exec(urdfText)) !== null) {
        let joint: RegExpExecArray | null;
        const jointScan = new RegExp(jointRe);
        while ((joint = jointScan.exec(block[0])) !== null) {
            const m = joint[2].match(initRe);
            if (!m) continue;
            const value = Number(m[1]);
            if (Number.isFinite(value)) {
                out[joint[1]] = value;
            }
        }
    }
    return out;
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

    // When the lock is on, this holds the document the user explicitly locked
    // onto; saves to any other file then re-render *this* doc instead. Set on
    // lock-on (via configChange reconciliation), cleared on lock-off. Kept
    // separate from previousDocument so the editor-switch logic stays clean.
    let lockedDocument: vscode.TextDocument | null = null;

    let uriPrefix: string | null = null; // 保存当前文件的 URI 前缀

    const serializer = new XMLSerializer(); // XML 序列化器
    const promptedMissingPackages = new Set<string>();

    function formatMissingPackageNames(packageNames: string[]) {
        return packageNames.map((packageName) => `"${packageName}"`).join(", ");
    }

    function postLockStateToWebview() {
        activePanel?.webview.postMessage({
            type: "settings",
            vscodeSettings: {
                lockToPreviewedFile: !!lockedDocument,
            },
        });
    }

    function clearLockedDocument(syncWebview = true) {
        if (!lockedDocument) {
            return;
        }

        lockedDocument = null;
        if (syncWebview) {
            postLockStateToWebview();
        }
    }

    async function promptMissingPackages(packageNames: string[]) {
        const newMissingPackages = packageNames.filter(
            (packageName) => !promptedMissingPackages.has(packageName)
        );

        if (newMissingPackages.length === 0) {
            return;
        }

        newMissingPackages.forEach((packageName) =>
            promptedMissingPackages.add(packageName)
        );

        const openSettingsLabel = localize(
            "extension.message.packageMissing.openSettings"
        );
        const message =
            newMissingPackages.length === 1
                ? localize(
                      "extension.message.packageMissing.single",
                      `"${newMissingPackages[0]}"`
                  )
                : localize(
                      "extension.message.packageMissing.multiple",
                      formatMissingPackageNames(newMissingPackages)
                  );

        const selected = await vscode.window.showErrorMessage(
            message,
            openSettingsLabel
        );

        if (selected === openSettingsLabel) {
            await vscode.commands.executeCommand(
                "workbench.action.openSettings",
                "@id:urdf-visualizer.packages"
            );
        }
    }

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
            // Remove <visual>/<collision> blocks whose <geometry> is effectively
            // empty (no child element; only whitespace and/or XML comments).
            // URDFLoader does `geometry.children[0].nodeName` without a null-check
            // and crashes the entire parse, dropping every link/joint after it.
            // TODO: remove once gkjohnson/urdf-loaders adds null-check at
            //       URDFLoader.js:~520 (`n.children[0].nodeName`).
            urdfText = urdfText.replace(
                /<(visual|collision)\b[^>]*>(?:(?!<\/\1>)[\s\S])*?<geometry>(?:\s|<!--[\s\S]*?-->)*<\/geometry>(?:(?!<\/\1>)[\s\S])*?<\/\1>/g,
                ""
            );

            // Strip <gazebo> blocks. They carry ignition:/sdf: namespaced
            // attributes whose prefix isn't declared in the merged output's
            // root scope; URDFLoader trips on the dangling namespace ref.
            urdfText = urdfText
                .replace(/<gazebo\b[^>]*\/>/g, "")
                .replace(/<gazebo\b[\s\S]*?<\/gazebo>/g, "");

            // Rewrite file://<abs-path-of-a-known-package>/ -> package://<name>/.
            // Python xacro emits file:// URLs from $(find pkg) in sim branches,
            // and URDFLoader treats absolute file:// URLs as relative to the URDF
            // dir, producing 404s. Routing them through the package resolver fixes
            // it without modifying URDFLoader.
            if (packagesResolved) {
                for (const [pkgName, pkgDir] of Object.entries(
                    packagesResolved as Record<string, string>
                )) {
                    if (!pkgDir) continue;
                    urdfText = urdfText
                        .split(`file://${pkgDir}/`)
                        .join(`package://${pkgName}/`);
                }
            }

            // Extract initial joint positions from <ros2_control> before we
            // forget about them. ros2_control is non-standard URDF; the
            // visualizer otherwise defaults every joint to 0. Values are in
            // radians (for revolute) per URDF/ROS convention.
            const initialJointValues = extractInitialJointValues(urdfText);

            const missingPackages = findMissingPackagesInUrdf(
                urdfText,
                packagesResolved as Record<string, string> | undefined
            );
            void promptMissingPackages(missingPackages);

            activePanel?.webview.postMessage({
                type: message_type,
                urdfText: urdfText,
                packages: packagesResolved,
                workingPath: workingPath,
                filename: fileName,
                initialJointValues,
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
                    if (lockedDocument && lockedDocument !== editor.document) {
                        clearLockedDocument();
                    } else {
                        postLockStateToWebview();
                    }
                } else {
                    clearLockedDocument(false);
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
                        lockedDocument = null;
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
                            // Webview 已准备好, 发送初始化信息.
                            // Inject runtime lock state on top of the config
                            // payload so a webview reload picks up the
                            // extension's current lockedDocument.
                            const settingsPayload = getWebviewSettingsPayload(
                                config
                            );
                            settingsPayload.vscodeSettings.lockToPreviewedFile =
                                !!lockedDocument;
                            const document =
                                lockedDocument ??
                                previousDocument ??
                                editor.document;
                            sendURDFContent(
                                document,
                                {
                                    i18n: localizeInstance.bundle,
                                    reset_camera: true,
                                    uriPrefix: uriPrefix,
                                    ...settingsPayload,
                                },
                                "init"
                            );
                        } else if (message.type === "getNewURDF") {
                            // 获取新的 URDF 文件内容.
                            // When locked, reload re-renders the locked doc
                            // regardless of which editor is active.
                            let document: vscode.TextDocument | null =
                                lockedDocument;
                            if (!document) {
                                const editor = vscode.window.activeTextEditor;
                                document = previousDocument;
                                if (
                                    editor &&
                                    isUrdfOrXacroFile(editor.document)
                                ) {
                                    document = editor.document;
                                    previousDocument = document;
                                }
                            }
                            if (document) {
                                sendURDFContent(document, {
                                    reset_camera: true,
                                    uriPrefix: uriPrefix,
                                });
                            }
                        } else if (message.type === "toggleLockToPreviewedFile") {
                            // Pure runtime state — no config persistence.
                            // Lock-on captures the currently previewed doc;
                            // lock-off clears it. Then broadcast the new
                            // state so the badge UI reflects it.
                            lockedDocument = lockedDocument
                                ? null
                                : previousDocument;
                            postLockStateToWebview();
                        } else if (message.type === "error") {
                            // 报错
                            const missingPackage =
                                extractMissingPackageFromErrorMessage(
                                    message.message
                                );

                            if (missingPackage) {
                                void promptMissingPackages([missingPackage]);
                            } else {
                                vscode.window.showErrorMessage(message.message);
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
                isUrdfOrXacroFile(document)
            ) {
                // When a lock target is set, always re-render it (so saving
                // an included child xacro re-renders the top-level file).
                // Otherwise, re-render whatever was just saved.
                sendURDFContent(lockedDocument ?? document);
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
            // Lock pins the preview to one document; editor switches
            // (including incidental focus changes from clicking the badge)
            // must not swap the preview out.
            if (lockedDocument) {
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
                promptedMissingPackages.clear();
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
