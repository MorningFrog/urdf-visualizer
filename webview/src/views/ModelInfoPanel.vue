<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { formatJointValueWithUnit } from '@/utils/math-tools';
import { urdfStore } from '@/stores/urdf-store';
import { mouseState } from '@/stores/mouse-state';
import i18n from '@/stores/i18n';

const showModelInfo = computed(() => {
    return urdfStore.hoveredJointName !== null || urdfStore.hoveredLinkName !== null;
});

const modelInfoStyle = computed(() => ({
    left: mouseState.mouseX + 'px',
    top: mouseState.mouseY + 'px',
}))

const jointTypeStr = ref('');
const jointValueStr = ref('');
watch(() => [urdfStore.robot, urdfStore.hoveredJointName, urdfStore.jointValues.get(urdfStore.hoveredJointName)],
    ([robot, hoveredJointName, jointValue]) => {
        if (hoveredJointName === null) {
            jointTypeStr.value = '';
            jointValueStr.value = '';
            return;
        }
        const joint: URDFJoint | null = robot?.joints[hoveredJointName] || null;
        if (!joint) {
            jointTypeStr.value = '';
            jointValueStr.value = '';
            return;
        }
        switch (joint.jointType) {
            case 'revolute':
            case 'continuous':
                jointTypeStr.value = joint.jointType;
                jointValueStr.value = formatJointValueWithUnit(jointValue, true);
                break;
            case 'prismatic':
                jointTypeStr.value = joint.jointType;
                jointValueStr.value = formatJointValueWithUnit(jointValue, false);
                break;
            default:
                jointTypeStr.value = joint.jointType;
                jointValueStr.value = '';
        }
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