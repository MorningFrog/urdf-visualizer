import { vscode } from "./vscode_api";

class DomElements {
    public readonly reloadButton = document.getElementById(
        "re-load"
    ) as HTMLButtonElement; // 重新加载按钮
    public readonly controlsToggle = document.getElementById(
        "toggle-controls"
    ) as HTMLDivElement; // 切换控制按钮的显示
    public readonly controlsel = document.getElementById(
        "controls"
    ) as HTMLDivElement; // 控制栏
    public readonly ulJoints = document.getElementById(
        "ul-joints"
    ) as HTMLUListElement; // Joint 列表
    public readonly ulLinks = document.getElementById(
        "ul-links"
    ) as HTMLUListElement; // Link 列表
    public readonly tooltip = document.getElementById(
        "tooltip"
    ) as HTMLDivElement; // 悬浮提示框(显示 Joint 当前角度)
    public readonly radiansButton = document.getElementById(
        "switch-radians"
    ) as HTMLButtonElement; // 切换为弧度按钮
    public readonly degreesButton = document.getElementById(
        "switch-degrees"
    ) as HTMLButtonElement; // 切换为角度按钮
    public readonly notifyContainer = document.getElementById(
        "notify-container"
    ) as HTMLDivElement; // 操作说明容器
    public readonly notifyDragJoint = document.getElementById(
        "notify-drag-joint"
    ) as HTMLDivElement;
    public readonly notifyDragRotate = document.getElementById(
        "notify-drag-rotate"
    ) as HTMLDivElement;
    public readonly notifyDragMove = document.getElementById(
        "notify-drag-move"
    ) as HTMLDivElement;
    public readonly notifyClickFirstPoint = document.getElementById(
        "notify-click-first-point"
    ) as HTMLDivElement;
    public readonly notifyClickMorePoints = document.getElementById(
        "notify-click-more-points"
    ) as HTMLDivElement;
    public readonly notifyClickRestart = document.getElementById(
        "notify-click-restart"
    ) as HTMLDivElement;
    public readonly notifyDblclickComplete = document.getElementById(
        "notify-dblclick-complete"
    ) as HTMLDivElement;
    public readonly notifyEscCancle = document.getElementById(
        "notify-esc-cancle"
    ) as HTMLDivElement;

    constructor() {
        // 确保所有元素都已加载
        if (
            !this.reloadButton ||
            !this.controlsToggle ||
            !this.controlsel ||
            !this.ulJoints ||
            !this.ulLinks ||
            !this.tooltip ||
            !this.radiansButton ||
            !this.degreesButton ||
            !this.notifyContainer ||
            !this.notifyDragJoint ||
            !this.notifyDragRotate ||
            !this.notifyDragMove ||
            !this.notifyClickFirstPoint ||
            !this.notifyClickMorePoints ||
            !this.notifyClickRestart ||
            !this.notifyDblclickComplete ||
            !this.notifyEscCancle
        ) {
            throw new Error("Element not found");
        }

        // 处理交互
        this.reloadButton.addEventListener("click", () => {
            vscode.postMessage({ type: "getNewURDF" });
        });
        this.controlsToggle.addEventListener("click", () =>
            this.controlsel.classList.toggle("hidden")
        );
        this.radiansButton.addEventListener("click", () => {
            this.radiansButton.classList.add("checked");
            this.degreesButton.classList.remove("checked");
        });
        this.degreesButton.addEventListener("click", () => {
            this.degreesButton.classList.add("checked");
            this.radiansButton.classList.remove("checked");
        });
    }
}

export const domElements = new DomElements();
