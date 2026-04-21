import * as THREE from "three";
import type { URDFLink } from "urdf-loader";

const JACOBI_MAX_ITERATIONS = 16;
const JACOBI_EPSILON = 1e-10;
const NUMERIC_EPSILON = 1e-9;

export interface EquivalentInertiaBox {
    /** 等效惯量盒在 inertial frame 下的尺寸 */
    size: THREE.Vector3;
    /** 主惯量 */
    principalMoments: THREE.Vector3;
    /** 主惯量坐标系相对 inertial frame 的旋转 */
    principalRotation: THREE.Quaternion;
    /** inertial origin 的平移 */
    inertialPosition: THREE.Vector3;
    /** inertial origin 的旋转 */
    inertialRotation: THREE.Euler;
}

/**
 * 对 3x3 对称矩阵做 Jacobi 特征分解.
 * - 返回的 vectors 以列向量形式存储特征向量.
 */
function eigenDecomposeSymmetricMatrix3(matrix: number[][]): {
    values: number[];
    vectors: number[][];
} {
    const a = matrix.map((row) => [...row]);
    const v = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
    ];

    for (let iteration = 0; iteration < JACOBI_MAX_ITERATIONS; iteration++) {
        let p = 0;
        let q = 1;
        let maxOffDiagonal = Math.abs(a[p][q]);

        for (let row = 0; row < 3; row++) {
            for (let col = row + 1; col < 3; col++) {
                const value = Math.abs(a[row][col]);
                if (value > maxOffDiagonal) {
                    maxOffDiagonal = value;
                    p = row;
                    q = col;
                }
            }
        }

        if (maxOffDiagonal < JACOBI_EPSILON) {
            break;
        }

        const app = a[p][p];
        const aqq = a[q][q];
        const apq = a[p][q];
        const tau = (aqq - app) / (2 * apq);
        const t =
            Math.sign(tau || 1) /
            (Math.abs(tau) + Math.sqrt(1 + tau * tau));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;

        a[p][p] = app - t * apq;
        a[q][q] = aqq + t * apq;
        a[p][q] = 0;
        a[q][p] = 0;

        for (let k = 0; k < 3; k++) {
            if (k === p || k === q) {
                continue;
            }

            const akp = a[k][p];
            const akq = a[k][q];
            a[k][p] = c * akp - s * akq;
            a[p][k] = a[k][p];
            a[k][q] = s * akp + c * akq;
            a[q][k] = a[k][q];
        }

        for (let k = 0; k < 3; k++) {
            const vkp = v[k][p];
            const vkq = v[k][q];
            v[k][p] = c * vkp - s * vkq;
            v[k][q] = s * vkp + c * vkq;
        }
    }

    const eigenPairs = [
        {
            value: a[0][0],
            vector: new THREE.Vector3(v[0][0], v[1][0], v[2][0]).normalize(),
        },
        {
            value: a[1][1],
            vector: new THREE.Vector3(v[0][1], v[1][1], v[2][1]).normalize(),
        },
        {
            value: a[2][2],
            vector: new THREE.Vector3(v[0][2], v[1][2], v[2][2]).normalize(),
        },
    ].sort((left, right) => left.value - right.value);

    const xAxis = eigenPairs[0].vector.clone();
    const yAxis = eigenPairs[1].vector.clone();
    const zAxis = eigenPairs[2].vector.clone();

    // 纠正符号, 保证主轴基底为右手系.
    if (new THREE.Vector3().crossVectors(xAxis, yAxis).dot(zAxis) < 0) {
        zAxis.multiplyScalar(-1);
    }

    return {
        values: eigenPairs.map((pair) => pair.value),
        vectors: [
            [xAxis.x, yAxis.x, zAxis.x],
            [xAxis.y, yAxis.y, zAxis.y],
            [xAxis.z, yAxis.z, zAxis.z],
        ],
    };
}

/**
 * 由 URDF 的质量与惯量张量构造“等效均匀长方体”.
 * - 返回的 box 位姿由 inertial frame 和主惯量方向共同决定.
 * - 当数据为空、质量非正或惯量不合法时返回 null.
 */
export function computeEquivalentInertiaBox(
    link: URDFLink
): EquivalentInertiaBox | null {
    const { mass, origin, inertia } = link.inertial;

    if (!(mass > NUMERIC_EPSILON)) {
        return null;
    }

    const inertiaMatrix = [
        [inertia.ixx, inertia.ixy, inertia.ixz],
        [inertia.ixy, inertia.iyy, inertia.iyz],
        [inertia.ixz, inertia.iyz, inertia.izz],
    ];

    const { values, vectors } = eigenDecomposeSymmetricMatrix3(inertiaMatrix);

    if (values.some((value) => !Number.isFinite(value) || value < -NUMERIC_EPSILON)) {
        return null;
    }

    const [ix, iy, iz] = values.map((value) => Math.max(value, 0));
    const sizeSquared = [
        (6 / mass) * (iy + iz - ix),
        (6 / mass) * (ix + iz - iy),
        (6 / mass) * (ix + iy - iz),
    ];

    if (
        sizeSquared.some(
            (value) => !Number.isFinite(value) || value < -NUMERIC_EPSILON
        )
    ) {
        return null;
    }

    const size = new THREE.Vector3(
        Math.sqrt(Math.max(sizeSquared[0], 0)),
        Math.sqrt(Math.max(sizeSquared[1], 0)),
        Math.sqrt(Math.max(sizeSquared[2], 0))
    );

    if (size.lengthSq() <= NUMERIC_EPSILON) {
        return null;
    }

    const basis = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(vectors[0][0], vectors[1][0], vectors[2][0]),
        new THREE.Vector3(vectors[0][1], vectors[1][1], vectors[2][1]),
        new THREE.Vector3(vectors[0][2], vectors[1][2], vectors[2][2])
    );

    return {
        size,
        principalMoments: new THREE.Vector3(ix, iy, iz),
        principalRotation: new THREE.Quaternion().setFromRotationMatrix(basis),
        inertialPosition: new THREE.Vector3(
            origin.xyz[0] ?? 0,
            origin.xyz[1] ?? 0,
            origin.xyz[2] ?? 0
        ),
        inertialRotation: new THREE.Euler(
            origin.rpy[0] ?? 0,
            origin.rpy[1] ?? 0,
            origin.rpy[2] ?? 0,
            "XYZ"
        ),
    };
}
