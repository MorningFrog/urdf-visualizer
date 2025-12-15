<script setup lang="ts">
import { inject, ref, watch, watchEffect, markRaw, toRaw, nextTick } from 'vue';

import * as THREE from 'three';
import { LoadingManager } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import URDFLoader from "urdf-loader";
import type {
    URDFRobot,
    URDFJoint,
    URDFVisual,
    URDFLink,
    URDFCollider,
} from "urdf-loader";
import { LinkAxesHelper, JointAxesHelper, BaseAxesHelper } from '@/utils/custom-axes';
import { computeRobotBounds } from '@/utils/threejs-tools';

import { sceneKey, cameraKey, rendererKey, controlsKey, dragControlsKey } from '@/injects/main-view-injects';
import { vscodeSettings } from '@/stores/vscode-settings';
import { visualSettings } from '@/stores/visual-settings';
import { urdfStore } from '@/stores/urdf-store';
import { vscode } from '@/utils/vscode-api';

const scene = inject(sceneKey)!;
const camera = inject(cameraKey)!;
const renderer = inject(rendererKey)!;
const controls = inject(controlsKey)!;
const dragControls = inject(dragControlsKey)!;

/** 全局尺寸, 用于缩放坐标系 */
const globalScale = ref(1.0);

/** 正在进行的 mesh 加载进程 id */
let activeLoadId = 0;
/** 正在加载的 mesh 数量 */
let pendingMeshes = 0;
/**  */
let resolvePending: (() => void) | null = null;

// 记录当前 load robot 时初始的相机位姿
const initialTarget = new THREE.Vector3();
const initialPosition = new THREE.Vector3();
let initialZoom = 1.0;
// 当前相机位姿对应的文件和工作目录
let currentCameraFile = "";
let currentCameraWorkingPath = "";
/** 记录各个文件的相机位姿, 格式: { workingPath: { filename: { position, target, zoom } } } */
const cameraPoses: Map<string, Map<string, {
    position: THREE.Vector3,
    target: THREE.Vector3,
    zoom: number
}>> = new Map();

