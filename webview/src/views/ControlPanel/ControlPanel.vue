<script setup lang="ts">
import { ref, computed, watch } from "vue";

import ReloadIcon from "/public/icons/reload.svg";
import HintIcon from "/public/icons/hint.svg";

import i18n from "@/stores/i18n";
import { visualSettings } from "@/stores/visual-settings";
import { urdfStore } from "@/stores/urdf-store";

import JointList from "./JointList.vue";
import RobotTree from "./RobotTree.vue";
import SettingsPanel from "./SettingsPanel.vue";

/** 重新加载 URDF */
const onReloadClick = () => {
  // 设置需要重新加载标志, module-urdf 会监听该标志并执行重新加载
  urdfStore.requireReload = true;
};
</script>
<template>
  <div class="flex items-start gap-2 pointer-events-none">
    <div class="du-collapse du-collapse-arrow 
      bg-base-100/50 border border-base-300 text-base-content 
      transition-[width] duration-300 w-32 has-[>_input:checked]:w-55
      overflow-hidden pointer-events-auto">
      <input type="checkbox" class="peer" />
      <div
        class="du-collapse-title font-semibold after:start-5 after:end-auto pe-4 ps-12 py-0 flex items-center h-10 text-base">
        <span>{{ i18n("webview.control.title") }}</span>
      </div>
      <div class="my-collapse-content du-collapse-content w-55 overflow-y-scroll pr-1 min-h-0"
        style="max-height: calc(100vh - 5rem)">
        <ul class="du-list p-0">
          <!-- 显示Visual复选框 -->
          <label class="du-list-row my-list-row">
            <input type="checkbox" v-model="visualSettings.showVisual"
              class="du-checkbox du-checkbox-primary my-front-input" />
            <span>{{ i18n("webview.control.showVisual") }}</span>
          </label>
          <!-- 显示Collision复选框 -->
          <label class="du-list-row my-list-row">
            <input type="checkbox" v-model="visualSettings.showCollision"
              class="du-checkbox du-checkbox-primary my-front-input" />
            <span>{{ i18n("webview.control.showCollision") }}</span>
          </label>
          <!-- 显示世界坐标系复选框 -->
          <label class="du-list-row my-list-row">
            <input type="checkbox" v-model="visualSettings.showWorldFrame"
              class="du-checkbox du-checkbox-primary my-front-input" />
            <span>{{ i18n("webview.control.showWorldFrame") }}</span>
            <VTooltip :delay="0" :distance="8">
              <HintIcon class="my-hint-icon" />
              <template #popper>
                <div class="max-w-50">{{ i18n("webview.control.showWorldFrame.hint") }}</div>
              </template>
            </VTooltip>
          </label>
          <!-- 显示 Joint 坐标系复选框 -->
          <label class="du-list-row my-list-row">
            <input type="checkbox" v-model="visualSettings.showJointFrames"
              class="du-checkbox du-checkbox-primary my-front-input" />
            <span>{{ i18n("webview.control.showJointFrames") }}</span>
            <VTooltip :delay="0" :distance="8">
              <HintIcon class="my-hint-icon" />
              <template #popper>
                <div class="max-w-50">{{ i18n("webview.control.showJointFrames.hint") }}</div>
              </template>
            </VTooltip>
          </label>
          <!-- Joint 坐标系尺寸调节 -->
          <label class="du-list-row my-list-row h-10!">
            <div class="my-front-input"></div>
            <div>
              <div>{{ i18n("webview.control.jointFrameSize") }}</div>
              <input type="range" min="0.01" max="1.0" step="0.01" v-model="visualSettings.jointFrameSize"
                class="du-range du-range-primary du-range-xs [--du-range-fill:0]" />
            </div>
          </label>
          <!-- 显示 Link 坐标系复选框 -->
          <label class="du-list-row my-list-row">
            <input type="checkbox" v-model="visualSettings.showLinkFrames"
              class="du-checkbox du-checkbox-primary my-front-input" />
            <span>{{ i18n("webview.control.showLinkFrames") }}</span>
            <VTooltip :delay="0" :distance="8">
              <HintIcon class="my-hint-icon" />
              <template #popper>
                <div class="max-w-50">{{ i18n("webview.control.showLinkFrames.hint") }}</div>
              </template>
            </VTooltip>
          </label>
          <!-- Link 坐标系尺寸调节 -->
          <label class="du-list-row my-list-row h-10!">
            <div class="my-front-input"></div>
            <div>
              <div>{{ i18n("webview.control.linkFrameSize") }}</div>
              <input type="range" min="0.01" max="1.0" step="0.01" v-model="visualSettings.linkFrameSize"
                class="du-range du-range-primary du-range-xs [--du-range-fill:0]" />
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
      <button class="du-btn du-btn-outline du-btn-primary h-10" @click="onReloadClick">
        <ReloadIcon class="w-5 h-5 mr-2" />
        {{ i18n("webview.reload") }}
      </button>
      <template #popper>
        {{ i18n("webview.reload.hint") }}
      </template>
    </VTooltip>
  </div>
</template>
<style scoped>
@reference '@/styles/main.css';

:deep(.my-list-row) {
  @apply p-0 items-center;
  @apply hover:underline h-5 leading-5 mb-2;
}

:deep(.my-front-input) {
  @apply h-4 w-4;
}

:deep(.my-hint-icon) {
  @apply w-4 h-4 ml-1;
  @apply text-base-content/60;
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
</style>
