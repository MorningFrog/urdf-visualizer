<script setup lang="ts">
/**
 * @componet TreeNodeComponent
 *
 * @description 用 <li> 和 <ul> 标签来创建一个树形结构的组件.
 *              需要包含在一个 <ul> 中.
 *
 * @props
 * - node: LinkTreeNode | null - 树形结构的节点数据.
 * - models: Record<string, computed<boolean>> - link可见性模型.
 */
import { type Ref, computed } from "vue";

import InvisibleIcon from "/public/icons/invisible.svg";
import VisibleIcon from "/public/icons/visible.svg";
import { urdfStore, type LinkTreeNode } from '@/stores/urdf-store';

const props = defineProps<{
  node: LinkTreeNode | null
  models: Record<string, computed<boolean>>
}>();

const node = computed(() => props.node);
const models = computed(() => props.models);
</script>

<template>
  <li>
    <div class="flex items-center justify-between w-full p-0" @mouseenter="urdfStore.hoveredLinkName = node.name"
      @mouseleave="urdfStore.hoveredLinkName = null">
      <span :class="{ 'font-bold!': urdfStore.hoveredLinkName === node.name }">{{ node.name }}</span>
      <label class="du-toggle du-toggle-sm text-primary bg-transparent">
        <input type="checkbox" v-model="models[node.name]" />
        <InvisibleIcon aria-label="disabled" class="w-4 h-4" />
        <VisibleIcon aria-label="enabled" class="w-4 h-4" />
      </label>
    </div>
    <ul v-if="node.children.length > 0">
      <TreeNodeComponent v-for="child in node.children" :key="child.name" :node="child" :models="models" />
    </ul>
  </li>
</template>
