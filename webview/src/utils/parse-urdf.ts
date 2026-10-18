import { CapsuleGeometry, type Mesh, type Object3D } from "three";
import type URDFLoader from "urdf-loader";
import type { URDFCollider, URDFRobot, URDFVisual } from "urdf-loader/src/URDFClasses";

/** Parse MuJoCo-style capsules with a cylindrical core along the URDF Z axis. */
export function parseUrdfWithCapsules(loader: URDFLoader, text: string): URDFRobot {
    const document = new DOMParser().parseFromString(text, "text/xml");
    const replacements = new Map<Element, { capsule: Element; radius: number; length: number }>();
    for (const capsule of document.querySelectorAll("geometry > capsule")) {
        const kind = capsule.parentElement?.parentElement?.tagName;
        if (!(kind === "visual" && loader.parseVisual) && !(kind === "collision" && loader.parseCollision)) continue;
        const radiusText = capsule.getAttribute("radius");
        const lengthText = capsule.getAttribute("length");
        const radius = Number(radiusText);
        const length = Number(lengthText);
        if (!radiusText?.trim() || !lengthText?.trim() || !Number.isFinite(radius) || radius <= 0 ||
                !Number.isFinite(length) || length < 0) {
            throw new Error("Capsule geometry requires finite radius > 0 and length >= 0.");
        }
        // Let urdf-loader create the material, container and origin/RPY transform.
        const cylinder = document.createElement("cylinder");
        cylinder.setAttribute("radius", radiusText);
        cylinder.setAttribute("length", lengthText);
        capsule.replaceWith(cylinder);
        replacements.set(cylinder, { capsule, radius, length });
    }
    try {
        const robot = loader.parse(document);
        robot.traverse((object: Object3D) => {
            if (!("isURDFVisual" in object) && !("isURDFCollider" in object)) return;
            const shape = (object as URDFVisual | URDFCollider).urdfNode?.querySelector("geometry > cylinder");
            const spec = shape ? replacements.get(shape) : undefined;
            if (!spec) return;
            const mesh = object.children[0] as Mesh | undefined;
            if (!mesh?.isMesh) throw new Error("Capsule geometry did not produce a mesh.");
            mesh.geometry.dispose();
            mesh.geometry = new CapsuleGeometry(spec.radius, spec.length, 8, 32);
            // Both Three.js primitives use Y; the loader already rotated Y onto URDF Z.
            mesh.scale.set(1, 1, 1);
        });
        return robot;
    } finally {
        // Keep the original capsule nodes for source inspection and export.
        for (const [cylinder, { capsule }] of replacements) cylinder.replaceWith(capsule);
    }
}
