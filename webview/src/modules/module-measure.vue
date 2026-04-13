<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import { camera, controls, dragControls, renderer, scene } from "@/stores/scene-store";
import { MeasureController } from "@/modules/measure-controller";

/**
 * 这个组件本身不渲染任何 DOM。
 * 它的职责只是把 Three.js 场景对象与测量控制器绑定起来, 作为一个纯逻辑模块挂载。
 */
const controller = new MeasureController({
    renderer,
    scene,
    camera,
    dragControls,
    orbitControls: controls,
});

onBeforeUnmount(() => {
    controller.dispose();
});
</script>

<template></template>
