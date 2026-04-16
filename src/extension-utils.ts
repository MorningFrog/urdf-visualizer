import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import localize from "./localize";

/**
 * 替换文件路径中的变量
 * @param pathStr
 * @param workspaceFolder
 * @returns
 */
export function resolveVariables(
    pathStr: string,
    workspaceFolder: vscode.WorkspaceFolder | undefined
): string {
    if (!workspaceFolder) {
        vscode.window.showErrorMessage(
            "No workspace folder found to resolve variables."
        );
        return pathStr;
    }

    let resolvedPath = pathStr
        .replace(/\$\{workspaceFolder\}/g, workspaceFolder.uri.fsPath)
        .replace(
            /\$\{env:([^}]+)\}/g,
            (_, envVar) => process.env[envVar] || ""
        );

    // 处理 ${workspaceFolder:folderName} 形式的变量
    const folderMatch = pathStr.match(/\$\{workspaceFolder:([^}]+)\}/);
    if (folderMatch) {
        const folderName = folderMatch[1];
        const folder = vscode.workspace.getWorkspaceFolder(
            vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, folderName))
        );
        if (folder) {
            resolvedPath = resolvedPath.replace(
                new RegExp(`\\$\\{workspaceFolder:${folderName}\\}`, "g"),
                folder.uri.fsPath
            );
        } else {
            vscode.window.showErrorMessage(
                `Workspace folder '${folderName}' not found.`
            );
        }
    }

    // 将相对路径加上工作区文件夹路径
    if (!path.isAbsolute(resolvedPath)) {
        resolvedPath = path.join(workspaceFolder.uri.fsPath, resolvedPath);
    }

    return resolvedPath;
}

/**
 * 对一个 object 内所有的路径都处理变量
 * @param pathStrs
 * @param workspaceFolder
 */
export function resolveVariablesInObject(
    pathStrs: { [key: string]: string },
    workspaceFolder: vscode.WorkspaceFolder | undefined
) {
    Object.entries(pathStrs).forEach(([key, path]) => {
        pathStrs[key] = resolveVariables(path, workspaceFolder);
    });
    return pathStrs;
}

// 将 Webview 的内容替换为绝对路径并返回完整的 html
export function getWebviewContent(
    context: vscode.ExtensionContext,
    activePanel: vscode.WebviewPanel | undefined
): string | undefined {
    const extensionPath = context.extensionPath;
    // 找到你的 index.html 所在文件夹的绝对路径
    // const htmlRoot = path.join(extensionPath, "src", "webview");
    // const htmlIndexPath = path.join(htmlRoot, "preview.html");
    const htmlRoot = path.join(extensionPath, "webview", "dist");
    const htmlIndexPath = path.join(htmlRoot, "index.html");
    const html = fs
        .readFileSync(htmlIndexPath, "utf-8")
        ?.replace(
            // i18n
            /%([^%]+)%/g,
            (match, p1) => {
                return localize(p1) || match;
            }
        )
        .replace(
            // 替换所有的相对路径为绝对路径
            /(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g,
            (m: string, $1: string, $2: string) => {
                if ($2.startsWith("/")) {
                    // 绝对路径是相对于 htmlRoot 的
                    $2 = $2.slice(1);
                }
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

/**
 * 判断是否为 URDF 或 Xacro 文件
 * @param document 文档
 * @returns 是否为 URDF 或 Xacro 文件
 */
export function isUrdfOrXacroFile(document: vscode.TextDocument) {
    const ext = getExt(document.fileName);
    return ext && (ext === "urdf" || ext === "xacro");
}

/**
 * 判断是否为 Xacro 文件
 * @param document 文档
 * @returns 是否为 Xacro 文件
 */
export function isXacroFile(document: vscode.TextDocument): boolean {
    const ext = getExt(document.fileName);
    if (!ext) {
        return false;
    }
    return ext === "xacro";
}

/**
 * 提取 URDF 文本中所有 package://<package_name> 引用的包名
 * @param urdfText URDF 文本
 * @returns 按出现顺序去重后的包名列表
 */
export function extractPackageNamesFromUrdf(urdfText: string): string[] {
    const packageNames = new Set<string>();
    const packageUriRegex = /package:\/\/([^\/\s"'<>]+)/g;

    for (const match of urdfText.matchAll(packageUriRegex)) {
        const packageName = match[1]?.trim();
        if (packageName) {
            packageNames.add(packageName);
        }
    }

    return Array.from(packageNames);
}

/**
 * 查找 URDF 中未配置路径的 package
 * @param urdfText URDF 文本
 * @param packages 已配置的 package 路径映射
 * @returns 未配置的 package 名称列表
 */
export function findMissingPackagesInUrdf(
    urdfText: string,
    packages: Record<string, string> | undefined
): string[] {
    const configuredPackages = packages ?? {};

    return extractPackageNamesFromUrdf(urdfText).filter(
        (packageName) =>
            !Object.prototype.hasOwnProperty.call(
                configuredPackages,
                packageName
            )
    );
}

/**
 * 从 URDFLoader 的缺包报错中提取包名
 * @param message 报错文本
 * @returns 缺失的 package 名称, 未匹配时返回 null
 */
export function extractMissingPackageFromErrorMessage(
    message: string
): string | null {
    const match = message.match(
        /URDFLoader\s*:\s*([^\s]+)\s+not found in provided package list\./
    );

    return match?.[1] ?? null;
}
