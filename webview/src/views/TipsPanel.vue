<script setup lang="ts">
import { computed, type Component } from "vue";

import MouseDragIcon from "/public/icons/mouse-drag.svg";
import MouseLeftDragIcon from "/public/icons/mouse-left-drag.svg";
import MouseRightDragIcon from "/public/icons/mouse-right-drag.svg";
import MouseClickIcon from "/public/icons/mouse-click.svg";
import MouseDblclickIcon from "/public/icons/mouse-dblclick.svg";
import MouseScrollDownIcon from "/public/icons/mouse-scroll-down.svg";
import MouseScrollUpIcon from "/public/icons/mouse-scroll-up.svg";
import KeyEnterIcon from "/public/icons/key-enter.svg";
import KeyEscIcon from "/public/icons/key-esc.svg";

import i18n from "@/stores/i18n";
import {
    measureStore,
    MeasureMode,
    MeasureStatus,
} from "@/stores/measure-store";
import { urdfStore } from "@/stores/urdf-store";
import { vscodeSettings } from "@/stores/vscode-settings";

interface TipItem {
    key: string;
    icons: Component[];
    label: string;
    disabled?: boolean;
}

const isMeasuring = computed(() => measureStore.mode !== MeasureMode.None);
const isMeasureComplete = computed(
    () => measureStore.status === MeasureStatus.Complete
);
const disableCameraTips = computed(() => {
    if (!isMeasuring.value) {
        return urdfStore.isHoveredOnModel;
    }

    return measureStore.isHoveringTarget && !isMeasureComplete.value;
});

const tips = computed<TipItem[]>(() => {
    if (!vscodeSettings.showTips) {
        return [];
    }

    const items: TipItem[] = [];

    if (!isMeasuring.value) {
        items.push({
            key: "drag-joint",
            icons: [MouseDragIcon],
            label: i18n("webview.dragControlJoint"),
            disabled: !urdfStore.isHoveredOnModel,
        });
    } else if (isMeasureComplete.value) {
        items.push({
            key: "dblclick-restart-measure",
            icons: [MouseDblclickIcon],
            label: i18n("webview.doubleClickRestartMeasure"),
        });
        items.push({
            key: "esc-cancel-measure",
            icons: [KeyEscIcon],
            label: i18n("webview.escCancleMeasure"),
        });
    } else {
        const isFirstPoint = measureStore.status === MeasureStatus.Prepare;
        items.push({
            key: isFirstPoint ? "click-first-point" : "click-more-points",
            icons: [MouseClickIcon],
            label: i18n(
                isFirstPoint
                    ? "webview.clickDropFirstPoint"
                    : "webview.clickDropMorePoints"
            ),
            disabled: !measureStore.isHoveringTarget,
        });
        items.push({
            key: "dblclick-complete-measure",
            icons: [MouseDblclickIcon, KeyEnterIcon],
            label: i18n("webview.doubleClickCompleteMeasure"),
        });
        items.push({
            key: "esc-cancel-measure",
            icons: [KeyEscIcon],
            label: i18n("webview.escCancleMeasure"),
        });
    }

    items.push({
        key: "drag-rotate",
        icons: [MouseLeftDragIcon],
        label: i18n("webview.dragRotatePerspective"),
        disabled: disableCameraTips.value,
    });
    items.push({
        key: "drag-move",
        icons: [MouseRightDragIcon],
        label: i18n("webview.dragMovePerspective"),
        disabled: disableCameraTips.value,
    });
    items.push({
        key: "scroll-zoom",
        icons: [MouseScrollDownIcon, MouseScrollUpIcon],
        label: i18n("webview.scrollZoom"),
    });

    return items;
});
</script>

<template>
    <div
        v-if="tips.length > 0"
        class="pointer-events-none absolute right-5 bottom-5 z-20 flex max-h-[calc(100vh-3rem)] select-none flex-col items-end gap-1"
    >
        <div
            v-for="tip in tips"
            :key="tip.key"
            class="flex min-h-8 items-center gap-2 rounded-full bg-base-100/78 px-3 py-1.5 text-xs text-base-content shadow-sm ring-1 ring-base-300/60 backdrop-blur-sm transition-opacity duration-150"
            :class="tip.disabled ? 'opacity-45' : 'opacity-100'"
        >
            <div class="flex shrink-0 items-center gap-1">
                <component
                    :is="icon"
                    v-for="(icon, index) in tip.icons"
                    :key="`${tip.key}-${index}`"
                    class="h-5 w-5"
                />
            </div>
            <span class="whitespace-nowrap leading-none">
                {{ tip.label }}
            </span>
        </div>
    </div>
</template>