const { collisionMaterial,
    manager, loaderURDF, loaderSTL, loaderGLTF, loaderCollada, loaderOBJ,
    meshCache,
    worldAxes, jointAxes, linkAxes,
} = (() => {
    // 碰撞体材质
    const collisionMaterial = new THREE.MeshPhongMaterial({
        transparent: true,
        opacity: 0.35,
        shininess: 2.5,
        premultipliedAlpha: true,
        color: 0xffbe38,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
    });

    // 创建模型加载器
    const manager = new LoadingManager();
    const loaderURDF = new URDFLoader(manager);
    const loaderSTL = new STLLoader(manager);
    const loaderGLTF = new GLTFLoader(manager);
    const loaderCollada = new ColladaLoader(manager);
    const loaderOBJ = new OBJLoader(manager);

    // 设置ROS功能包所在的目录
    watch(() => vscodeSettings.packages, (packages) => {
        loaderURDF.packages = packages;
    }, { immediate: true });
    // 确保 visual 和 collison 都被解析
    loaderURDF.parseCollision = true;
    loaderURDF.parseVisual = true;

    // mesh 缓存对象
    const meshCache = new Map<string, THREE.Object3D>();
    watch(() => vscodeSettings.cacheMesh,
        (enable) => {
            if (!enable) {
                meshCache.clear();
            }
        }, { immediate: true }
    );

    // 设置资源处理函数
    manager.setURLModifier((url: string): string => {
        // 删除其中的 `file://`
        url = url.replace("file://", "");
        // 替换其中的 `\` 为 `/`
        url = url.replace(/\\/g, "/");
        // 对于 Windows 系统, 添加 `/` 前缀
        if (!url.startsWith("/")) {
            url = "/" + url;
        }
        // 如果出现两个 `//` 忽略第一个 `/` 前的所有内容
        const doubleSlashIndex = url.indexOf("//");
        if (doubleSlashIndex !== -1) {
            url = url.slice(doubleSlashIndex + 1);
        }
        // console.log("url", url);
        return vscodeSettings.uriPrefix + url;
    });

    // 设置 loaderURDF 的 workingPath
    watch(() => vscodeSettings.workingPath, (newPath) => {
        loaderURDF.workingPath = newPath;
    }, { immediate: true });

    // 设置 mesh 处理函数
    loaderURDF.loadMeshCb = (
        path: string,
        manager: LoadingManager,
        onComplete: (mesh: THREE.Object3D, err?: Error) => void
    ) => {
        // 如果缓存中有该 mesh, 则直接返回
        if (vscodeSettings.cacheMesh && meshCache.has(path)) {
            const cachedMesh = meshCache.get(path)!.clone();
            onComplete(cachedMesh);
            return;
        }
        // 否则, 通过相应的 loader 加载 mesh

        const webview_path = path;
        // 扩展名
        const ext = webview_path?.split(/\./g)?.pop()?.toLowerCase();

        // 封装处理函数
        const handleComplete = (
            mesh: THREE.Object3D | null,
            err?: Error
        ) => {
            if (vscodeSettings.cacheMesh && mesh) {
                // 成功时缓存结果
                meshCache.set(path, mesh.clone());
            }
            // @ts-ignore: 符合URDFLoader的回调签名
            onComplete(mesh, err);

            // 只影响“当前这次 load”
            if (loadId !== activeLoadId) return;

            pendingMeshes--;
            if (pendingMeshes === 0) resolvePending?.();
        };

        const loadId = activeLoadId;
        pendingMeshes++;
        switch (ext) {
            case "gltf":
            case "glb":
                loaderGLTF.load(
                    webview_path,
                    (result: any) => handleComplete(result.scene),
                    undefined,
                    // @ts-ignore
                    (err: Error) => handleComplete(null, err)
                );
                break;
            case "obj":
                loaderOBJ.load(
                    webview_path,
                    (result: any) => handleComplete(result),
                    undefined,
                    // @ts-ignore
                    (err: Error) => handleComplete(null, err)
                );
                break;
            case "dae":
                loaderCollada.load(
                    webview_path,
                    (result: any) => handleComplete(result.scene),
                    undefined,
                    // @ts-ignore
                    (err: Error) => handleComplete(null, err)
                );
                break;
            case "stl":
                loaderSTL.load(
                    webview_path,
                    (result: any) => {
                        const material = new THREE.MeshPhongMaterial();
                        handleComplete(new THREE.Mesh(result, material));
                    },
                    undefined,
                    // @ts-ignore
                    (err: Error) => handleComplete(null, err)
                );
                break;
            default:
                // 如果是其他格式, 则直接返回错误
                handleComplete(
                    null,
                    new Error(`Unsupported mesh file format: ${ext}`)
                );
        }
    };

    // 创建世界坐标系
    const worldAxes: THREE.AxesHelper = new THREE.AxesHelper(1);
    worldAxes.layers.set(1); // 设置为注释层
    scene.add(worldAxes);
    watch(() => visualSettings.showWorldFrame, (show) => {
        worldAxes.visible = show;
    })
    // joint 和 link 的坐标系对象列表
    const jointAxes: Map<string, JointAxesHelper> = new Map();
    const linkAxes: Map<string, LinkAxesHelper> = new Map();
    watch(() => urdfStore.robot, (robot) => {
        jointAxes.clear();
        linkAxes.clear();
        if (!robot) {
            return;
        }
        // 遍历所有 joint 和 link, 创建 jointAxes 和 linkAxes
        Object.entries<URDFJoint>(urdfStore.robot!.joints).forEach(
            ([joint_name, joint]) => {
                if (joint.jointType === "fixed") {
                    return;
                }
                const axesHelper = new JointAxesHelper(
                    visualSettings.jointFrameSize,
                    globalScale.value,
                    joint.axis,
                );
                axesHelper.setLayer(1); // 注释层
                axesHelper.visible = visualSettings.showJointFrames;
                joint.add(axesHelper);
                jointAxes.set(joint_name, axesHelper);
            }
        );
        Object.entries<URDFLink>(urdfStore.robot!.links).forEach(
            ([link_name, link]) => {
                const axesHelper = new LinkAxesHelper(
                    visualSettings.linkFrameSize,
                    globalScale.value,
                );
                axesHelper.setLayer(1); // 注释层
                axesHelper.visible = visualSettings.showLinkFrames;
                link.add(axesHelper);
                linkAxes.set(link_name, axesHelper);
            }
        );
    });
    watch(() => visualSettings.showLinkFrames, (show) => {
        linkAxes.forEach((axes) => {
            axes.visible = show;
        });
    });
    watch(globalScale, (newScale) => {
        worldAxes.scale.set(newScale * 1.5, newScale * 1.5, newScale * 1.5);
        jointAxes.forEach((axes) => {
            axes.setGlobalScale(newScale);
        });
        linkAxes.forEach((axes) => {
            axes.setGlobalScale(newScale);
        });
    }, { immediate: true });
    watch(() => visualSettings.jointFrameSize, (size) => {
        jointAxes.forEach((axes) => {
            axes.setSize(size);
        });
    });
    watch(() => visualSettings.linkFrameSize, (size) => {
        linkAxes.forEach((axes) => {
            axes.setSize(size);
        });
    });
    const modifyFramesVisibilityAndHighlight = ([showFrames, highlightEnabled, hoveredName], [oldShowFrames, oldHighlightEnabled, oldHoveredName], axesMap: Map<string, BaseAxesHelper>) => {
        // 处理显示切换
        if (showFrames) {
            if (!oldShowFrames) {
                // 没有显示则显示所有 joint 坐标系
                axesMap.forEach((axes) => {
                    axes.visible = true;
                });
            }
        } else {
            if (oldShowFrames) {
                // 之前显示, 现在隐藏
                axesMap.forEach((axes, jointName) => {
                    if (highlightEnabled && jointName === hoveredName) {
                        // 高亮的 joint 坐标系保持显示
                        return;
                    }
                    axes.visible = false;
                });
            } else {
                // 之前没有显示, 现在也没有显示
                if (oldHoveredName === hoveredName) {
                    // 悬停对象没有变化
                    const axesHelper = axesMap.get(hoveredName);
                    if (axesHelper) {
                        axesHelper.visible = highlightEnabled;
                    }
                } else {
                    // 悬停对象变化
                    const oldAxes = axesMap.get(oldHoveredName);
                    if (oldAxes) {
                        oldAxes.visible = false;
                    }
                    const axesHelper = axesMap.get(hoveredName);
                    if (axesHelper) {
                        axesHelper.visible = highlightEnabled;
                    }
                }
            }
        }

        // 处理高亮切换
        if (oldHighlightEnabled === highlightEnabled &&
            oldHoveredName === hoveredName) {
            // 高亮状态没有变化则不处理
            return;
        }
        if (oldHoveredName === hoveredName) {
            // 悬停对象没有变化, 是否高亮完全由 enable 控制
            const axesHelper = axesMap.get(hoveredName);
            if (axesHelper) {
                axesHelper.setHovered(true, highlightEnabled);
            }
        } else {
            // 悬停对象变化, 先取消上一个对象的高亮, 再设置当前对象的高亮
            const oldAxes = axesMap.get(oldHoveredName);
            if (oldAxes) {
                oldAxes.setHovered(false);
            }
            const axesHelper = axesMap.get(hoveredName);
            if (axesHelper) {
                axesHelper.setHovered(true, highlightEnabled);
            }
        }

    }
    watch(() => [visualSettings.showJointFrames, vscodeSettings.highlightJointWhenHover, urdfStore.hoveredJointName],
        ([showFrames, highlightEnabled, hoveredName], [oldShowFrames, oldHighlightEnabled, oldHoveredName]) => {
            modifyFramesVisibilityAndHighlight(
                [showFrames, highlightEnabled, hoveredName],
                [oldShowFrames, oldHighlightEnabled, oldHoveredName],
                jointAxes
            );
        });
    watch(() => [visualSettings.showLinkFrames, vscodeSettings.highlightLinkWhenHover, urdfStore.hoveredLinkName],
        ([showFrames, highlightEnabled, hoveredName], [oldShowFrames, oldHighlightEnabled, oldHoveredName]) => {
            modifyFramesVisibilityAndHighlight(
                [showFrames, highlightEnabled, hoveredName],
                [oldShowFrames, oldHighlightEnabled, oldHoveredName],
                linkAxes
            );
        });

    return {
        collisionMaterial,
        manager,
        loaderURDF,
        loaderSTL,
        loaderGLTF,
        loaderCollada,
        loaderOBJ,
        meshCache,
        worldAxes,
        jointAxes,
        linkAxes
    };
})();

