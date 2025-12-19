<script setup lang="ts">
import { computed, defineComponent, ref, watch } from 'vue';

import type {
  URDFRobot,
  URDFJoint,
  URDFVisual,
  URDFLink,
  URDFCollider,
} from "urdf-loader";

import i18n from '@/stores/i18n';
import InvisibleIcon from '/public/icons/invisible.svg';
import VisibleIcon from '/public/icons/visible.svg';
import HintIcon from '/public/icons/hint.svg';
import { urdfStore, setLinkVisibility } from '@/stores/urdf-store';

import TreeNodeComponent from './tree-node-component/TreeNodeComponent.vue';

// Create computed models for all links for v-model compatibility
const linkVisibilityModels = ref<Record<string, typeof computed<boolean>>>({});
watch(() => urdfStore.linkVisibility, (newLinkVisibility) => {
  const models: Record<string, typeof computed<boolean>> = {};
  for (const link_name in newLinkVisibility) {
    models[link_name] = computed<boolean>({
      get: () => urdfStore.linkVisibility[link_name] ?? true,
      set: (val) => setLinkVisibility(link_name, val),
    });
  }
  linkVisibilityModels.value = models;
}, { immediate: true });

/** 是否有隐藏的 link */
const hasHiddenLinks = computed(() => {
  for (const visible of Object.values(urdfStore.linkVisibility)) {
    if (!visible) return true;
  }
  return false;
});

const toggleAllLinksVisibility = () => {
  const shouldShowAll = hasHiddenLinks.value;
  for (const link_name in urdfStore.linkVisibility) {
    setLinkVisibility(link_name, shouldShowAll);
  }
};
</script>

<template>
  <div>
    <!-- 标题 -->
    <div class="title-bar z-20 relative pointer-events-none">
      <div></div>
      <h1 class="pointer-events-auto">{{ i18n("base.link") }}</h1>
      <div class="justify-self-end pointer-events-auto">
        <VTooltip :delay="0" :distance="8">
          <HintIcon class="my-hint-icon" />
          <template #popper>
            <div class="max-w-50">
              {{ i18n("webview.linkListHint") }}
            </div>
          </template>
        </VTooltip>
      </div>
    </div>

    <div class="du-collapse du-collapse-arrow bg-transparent -mt-7.5! z-10 relative">
      <input type="checkbox" class="peer" />
      <div class="du-collapse-title font-semibold after:start-2 after:end-auto pe-4 ps-16 py-0"></div>
      <div class="du-collapse-content w-full p-0">
        <!-- Link操作 -->
        <div class="flex justify-between">
          <div></div>
          <VTooltip :delay="0" :distance="8">
            <button @click="toggleAllLinksVisibility" class="du-btn du-btn-ghost du-btn-sm px-1 py-0.5">
              {{
                hasHiddenLinks
                  ? i18n("webview.showAllLinks")
                  : i18n("webview.hideAllLinks")
              }}
            </button>
            <template #popper>
              <div class="max-w-50">
                {{
                  hasHiddenLinks
                    ? i18n("webview.showAllLinks.hint")
                    : i18n("webview.hideAllLinks.hint")
                }}
              </div>
            </template>
          </VTooltip>
        </div>

        <!-- Link列表内容 -->
        <ul v-if="urdfStore.linkTree" class="du-menu bg-transparent w-full p-0">
          <TreeNodeComponent :node="urdfStore.linkTree" :models="linkVisibilityModels" :key="urdfStore.linkTree.name" />
        </ul>
      </div>
    </div>
  </div>
</template>
<style scoped></style>
