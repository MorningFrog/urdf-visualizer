<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
    formatJointValueWithUnit,
    getLengthUnitMultiplier,
    measureNumberToString,
} from '@/utils/math-tools';
import { urdfStore } from '@/stores/urdf-store';
import { mouseState } from '@/stores/mouse-state';
import { measureStore, MeasureMode } from '@/stores/measure-store';
import i18n from '@/stores/i18n';
import { isDraggableJoint, isAngularJoint } from "@/utils/joint-type";
import { computeEquivalentInertiaBox } from '@/utils/inertia-tools';
import { visualSettings } from '@/stores/visual-settings';
import { LengthUnit } from '@/utils/units';

const showModelInfo = computed(() => {
    if (measureStore.mode !== MeasureMode.None) {
        return false;
    }
    return (urdfStore.hoveredJointName !== null || urdfStore.hoveredLinkName !== null) && urdfStore.isHoveredOnModel;
});

const modelInfoStyle = computed(() => ({
    left: mouseState.mouseX + 'px',
    top: mouseState.mouseY + 'px',
}))

const hoveredLink = computed(() => {
    if (!urdfStore.hoveredLinkName) {
        return null;
    }
    return urdfStore.robot?.links[urdfStore.hoveredLinkName] ?? null;
});

const hoveredLinkInertia = computed(() => {
    if (!hoveredLink.value) {
        return null;
    }
    return computeEquivalentInertiaBox(hoveredLink.value);
});

const shouldShowInertiaDetails = computed(() => {
    return (
        visualSettings.showInertia ||
        visualSettings.showInertiaWhenHover
    );
});

const getLengthUnitLabel = () => {
    switch (visualSettings.lengthUnit) {
        case LengthUnit.Centimeters:
            return "cm";
        case LengthUnit.Millimeters:
            return "mm";
        case LengthUnit.Meters:
        default:
            return "m";
    }
};

const hoveredLinkMassStr = computed(() => {
    if (!hoveredLink.value?.inertial) {
        return "";
    }
    return `${measureNumberToString(hoveredLink.value.inertial.mass)} kg`;
});

const hoveredLinkPrincipalInertiaStr = computed(() => {
    if (!hoveredLinkInertia.value) {
        return "";
    }

    const { principalMoments } = hoveredLinkInertia.value;
    return `I1=${measureNumberToString(principalMoments.x)}, I2=${measureNumberToString(principalMoments.y)}, I3=${measureNumberToString(principalMoments.z)} kg*m^2`;
});

const hoveredLinkEquivalentBoxSizeStr = computed(() => {
    if (!hoveredLinkInertia.value) {
        return "";
    }

    const multiplier = getLengthUnitMultiplier();
    const { size } = hoveredLinkInertia.value;
    const unit = getLengthUnitLabel();
    return `${measureNumberToString(size.x * multiplier)} x ${measureNumberToString(size.y * multiplier)} x ${measureNumberToString(size.z * multiplier)} ${unit}`;
});

const jointTypeStr = ref('');
const jointValueStr = ref('');
watch(() => [urdfStore.robot, urdfStore.hoveredJointName, urdfStore.jointValues[urdfStore.hoveredJointName]],
    ([, hoveredJointName, jointValue]) => {
        if (hoveredJointName === null) {
            jointTypeStr.value = '';
            jointValueStr.value = '';
            return;
        }
        const _jointType = urdfStore.jointTypes[hoveredJointName];
        if (!_jointType) {
            jointTypeStr.value = '';
            jointValueStr.value = '';
            return;
        }
        jointTypeStr.value = _jointType as string;

        if (!isDraggableJoint(_jointType)) {
            jointValueStr.value = '';
            return;
        }
        jointValueStr.value = formatJointValueWithUnit(jointValue, isAngularJoint(_jointType));
    }, { immediate: true });

</script>

<template>
    <div :class="{ 'model-info-container': true, 'hidden': !showModelInfo }" :style="modelInfoStyle">
        <div :class="{ 'hidden': urdfStore.hoveredLinkName === null }">
            <h2>{{ i18n('base.link') }}</h2>
            <p><strong>{{ i18n('base.name') }}:</strong> {{ urdfStore.hoveredLinkName }}</p>
            <p><strong>{{ i18n('base.type') }}:</strong> {{ urdfStore.isHoveredLinkVisual ? 'Visual' : 'Collision' }}
            </p>
            <p :class="{ 'hidden': !shouldShowInertiaDetails || hoveredLinkMassStr === '' }">
                <strong>{{ i18n('base.mass') }}:</strong> {{ hoveredLinkMassStr }}
            </p>
            <p :class="{ 'hidden': !shouldShowInertiaDetails || hoveredLinkPrincipalInertiaStr === '' }">
                <strong>{{ i18n('base.principalInertia') }}:</strong> {{ hoveredLinkPrincipalInertiaStr }}
            </p>
            <p :class="{ 'hidden': !shouldShowInertiaDetails || hoveredLinkEquivalentBoxSizeStr === '' }">
                <strong>{{ i18n('base.equivalentBoxSize') }}:</strong> {{ hoveredLinkEquivalentBoxSizeStr }}
            </p>
        </div>
        <div :class="{ 'hidden': urdfStore.hoveredJointName === null }">
            <h2>{{ i18n('base.joint') }}</h2>
            <p><strong>{{ i18n('base.name') }}:</strong> {{ urdfStore.hoveredJointName }}</p>
            <p><strong>{{ i18n('base.type') }}:</strong> {{ jointTypeStr }}</p>
            <p :class="{ 'hidden': jointValueStr === '' }"><strong>{{ i18n('base.value') }}:</strong> {{ jointValueStr
            }}</p>
        </div>
    </div>
</template>

<style scoped>
@reference "tailwindcss";

.model-info-container {
    background-color: color-mix(in oklab, var(--color-base-300) 50%, transparent);
    position: absolute;
    color: var(--color-base-content);
    max-width: 28rem;
    padding: 5px;
    user-select: none;
    pointer-events: none;
    /* 靠中上位置 */
    transform: translate(10px, 10px);
}

h2 {
    text-align: center;
    font-size: 1.1em;
}
</style>