/**
 * 处理重置视野
 */
const resetCameraView = () => {
    if (!vscodeSettings.requireResetCamera) return;
    if (!urdfStore.robot) return;
    // 保存相机位姿
    if (currentCameraWorkingPath && currentCameraFile
        && (
            currentCameraWorkingPath !== vscodeSettings.workingPath ||
            currentCameraFile !== vscodeSettings.filename
        )
    ) {
        if (
            !camera.position.equals(initialPosition) ||
            !controls.target.equals(initialTarget) ||
            camera.zoom !== initialZoom
        ) {
            if (!cameraPoses.has(currentCameraWorkingPath)) {
                cameraPoses.set(currentCameraWorkingPath, new Map());
            }
            const filePoses = cameraPoses.get(currentCameraWorkingPath)!;
            filePoses.set(currentCameraFile, {
                position: camera.position.clone(),
                target: controls.target.clone(),
                zoom: camera.zoom,
            });
        }
    }

    currentCameraWorkingPath = vscodeSettings.workingPath;
    currentCameraFile = vscodeSettings.filename;

    // 计算物体的包围盒
    const box = computeRobotBounds(urdfStore.robot!);

    // 看是否存在相机姿态缓存
    const cameraPose = cameraPoses.get(currentCameraWorkingPath)?.get(currentCameraFile)
    if (cameraPose) {
        // 存在则直接应用
        camera.position.copy(cameraPose.position);
        controls.target.copy(cameraPose.target);
        camera.zoom = cameraPose.zoom;
    } else {
        // 不存在则根据包围盒设置
        // 获取包围盒的中心和尺寸
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size); // 获取物体的大小
        box.getCenter(center); // 获取物体的中心

        // 计算包围盒对角线长度,用于确定摄像机的合适距离
        const maxSize = Math.max(size.x, size.y, size.z);
        const distance =
            maxSize / (2 * Math.tan((camera.fov * Math.PI) / 360)); // 摄像机距离
        const offset = 0.05; // 添加偏移量,确保物体完全在视野内

        // 设置相机位置和朝向
        camera.position.set(
            center.x + distance + offset,
            center.y + distance + offset,
            center.z + distance + offset
        );
        camera.lookAt(center);
        controls.target.copy(center);
    }

    camera.updateProjectionMatrix();
    controls.update();

    // 保存数据并重置标志
    initialTarget.copy(controls.target);
    initialPosition.copy(camera.position);
    initialZoom = camera.zoom;
    vscodeSettings.requireResetCamera = false;

    // 重设坐标系尺寸
    globalScale.value = Math.max(box.max.x, box.max.y, box.max.z);
};

