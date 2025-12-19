<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, ref, provide } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { vscodeSettings } from '@/stores/vscode-settings';
import ModuleUrdf from '@/modules/module-urdf.vue';

import { sceneKey, cameraKey, rendererKey, controlsKey, dragControlsKey } from '@/injects/main-view-injects';
import { CustomURDFDragControls } from '@/utils/CustomURDFDragControls';

const urdfViewerRef = ref<HTMLElement | null>(null);

// 构造 Three.js 基础设施
const { scene, camera, renderer, dragControls, dirLight, ambientLight, controls } = (() => {

    const scene: THREE.Scene = new THREE.Scene();
    watch(() => vscodeSettings.backgroundColor, (newColor) => {
        scene.background = new THREE.Color(newColor);
    }, { immediate: true });

    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 10, 10);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    camera.layers.enable(1); // 显示关节轴等注释层

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0xffffff);
    renderer.setClearAlpha(0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const dirLight = new THREE.DirectionalLight(0xffffff, Math.PI);
    dirLight.position.set(4, 10, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);
    scene.add(dirLight.target);

    const ambientLight = new THREE.AmbientLight("#fff", 1.0);
    scene.add(ambientLight);

    const controls: OrbitControls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 0.05;
    controls.target.y = 1;
    controls.update();

    const dragControls = new CustomURDFDragControls(
        scene, camera, controls, renderer.domElement
    )

    return { scene, camera, renderer, dragControls, dirLight, ambientLight, controls };
})();

// 提供 Three.js 相关实例
provide(sceneKey, scene);
provide(cameraKey, camera);
provide(rendererKey, renderer);
provide(controlsKey, controls);
provide(dragControlsKey, dragControls);


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