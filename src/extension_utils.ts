import * as vscode from "vscode";

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
