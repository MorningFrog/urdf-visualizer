import type { Material, Mesh, Object3D } from 'three';

/** Create a visual instance without mutating the cached mesh or its materials. */
export function instantiateMesh(
    template: Object3D,
    urdfMaterial: Material,
    useUrdfMaterial: boolean,
): Object3D {
    const instance = template.clone(true);
    instance.traverse(object => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        // STL and OBJ (loaded without MTL) have only loader-generated materials.
        // Authored vertex colors, GLB/GLTF and DAE keep their embedded appearance.
        if (useUrdfMaterial && !mesh.geometry.hasAttribute('color')) {
            mesh.material = urdfMaterial.clone();
        } else {
            mesh.material = Array.isArray(mesh.material)
                ? mesh.material.map(material => material.clone())
                : mesh.material.clone();
        }
    });
    return instance;
}
