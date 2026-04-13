<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, ref, provide } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { vscodeSettings } from '@/stores/vscode-settings';
import { visualSettings } from '@/stores/visual-settings';
import { scene, camera, renderer } from '@/stores/scene-store';
import ModuleUrdf from '@/modules/module-urdf.vue';

const urdfViewerRef = ref<HTMLElement | null>(null);

/**
 * 处理窗口大小变化
 */
const onResize = () => {
    if (!urdfViewerRef.value) return;
    renderer.setSize(urdfViewerRef.value!.clientWidth, urdfViewerRef.value!.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    camera.aspect = urdfViewerRef.value!.clientWidth / urdfViewerRef.value!.clientHeight;
    camera.updateProjectionMatrix();
}

/**
 * 渲染循环
 */
const render = () => {
    requestAnimationFrame(() => render());
    renderer.render(scene, camera);
}

onMounted(() => {
    if (!urdfViewerRef.value) return;
    urdfViewerRef.value.appendChild(renderer.domElement);
    urdfViewerRef.value.addEventListener('pointerleave', () => {
        dragControls.onMouseLeaveCallback();
    });

    onResize();
    window.addEventListener('resize', onResize);
    render();
})

onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize)
})

</script>

<template>
    <div ref="urdfViewerRef">
        <module-urdf></module-urdf>
    </div>
</template>