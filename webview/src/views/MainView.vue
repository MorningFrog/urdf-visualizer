<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { scene, camera, renderer, dragControls } from '@/stores/scene-store';
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
