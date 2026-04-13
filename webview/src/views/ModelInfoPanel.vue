<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { formatJointValueWithUnit } from '@/utils/math-tools';
import { urdfStore } from '@/stores/urdf-store';
import { mouseState } from '@/stores/mouse-state';
import { measureStore, MeasureMode } from '@/stores/measure-store';
import i18n from '@/stores/i18n';
import { isDraggableJoint, isAngularJoint } from "@/utils/joint-type";

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
@reference '@/styles/main.css';

.model-info-container {
    @apply bg-base-300/50 text-base-content;
    position: absolute;
    color: black;
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
