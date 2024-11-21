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

    return pathStr
        .replace(/\$\{workspaceFolder\}/g, workspaceFolder.uri.fsPath)
        .replace(
            /\$\{env:([^}]+)\}/g,
            (_, envVar) => process.env[envVar] || ""
        );
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

// 将 Webview 的内容替换为绝对路径
export function getWebviewContent(
    context: vscode.ExtensionContext,
    activePanel: vscode.WebviewPanel | undefined
): string | undefined {
    const extensionPath = context.extensionPath;
    // 找到你的 index.html 所在文件夹的绝对路径
    const htmlRoot = path.join(extensionPath, "src", "webview");
    const htmlIndexPath = path.join(htmlRoot, "preview.html");
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
                const absLocalPath = path.resolve(htmlRoot, $2);
                const webviewUri = activePanel?.webview.asWebviewUri(
                    vscode.Uri.file(absLocalPath)
                );
                const replaceHref = $1 + webviewUri?.toString() + '"';
                return replaceHref;
            }
        );
    // 替换 webview 代码中的 `${extensionPath}` 变量
    // const extensionPathResolved = activePanel?.webview.asWebviewUri(
    //     vscode.Uri.file(extensionPath)
    // );
    // if (!extensionPathResolved?.authority || !extensionPathResolved?.path) {
    //     vscode.window.showErrorMessage(
    //         `Failed to resolve extension path: ${extensionPath}`
    //     );
    //     return html;
    // }
    // const targetDir = path.join(extensionPath, "dist/webview");

    // try {
    //     // 扫描并替换目录中的 js 文件
    //     const files = fs.readdirSync(targetDir);

    //     // 过滤出所有 .js 文件
    //     const jsFiles = files.filter((file) => file.endsWith(".js"));

    //     jsFiles.forEach((file) => {
    //         const filePath = path.join(targetDir, file);

    //         // 读取文件内容
    //         try {
    //             const data = fs.readFileSync(filePath, "utf8");

    //             // 替换 `${extensionPath}` 为实际的扩展目录路径
    //             const updatedContent = data.replace(
    //                 /\$\{extensionPath\}/g,
    //                 extensionPathResolved.toString()
    //             );

    //             // 将更新后的内容写回文件
    //             fs.writeFileSync(filePath, updatedContent, "utf8");
    //         } catch (fileErr: any) {
    //             vscode.window.showErrorMessage(
    //                 `Failed to process file ${file}: ${fileErr.message}`
    //             );
    //         }
    //     });
    // } catch (dirErr: any) {
    //     vscode.window.showErrorMessage(
    //         `Failed to read directory: ${dirErr.message}`
    //     );
    // }

    return html;
}