/**
 * 处理 Visual 和 Collision 的显示切换
 */
const showVisualCollison = () => {
    function setLayerRecursive(object: THREE.Object3D, layer: number) {
        object.layers.set(layer); // 设置当前对象
        object.traverse((child1) => child1.layers.set(layer)); // 递归子对象
    }
    // @ts-ignore
    urdfStore.robot.traverse((child: THREE.Object3D) => {
        // @ts-ignore
        if (child.isURDFCollider) {
            child.visible = visualSettings.showCollision;
            if (!visualSettings.showCollision) {
                setLayerRecursive(child, 1); // 禁用 Raycaster 检测
            } else {
                setLayerRecursive(child, 0); // 恢复 Raycaster 检测
            }
        }
        // @ts-ignore
        else if (child.isURDFVisual) {
            child.visible = visualSettings.showVisual;
            if (!visualSettings.showVisual) {
                setLayerRecursive(child, 1); // 禁用 Raycaster 检测
            } else {
                setLayerRecursive(child, 0); // 恢复 Raycaster 检测
            }
        }
    });
}

/** 等待所有 mesh 加载完成 */
const waitPendingMeshes = (loadId: number) =>
    new Promise<void>((resolve) => {
        if (pendingMeshes <= 0) return resolve();
        resolvePending = () => {
            if (loadId === activeLoadId) resolve();
        };
    });

