import type { InjectionKey } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { CustomURDFDragControls } from "@/utils/CustomURDFDragControls";

export const sceneKey: InjectionKey<THREE.Scene> = Symbol("scene");
export const cameraKey: InjectionKey<THREE.PerspectiveCamera> =
    Symbol("camera");
export const rendererKey: InjectionKey<THREE.WebGLRenderer> =
    Symbol("renderer");
export const controlsKey: InjectionKey<OrbitControls> = Symbol("controls");
export const dragControlsKey: InjectionKey<CustomURDFDragControls> =
    Symbol("dragControls");
