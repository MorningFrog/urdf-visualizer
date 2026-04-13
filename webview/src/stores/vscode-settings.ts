import { reactive } from "vue";

export interface VscodeSettings {
    /** 功能包路径映射 */
    packages: Record<string, string>;
    /** 资源路径前缀 */
    uriPrefix: string;
    /** 工作目录 */
    workingPath: string;
    /** 打开的 URDF/Xacro 文件名 */
    filename: string;
    /** 是否需要马上重置相机视角 */
    requireResetCamera: boolean;
    /** urdf 内容 */
    urdfText: string;
    /** 是否缓存 mesh 素材 */
    cacheMesh: boolean;
    /** 是否显示提示信息 */
    showTips: boolean;
    /** 鼠标悬停时是否高亮关节 */
    highlightJointWhenHover: boolean;
    /** 鼠标悬停时是否高亮连杆 */
    highlightLinkWhenHover: boolean;
    /** 切换文件时是否缓存并恢复相机视角 */
    cacheCameraView: boolean;
    /** 切换文件时是否缓存并恢复关节值 */
    cacheJointValues: boolean;
}

export const vscodeSettings = reactive<VscodeSettings>({
    packages: {},
    uriPrefix: "https://file%2B.vscode-resource.vscode-cdn.net",
    workingPath: "",
    filename: "",
    requireResetCamera: false,
    urdfText: "",
    cacheMesh: true,
    showTips: true,
    highlightJointWhenHover: true,
    highlightLinkWhenHover: true,
    cacheCameraView: true,
    cacheJointValues: false,
});