/** 删除机器人 */
const removeRobot = () => {
    if (!urdfStore.robot) return;
    scene.remove(markRaw(urdfStore.robot));
    urdfStore.robot = null;
    urdfStore.hoveredJointName = null;
    urdfStore.hoveredLinkName = null;
    urdfStore.isHoveredLinkVisual = false;
    urdfStore.jointValues.clear();
    // 删除 joint 和 link 坐标系
    jointAxes.clear();
    linkAxes.clear();
}

const loadURDF = async () => {
    // 设置新的 mesh 加载进程 id
    const loadId = ++activeLoadId;
    pendingMeshes = 0;
    resolvePending = null;

    // 删除已有机器人
    removeRobot();
    // 解析 URDF
    const robot = loaderURDF.parse(vscodeSettings.urdfText);
    urdfStore.robot = robot;
    // 添加到场景中
    scene.add(markRaw(robot));
    // 构造初始关节值
    Object.entries<URDFJoint>(robot.joints).forEach(
        ([joint_name, joint]) => {
            switch (joint.jointType) {
                case 'revolute':
                case 'continuous':
                case 'prismatic':
                    urdfStore.jointValues.set(joint_name, 0.0);
                    break;
                default:
            }
        }
    );

    // 等待 mesh 加载完成
    await waitPendingMeshes(loadId);
    if (loadId !== activeLoadId) return; // 已被新加载替代

    // 为 collider 设置默认材质
    robot.traverse(
        // @ts-ignore
        (child: URDFLink | URDFCollider | URDFVisual | THREE.Mesh) => {
            // @ts-ignore
            if (child.isURDFCollider) {
                // @ts-ignore
                child.traverse((c: THREE.Mesh) => {
                    c.material = collisionMaterial;
                    c.castShadow = false;
                    c.receiveShadow = false;
                });
            }
        }
    );

    // 处理 Visual 和 Collision 的显示
    showVisualCollison();

    // 设置视野
    resetCameraView();
}

watch(
    () => vscodeSettings.urdfText,
    (newUrdfText) => {
        if (!newUrdfText) {
            removeRobot();
            return;
        }
        loadURDF();
    },
    { immediate: true }
)

watch(() => [visualSettings.showVisual, visualSettings.showCollision], () => {
    showVisualCollison();
});

watch(
    () => urdfStore.requireReload,
    (requireReload) => {
        if (requireReload) {
            // 清除 camera 缓存
            if (
                currentCameraWorkingPath &&
                currentCameraFile &&
                cameraPoses.has(currentCameraWorkingPath)
            ) {
                const filePoses = cameraPoses.get(currentCameraWorkingPath)!;
                filePoses.delete(currentCameraFile);
            }
            // 清空 mesh 缓存
            meshCache.clear();
            // 重置标志
            urdfStore.requireReload = false;
            // 清空机器人
            vscodeSettings.urdfText = "";

            // 请求新 URDF 内容
            vscode.postMessage({ type: "getNewURDF" });
        }
    }
);

</script>
<template>
</template>