import { watch } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { vscodeSettings } from "@/stores/vscode-settings";
import { visualSettings } from "@/stores/visual-settings";
import { CustomURDFDragControls } from "@/utils/CustomURDFDragControls";

// 构造 Three.js 基础设施
export const {
    scene,
    camera,
    renderer,
    dragControls,
    dirLight,
    ambientLight,
    controls,
} = (() => {
    const scene: THREE.Scene = new THREE.Scene();
    watch(
        () => visualSettings.backgroundColor,
        (newColor) => {
            scene.background = new THREE.Color(newColor);
        },
        { immediate: true }
    );

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

    const controls: OrbitControls = new OrbitControls(
        camera,
        renderer.domElement
    );
    controls.minDistance = 0.05;
    controls.target.y = 1;
    controls.update();

    const dragControls = new CustomURDFDragControls(
        scene,
        camera,
        controls,
        renderer.domElement
    );

    return {
        scene,
        camera,
        renderer,
        dragControls,
        dirLight,
        ambientLight,
        controls,
    };
})();
