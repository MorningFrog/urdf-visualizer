import { vscode } from "./vscode_api";
import { URDFJoint, URDFLink } from "urdf-loader";

export class DomElements {
    public readonly reloadButton = document.getElementById(
        "re-load"
    ) as HTMLButtonElement; // 重新加载按钮
    public readonly controlsToggle = document.getElementById(
        "toggle-controls"
    ) as HTMLDivElement; // 切换控制按钮的显示
    public readonly controlsel = document.getElementById(
        "controls"
    ) as HTMLDivElement; // 控制栏
    public readonly resetJoints = document.getElementById(
        "reset-joints"
    ) as HTMLDivElement; // 重置所有 Joint 位置按钮
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

    private havePoints = false; // 测量模式下是否已经有点了
    public isDegree = false; // 当前角度模式是否为角度(而不是弧度)

    /**
     * @param updateDegreeRadiansCallback 更新角度显示模式时的回调
     */
    constructor(updateDegreeRadiansCallback: () => void) {
        // 确保所有元素都已加载
        if (
            !this.reloadButton ||
            !this.controlsToggle ||
            !this.controlsel ||
            !this.resetJoints ||
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
        this.radiansButton.addEventListener("click", () => {
            if (!this.isDegree) {
                return;
            }
            this.isDegree = false;
            updateDegreeRadiansCallback();
        });
        this.degreesButton.addEventListener("click", () => {
            if (this.isDegree) {
                return;
            }
            this.isDegree = true;
            updateDegreeRadiansCallback();
        });
        this.resetJoints.addEventListener("click", () => {
            // 重置所有关节位置
            const sliders =
                document.querySelectorAll<HTMLInputElement>(".slider-joint");
            sliders.forEach((slider) => {
                slider.value = "0.0"; // 重置滑块值
                // 触发 input 事件
                slider.dispatchEvent(new Event("input"));
            });
        });
    }

    /**
     * 更新 tooltip 显示的文本
     */
    public updateTooltipText(angle: number) {
        if (this.isDegree) {
            this.tooltip.textContent = Math.round(
                (angle * 180) / Math.PI
            ).toString();
        } else {
            this.tooltip.textContent = angle.toFixed(2);
        }
    }

    /**
     * 情况关节列表
     */
    public clearJointList() {
        this.ulJoints.innerHTML = "";
    }

    /**
     * 处理 id 和 class, 将其中的 `/` 替换为 `__`
     * @param str
     */
    private postprocessIdAndClass(str: string) {
        return str.replace(/\//g, "__");
    }

    /**
     * 添加关节
     */
    public addJoint(
        joint_name: string,
        joint_type: string,
        joint_limit: {
            lower: Number;
            upper: Number;
        },
        updateJointValueFromSliderCallback: (
            value: number,
            joint_name: string
        ) => void,
        hoverCallback: (joint_name: string) => void,
        unhoverCallback: (joint_name: string) => void
    ) {
        // 保留两位小数
        const joint_limit_processed = {
            // @ts-ignore
            lower: Math.round(joint_limit.lower * 100) / 100,
            // @ts-ignore
            upper: Math.round(joint_limit.upper * 100) / 100,
        };

        const joint_name_processed = this.postprocessIdAndClass(joint_name);
        const li = document.createElement("li"); // 列表项
        li.id = `joint_${joint_name_processed}`;
        li.classList.add("joint-item");
        li.classList.add("width_wrapper");
        li.innerHTML = `
        <div class="div-joint-name width_full">
            <label>${joint_name}</label>
            <label class="joint_type ${joint_type}">${joint_type}</label>
        </div>
        <div class="div-slider width_full">
            <div>
                <input
                    type="range"
                    name="slider_joint_${joint_name_processed}"
                    id="slider_joint_${joint_name_processed}"
                    class="slider-joint"
                    min="${joint_limit_processed.lower}"
                    max="${joint_limit_processed.upper}"
                    step="0.01"
                    value="0.0"
                />
            </div>
            <div class="div-scale">
                <div class="div-scale-item lower-limit">
                    <div>|</div>
                    <div id="joint_${joint_name_processed}_limit_lower"></div>
                </div>
                <div class="div-scale-item" style="left: ${
                    // @ts-ignore
                    ((0 - joint_limit_processed.lower) /
                        // @ts-ignore
                        (joint_limit_processed.upper -
                            joint_limit_processed.lower)) *
                    // @ts-ignore
                    100
                }%;">
                    <div>|</div>
                </div>
                <div class="div-scale-item upper-limit">
                    <div>|</div>
                    <div id="joint_${joint_name_processed}_limit_upper"></div>
                </div>
            </div>
        </div>
        `;
        // 绑定滑块事件
        const slider = li.querySelector(
            `#slider_joint_${joint_name_processed}`
        ) as HTMLInputElement;
        if (slider) {
            // 更新关节角度
            slider.addEventListener("input", () => {
                const value = parseFloat(slider.value);
                updateJointValueFromSliderCallback(value, joint_name);
                this.showTooltip(slider, null);
            });
            // 自定义事件

            // 显示值
            slider.addEventListener("mouseover", (event) => {
                this.showTooltip(slider);
            });
            // 隐藏值
            slider.addEventListener("mouseout", () => {
                this.showTooltip(null, false);
            });
            // 更改位置
            // slider.addEventListener("mousemove", (event) => {
            //     this.tooltip.style.left = `${event.pageX}px`;
            //     const slider_top = slider.getBoundingClientRect().top;
            //     this.tooltip.style.top = `${slider_top - 30}px`;
            // });
            // 双击重置关节位置
            slider.addEventListener("dblclick", () => {
                slider.value = "0.0"; // 重置滑块值
                // 触发 input 事件
                slider.dispatchEvent(new Event("input"));
            });
        }
        // 悬停事件处理
        li.addEventListener("mouseenter", () => {
            hoverCallback(joint_name);
        });
        li.addEventListener("mouseleave", () => {
            unhoverCallback(joint_name);
        });

        this.ulJoints.appendChild(li);
    }

    /**
     * 显示或隐藏 tooltip
     */
    private showTooltip(
        slider: HTMLInputElement | null,
        show: boolean | null = true,
        updateTooltipText: boolean = true
    ) {
        if (show !== null) {
            this.tooltip.style.display = show ? "block" : "none";
        }
        if (this.tooltip.style.display === "none") {
            return; // 如果 tooltip 已经隐藏, 则不进行任何操作
        }

        // 设置 tooltip 位置
        if (!slider) {
            return;
        }
        const value = parseFloat(slider.value);
        if (updateTooltipText) {
            this.updateTooltipText(value);
        }
        // 计算百分比
        // @ts-ignore
        const limit_min = parseFloat(slider.getAttribute("min"));
        // @ts-ignore
        const limit_max = parseFloat(slider.getAttribute("max"));
        const percentage =
            ((value - limit_min) / (limit_max - limit_min)) * 100;
        // 计算 x 位置
        const thumbWidth = 12; // 滑块的宽度
        const leftPosition =
            percentage * ((slider.offsetWidth - thumbWidth) / 100) +
            thumbWidth / 2;
        const sliderRect = slider.getBoundingClientRect();
        const controlselRect = this.controlsel.getBoundingClientRect();
        const leftStart =
            sliderRect.left - controlselRect.left + this.controlsel.scrollLeft;
        const topStart =
            sliderRect.top - controlselRect.top + this.controlsel.scrollTop;
        this.tooltip.style.left = `${leftPosition + leftStart}px`;
        this.tooltip.style.top = `${topStart - 35}px`;
    }

    /**
     * 更新关节角度范围
     */
    public updateJointLimit(
        joint_name: string,
        joint_limit: {
            lower: Number;
            upper: Number;
        }
    ) {
        const joint_name_processed = this.postprocessIdAndClass(joint_name);
        const element_joint_limit_upper = document.getElementById(
            `joint_${joint_name_processed}_limit_upper`
        ) as HTMLInputElement;
        const element_joint_limit_lower = document.getElementById(
            `joint_${joint_name_processed}_limit_lower`
        ) as HTMLInputElement;
        if (this.isDegree) {
            element_joint_limit_upper.innerText = Math.round(
                // @ts-ignore
                (joint_limit.upper * 180) / Math.PI
            ).toString();
            element_joint_limit_lower.innerText = Math.round(
                // @ts-ignore
                (joint_limit.lower * 180) / Math.PI
            ).toString();
        } else {
            element_joint_limit_upper.innerText = joint_limit.upper.toFixed(2);
            element_joint_limit_lower.innerText = joint_limit.lower.toFixed(2);
        }
    }

    /**
     * 关节角度改变回调(外部触发)
     */
    public updateJointValue(joint: URDFJoint, value: number) {
        const joint_name_processed = this.postprocessIdAndClass(joint.name);
        const slider = document.getElementById(
            `slider_joint_${joint_name_processed}`
        ) as HTMLInputElement;
        if (slider) {
            slider.value = value.toString();
            this.showTooltip(slider);
        }
    }

    /**
     * 鼠标悬浮在模型上回调
     */
    public modelHoverCallback(joint: URDFJoint | null, link: URDFLink | null) {
        // 更新操作提示
        this.notifyDragJoint.classList.remove("disabled");
        this.notifyDragRotate.classList.add("disabled");
        this.notifyDragMove.classList.add("disabled");
        // 高亮对应关节项
        if (joint) {
            const joint_name_processed = this.postprocessIdAndClass(joint.name);
            const jointItem = document.getElementById(
                `joint_${joint_name_processed}`
            );
            if (jointItem) {
                jointItem.classList.add("active");
                // 显示关节角度
                const slider = jointItem.querySelector(
                    `#slider_joint_${joint_name_processed}`
                ) as HTMLInputElement;
                if (slider) {
                    this.showTooltip(slider);
                }
            }
        }
    }

    /**
     * 鼠标移出模型回调
     */
    public modelUnhoverCallback(
        joint: URDFJoint | null,
        link: URDFLink | null,
        fullUnhover = false
    ) {
        // 更新操作提示
        this.notifyDragJoint.classList.add("disabled");
        this.notifyDragRotate.classList.remove("disabled");
        this.notifyDragMove.classList.remove("disabled");
        this.showTooltip(null, false);
        // 取消高亮对应关节项
        if (fullUnhover) {
            // 全部取消高亮
            const jointItems =
                document.querySelectorAll<HTMLElement>(".joint-item.active");
            jointItems.forEach((item) => {
                item.classList.remove("active");
            });
            return;
        }
        if (joint) {
            const joint_name_processed = this.postprocessIdAndClass(joint.name);
            const jointItem = document.getElementById(
                `joint_${joint_name_processed}`
            );
            if (jointItem) {
                jointItem.classList.remove("active");
            }
        }
    }

    /**
     * 开始测量模式回调
     */
    public startMeasureCallback() {
        const notifyItems =
            document.querySelectorAll<HTMLElement>(".notify-item");
        notifyItems.forEach((item) => {
            if (item.classList.contains("case-measure")) {
                // 显示测量提示
                item.classList.remove("hidden");

                if (item.id === "notify-esc-cancle") {
                    item.classList.remove("disabled");
                } else {
                    item.classList.add("disabled");
                }
            } else if (item.classList.contains("case-all")) {
                item.classList.remove("disabled");
            } else {
                // 隐藏其他提示
                item.classList.add("hidden");
                item.classList.remove("disabled");
            }
        });
        this.notifyClickMorePoints.classList.add("hidden");
        this.notifyClickRestart.classList.add("hidden");
        this.notifyDblclickComplete.classList.remove("disabled");

        this.havePoints = false;
    }

    /**
     * 继续测量回调
     */
    public continueMeasureCallback() {
        this.notifyDblclickComplete.classList.remove("disabled");
        this.notifyClickFirstPoint.classList.add("hidden");
        this.notifyClickMorePoints.classList.remove("hidden");
        this.havePoints = true;
    }

    /**
     * 完成测量回调
     */
    public completeMeasureCallback() {
        this.notifyDblclickComplete.classList.add("hidden");
        this.notifyClickFirstPoint.classList.add("hidden");
        this.notifyClickMorePoints.classList.add("hidden");
        this.notifyClickRestart.classList.remove("hidden");
        this.notifyClickRestart.classList.remove("disabled");
    }

    /**
     * 关闭测量回调
     */
    public closeMeasureCallback() {
        const notifyItems =
            document.querySelectorAll<HTMLElement>(".notify-item");
        notifyItems.forEach((item) => {
            if (item.classList.contains("case-normal")) {
                item.classList.remove("hidden");
                item.classList.add("disabled");
            } else if (item.classList.contains("case-all")) {
                item.classList.remove("disabled");
            } else {
                item.classList.add("hidden");
                item.classList.remove("disabled");
            }
        });
    }

    /**
     * 测量模式下, 鼠标悬浮在模型回调
     */
    public measureHoverCallback() {
        if (this.havePoints) {
            this.notifyClickMorePoints.classList.remove("disabled");
        } else {
            this.notifyClickFirstPoint.classList.remove("disabled");
        }
        this.notifyDragRotate.classList.add("disabled");
        this.notifyDragMove.classList.add("disabled");
    }

    /**
     * 测量模式下, 鼠标移出模型回调
     */
    public measureUnhoverCallback() {
        this.notifyClickFirstPoint.classList.add("disabled");
        this.notifyClickMorePoints.classList.add("disabled");
        this.notifyDragRotate.classList.remove("disabled");
        this.notifyDragMove.classList.remove("disabled");
    }

    /**
     * 设置是否显示操作提示
     */
    public setShowTips(show: boolean) {
        if (show) {
            this.notifyContainer.classList.remove("hidden");
        } else {
            this.notifyContainer.classList.add("hidden");
        }
    }
}
