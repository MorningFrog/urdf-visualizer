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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveVariables = resolveVariables;
exports.resolveVariablesInObject = resolveVariablesInObject;
exports.getWebviewContent = getWebviewContent;
exports.isUrdfOrXacroFile = isUrdfOrXacroFile;
exports.isXacroFile = isXacroFile;
exports.extractPackageNamesFromUrdf = extractPackageNamesFromUrdf;
exports.findMissingPackagesInUrdf = findMissingPackagesInUrdf;
exports.extractMissingPackageFromErrorMessage = extractMissingPackageFromErrorMessage;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const localize_1 = __importDefault(require("./localize"));
/**
 * 替换文件路径中的变量
 * @param pathStr
 * @param workspaceFolder
 * @returns
 */
function resolveVariables(pathStr, workspaceFolder) {
    if (!workspaceFolder) {
        vscode.window.showErrorMessage("No workspace folder found to resolve variables.");
        return pathStr;
    }
    let resolvedPath = pathStr
        .replace(/\$\{workspaceFolder\}/g, workspaceFolder.uri.fsPath)
        .replace(/\$\{env:([^}]+)\}/g, (_, envVar) => process.env[envVar] || "");
    // 处理 ${workspaceFolder:folderName} 形式的变量
    const folderMatch = pathStr.match(/\$\{workspaceFolder:([^}]+)\}/);
    if (folderMatch) {
        const folderName = folderMatch[1];
        const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, folderName)));
        if (folder) {
            resolvedPath = resolvedPath.replace(new RegExp(`\\$\\{workspaceFolder:${folderName}\\}`, "g"), folder.uri.fsPath);
        }
        else {
            vscode.window.showErrorMessage(`Workspace folder '${folderName}' not found.`);
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
function resolveVariablesInObject(pathStrs, workspaceFolder) {
    Object.entries(pathStrs).forEach(([key, path]) => {
        pathStrs[key] = resolveVariables(path, workspaceFolder);
    });
    return pathStrs;
}
// 将 Webview 的内容替换为绝对路径并返回完整的 html
function getWebviewContent(context, activePanel) {
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
    /%([^%]+)%/g, (match, p1) => {
        return (0, localize_1.default)(p1) || match;
    })
        .replace(
    // 替换所有的相对路径为绝对路径
    /(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g, (m, $1, $2) => {
        if ($2.startsWith("/")) {
            // 绝对路径是相对于 htmlRoot 的
            $2 = $2.slice(1);
        }
        const absLocalPath = path.resolve(htmlRoot, $2);
        const webviewUri = activePanel?.webview.asWebviewUri(vscode.Uri.file(absLocalPath));
        const replaceHref = $1 + webviewUri?.toString() + '"';
        return replaceHref;
    });
    return html;
}
/**
 * 获取文件扩展名
 * @param fileName 文件名
 * @returns 文件扩展名
 */
function getExt(fileName) {
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
function isUrdfOrXacroFile(document) {
    const ext = getExt(document.fileName);
    return ext && (ext === "urdf" || ext === "xacro");
}
/**
 * 判断是否为 Xacro 文件
 * @param document 文档
 * @returns 是否为 Xacro 文件
 */
function isXacroFile(document) {
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
function extractPackageNamesFromUrdf(urdfText) {
    const packageNames = new Set();
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
function findMissingPackagesInUrdf(urdfText, packages) {
    const configuredPackages = packages ?? {};
    return extractPackageNamesFromUrdf(urdfText).filter((packageName) => !Object.prototype.hasOwnProperty.call(configuredPackages, packageName));
}
/**
 * 从 URDFLoader 的缺包报错中提取包名
 * @param message 报错文本
 * @returns 缺失的 package 名称, 未匹配时返回 null
 */
function extractMissingPackageFromErrorMessage(message) {
    const match = message.match(/URDFLoader\s*:\s*([^\s]+)\s+not found in provided package list\./);
    return match?.[1] ?? null;
}
//# sourceMappingURL=extension-utils.js.map