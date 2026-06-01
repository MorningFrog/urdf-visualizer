<script setup lang="ts">
import { computed } from "vue";

import HintIcon from "/public/icons/hint.svg";
import ReloadIcon from "/public/icons/reload.svg";

import i18n from "@/stores/i18n";
import { urdfStore } from "@/stores/urdf-store";
import { visualSettings } from "@/stores/visual-settings";
import { vscodeSettings } from "@/stores/vscode-settings";
import { vscode } from "@/utils/vscode-api";

import JointList from "./JointList.vue";
import RobotTree from "./RobotTree.vue";
import SettingsPanel from "./SettingsPanel.vue";

/** 重新加载 URDF */
const onReloadClick = () => {
  // 设置需要重新加载标志, module-urdf 会监听该标志并执行重新加载
  urdfStore.requireReload = true;
};

const onLockClick = () => {
  vscode.postMessage({ type: "toggleLockToPreviewedFile" });
};

const previewedBasename = computed(() => {
  const path = vscodeSettings.filename ?? "";
  if (!path) return "";
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return slash >= 0 ? path.slice(slash + 1) : path;
});

// xacro-only: plain URDF has no includes.
const isXacroPreview = computed(() =>
  (vscodeSettings.filename ?? "").toLowerCase().endsWith(".xacro")
);
</script>
<template>
  <div class="flex items-start gap-2 pointer-events-none">
    <div
      class="du-collapse du-collapse-arrow bg-base-100/50 border border-base-300 text-base-content transition-[width] duration-300 w-32 has-[>_input:checked]:w-max has-[>_input:checked]:min-w-62 has-[>_input:checked]:max-w-lg overflow-hidden pointer-events-auto"
    >
      <input type="checkbox" class="peer" />
      <div
        class="du-collapse-title font-semibold after:inset-s-5 after:inset-e-auto pe-4 ps-12 py-0 flex items-center h-10 text-base min-w-0"
      >
        <span class="truncate" :title="i18n('webview.control.title')">
          {{ i18n("webview.control.title") }}
        </span>
      </div>
      <div
        class="my-collapse-content du-collapse-content w-max min-w-62 max-w-lg overflow-y-scroll overflow-x-hidden pr-1 min-h-0"
        style="max-height: calc(100vh - 5rem)"
      >
        <ul class="du-list p-0">
          <!-- 显示Visual复选框 -->
          <label class="du-list-row my-list-row">
            <input
              type="checkbox"
              v-model="visualSettings.showVisual"
              class="du-checkbox du-checkbox-primary my-front-input"
            />
            <span
              class="my-row-text"
              :title="i18n('webview.control.showVisual')"
            >
              {{ i18n("webview.control.showVisual") }}
            </span>
          </label>
          <!-- 显示Collision复选框 -->
          <label class="du-list-row my-list-row">
            <input
              type="checkbox"
              v-model="visualSettings.showCollision"
              class="du-checkbox du-checkbox-primary my-front-input"
            />
            <span
              class="my-row-text"
              :title="i18n('webview.control.showCollision')"
            >
              {{ i18n("webview.control.showCollision") }}
            </span>
          </label>
          <!-- 显示 Inertia 复选框 -->
          <label class="du-list-row my-list-row">
            <input
              type="checkbox"
              v-model="visualSettings.showInertia"
              class="du-checkbox du-checkbox-primary my-front-input"
            />
            <span
              class="my-row-text"
              :title="i18n('webview.control.showInertia')"
            >
              {{ i18n("webview.control.showInertia") }}
            </span>
            <VTooltip class="shrink-0" :delay="0" :distance="8">
              <HintIcon class="my-hint-icon" />
              <template #popper>
                <div class="max-w-50">
                  {{ i18n("webview.control.showInertia.hint") }}
                </div>
              </template>
            </VTooltip>
          </label>
          <!-- 悬停时显示 Inertia 复选框 -->
          <label
            class="du-list-row my-list-row"
            :class="{ 'opacity-55': visualSettings.showInertia }"
          >
            <input
              type="checkbox"
              v-model="visualSettings.showInertiaWhenHover"
              :disabled="visualSettings.showInertia"
              class="du-checkbox du-checkbox-primary my-front-input"
            />
            <span
              class="my-row-text"
              :title="i18n('webview.control.showInertiaWhenHover')"
            >
              {{ i18n("webview.control.showInertiaWhenHover") }}
            </span>
            <VTooltip class="shrink-0" :delay="0" :distance="8">
              <HintIcon class="my-hint-icon" />
              <template #popper>
                <div class="max-w-50">
                  {{ i18n("webview.control.showInertiaWhenHover.hint") }}
                </div>
              </template>
            </VTooltip>
          </label>
          <!-- 显示世界坐标系复选框 -->
          <label class="du-list-row my-list-row">
            <input
              type="checkbox"
              v-model="visualSettings.showWorldFrame"
              class="du-checkbox du-checkbox-primary my-front-input"
            />
            <span
              class="my-row-text"
              :title="i18n('webview.control.showWorldFrame')"
            >
              {{ i18n("webview.control.showWorldFrame") }}
            </span>
            <VTooltip class="shrink-0" :delay="0" :distance="8">
              <HintIcon class="my-hint-icon" />
              <template #popper>
                <div class="max-w-50">
                  {{ i18n("webview.control.showWorldFrame.hint") }}
                </div>
              </template>
            </VTooltip>
          </label>
          <!-- 显示 Joint 坐标系复选框 -->
          <label class="du-list-row my-list-row">
            <input
              type="checkbox"
              v-model="visualSettings.showJointFrames"
              class="du-checkbox du-checkbox-primary my-front-input"
            />
            <span
              class="my-row-text"
              :title="i18n('webview.control.showJointFrames')"
            >
              {{ i18n("webview.control.showJointFrames") }}
            </span>
            <VTooltip class="shrink-0" :delay="0" :distance="8">
              <HintIcon class="my-hint-icon" />
              <template #popper>
                <div class="max-w-50">
                  {{ i18n("webview.control.showJointFrames.hint") }}
                </div>
              </template>
            </VTooltip>
          </label>
          <!-- Joint 坐标系尺寸调节 -->
          <label class="du-list-row my-list-row h-10!">
            <div class="my-front-input"></div>
            <div>
              <div>{{ i18n("webview.control.jointFrameSize") }}</div>
              <input
                type="range"
                min="0.01"
                max="1.0"
                step="0.01"
                v-model="visualSettings.jointFrameSize"
                class="du-range du-range-primary du-range-xs [--du-range-fill:0]"
              />
            </div>
          </label>
          <!-- 显示 Link 坐标系复选框 -->
          <label class="du-list-row my-list-row">
            <input
              type="checkbox"
              v-model="visualSettings.showLinkFrames"
              class="du-checkbox du-checkbox-primary my-front-input"
            />
            <span
              class="my-row-text"
              :title="i18n('webview.control.showLinkFrames')"
            >
              {{ i18n("webview.control.showLinkFrames") }}
            </span>
            <VTooltip class="shrink-0" :delay="0" :distance="8">
              <HintIcon class="my-hint-icon" />
              <template #popper>
                <div class="max-w-50">
                  {{ i18n("webview.control.showLinkFrames.hint") }}
                </div>
              </template>
            </VTooltip>
          </label>
          <!-- Link 坐标系尺寸调节 -->
          <label class="du-list-row my-list-row h-10!">
            <div class="my-front-input"></div>
            <div>
              <div>{{ i18n("webview.control.linkFrameSize") }}</div>
              <input
                type="range"
                min="0.01"
                max="1.0"
                step="0.01"
                v-model="visualSettings.linkFrameSize"
                class="du-range du-range-primary du-range-xs [--du-range-fill:0]"
              />
            </div>
          </label>
        </ul>

        <!-- 机器人树形结构-------------------------- -->
        <RobotTree />
        <!-- Joint列表-------------------------- -->
        <JointList class="mt-2!" />
      </div>
    </div>
    <!-- 设置面板 -->
    <SettingsPanel class="pointer-events-auto" />

    <!-- 重置按钮 -->
    <VTooltip class="pointer-events-auto" :delay="0" :distance="8">
      <button
        class="du-btn du-btn-outline du-btn-primary h-10"
        @click="onReloadClick"
      >
        <ReloadIcon class="w-5 h-5 mr-2" />
        {{ i18n("webview.reload") }}
      </button>
      <template #popper>
        {{ i18n("webview.reload.hint") }}
      </template>
    </VTooltip>

    <!-- Centered file + lock toggle. `fixed` anchors to the viewport, not the panel.
         Shown only for xacro files since plain URDFs have no includes to lock. -->
    <div
      v-if="previewedBasename && isXacroPreview"
      class="fixed left-1/2 top-5 -translate-x-1/2 pointer-events-none z-10"
    >
      <VTooltip class="pointer-events-auto" :delay="0" :distance="8">
        <button
          class="du-btn du-btn-sm du-btn-ghost h-10 gap-2 bg-base-100/80 border border-base-300 max-w-md"
          @click="onLockClick"
        >
          <!-- Body static; shackle rotates around (7, 11) on toggle. -->
          <svg
            class="w-4 h-4 shrink-0 transition-[color,opacity] duration-200"
            :class="
              vscodeSettings.lockToPreviewedFile
                ? 'text-primary'
                : 'opacity-60'
            "
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path
              class="lock-shackle"
              :class="{ 'is-open': !vscodeSettings.lockToPreviewedFile }"
              d="M7 11V7a5 5 0 0110 0v4"
            />
          </svg>
          <span class="font-mono text-sm truncate normal-case">
            {{ previewedBasename }}
          </span>
        </button>
        <template #popper>
          <div class="max-w-60">
            {{
              vscodeSettings.lockToPreviewedFile
                ? i18n("webview.lock.locked.hint")
                : i18n("webview.lock.unlocked.hint")
            }}
          </div>
        </template>
      </VTooltip>
    </div>
  </div>
</template>
<style scoped>
@reference "tailwindcss";

:deep(.my-list-row) {
  @apply p-0 items-center min-w-0;
  @apply hover:underline h-5 leading-5 mb-2;
}

:deep(.my-row-text) {
  @apply flex-1 min-w-0 truncate;
}

:deep(.my-front-input) {
  @apply h-4 w-4 shrink-0;
}

:deep(.my-hint-icon) {
  @apply w-4 h-4 ml-1 shrink-0;
  color: color-mix(in oklab, var(--color-base-content) 60%, transparent);
}

:deep(.title-bar) {
  @apply grid grid-cols-3 items-center;
}

:deep(.title-bar h1) {
  @apply text-center text-base justify-self-center;
}

:deep(.my-collapse-content) {
  scrollbar-width: thin;
}

/* Lock shackle swings around its left base point (7, 11 in viewBox coords).
   transform-box: view-box anchors the origin in user-space, not the path's
   bounding box. */
.lock-shackle {
  transform-box: view-box;
  transform-origin: 7px 11px;
  transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
}

.lock-shackle.is-open {
  transform: rotate(-28deg);
}
</style>
