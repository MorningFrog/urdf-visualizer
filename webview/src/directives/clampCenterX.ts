import type { Directive } from "vue";

type Anchor = number | { px: number } | { percent: number };
type Value = {
    anchor: Anchor | (() => Anchor);
    padding?: number;
    // 可选：自定义容器选择器；默认用 [data-clamp-container]
    containerSelector?: string;
};

function clamp(v: number, min: number, max: number) {
    return Math.min(max, Math.max(min, v));
}
function resolveAnchor(a: Value["anchor"]): Anchor {
    return typeof a === "function" ? a() : a;
}
function anchorToPx(anchor: Anchor, containerW: number) {
    if (typeof anchor === "number") return anchor;
    if ("px" in anchor) return anchor.px;
    return anchor.percent * containerW;
}

export const vClampCenterX: Directive<HTMLElement, Value> = {
    mounted(el, binding) {
        const state: any = {};
        const selector =
            binding.value.containerSelector ?? "[data-clamp-container]";

        const getContainer = () =>
            (el.closest(selector) as HTMLElement | null) ??
            (el.offsetParent as HTMLElement | null);

        const applyNow = () => {
            const container = getContainer();
            if (!container) return;

            const cw = container.clientWidth;
            const w = el.offsetWidth;

            const padding = binding.value.padding ?? 0;
            const ax = anchorToPx(resolveAnchor(binding.value.anchor), cw);

            const minX = w / 2 + padding;
            const maxX = cw - w / 2 - padding;

            el.style.left = `${clamp(ax, minX, maxX)}px`;
        };

        const schedule = () => {
            if (state.raf) cancelAnimationFrame(state.raf);
            state.raf = requestAnimationFrame(applyNow);
        };

        state.ro = new ResizeObserver(schedule);
        state.schedule = schedule;

        const container = getContainer();
        if (container) state.ro.observe(container);
        state.ro.observe(el);

        schedule();
        (el as any).__clampCenterXState = state;
    },

    updated(el) {
        (el as any).__clampCenterXState?.schedule?.();
    },

    unmounted(el) {
        const state = (el as any).__clampCenterXState;
        if (state?.raf) cancelAnimationFrame(state.raf);
        state?.ro?.disconnect();
        delete (el as any).__clampCenterXState;
    },
};
