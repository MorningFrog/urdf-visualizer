<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import i18n from '@/stores/i18n';
import HintIcon from '/public/icons/hint.svg';
import { urdfStore, setJointValue } from '@/stores/urdf-store';
import { JointType, isDraggableJoint, isAngularJoint } from "@/utils/joint-type";
import { jointValueToString } from '@/utils/math-tools';

function jointTypeBadgeClass(_jointType: JointType) {
  switch (_jointType) {
    case JointType.CONTINUOUS:
      return 'du-badge du-badge-sm du-badge-outline du-badge-primary'
    case JointType.REVOLUTE:
      return 'du-badge du-badge-sm du-badge-dash du-badge-primary';
    case JointType.PRISMATIC:
      return 'du-badge du-badge-sm du-badge-dash du-badge-secondary';
    case JointType.FLOATING:
    case JointType.PLANAR:
      return 'du-badge du-badge-sm du-badge-outline du-badge-accent';
    default:
      return '';
  }
}

// Create computed models for all joints for v-model compatibility
const jointValueModels = ref<Record<string, typeof computed<number>>>({});
watch(() => urdfStore.jointTypes, (newJointTypes) => {
  const models: Record<string, typeof computed<number>> = {};
  for (const joint_name in newJointTypes) {
    models[joint_name] = computed<number>({
      get: () => urdfStore.jointValues[joint_name] ?? 0,
      set: (val) => setJointValue(joint_name, val),
    });
  }
  jointValueModels.value = models;
}, { immediate: true });

const onRandomizeJointsClick = () => {
  for (const [joint_name, joint_type] of Object.entries(urdfStore.jointTypes)) {
    if (!isDraggableJoint(joint_type)) continue;
    const min = urdfStore.jointLimitMin[joint_name]!;
    const max = urdfStore.jointLimitMax[joint_name]!;
    const randomValue = Math.random() * (max - min) + min;
    setJointValue(joint_name, randomValue);
  }
};

const onResetJointsClick = () => {
  for (const [joint_name, joint_type] of Object.entries(urdfStore.jointTypes)) {
    if (!isDraggableJoint(joint_type)) continue;
    urdfStore.jointValues[joint_name] = 0.0;
    urdfStore.robot?.joints[joint_name]?.setJointValue(0.0);
  }
};
</script>
<template>
  <div>
    <!-- Joint列表标题 -->
    <div class="title-bar z-20 relative pointer-events-none">
      <div></div>
      <h1 class="pointer-events-auto">{{ i18n("webview.control.jointList") }}</h1>
      <div class="justify-self-end pointer-events-auto">
        <VTooltip :delay="0" :distance="8">
          <HintIcon class="my-hint-icon" />
          <template #popper>
            <div class="max-w-50">{{ i18n("webview.control.jointList.hint") }}</div>
          </template>
        </VTooltip>
      </div>
    </div>
    <div class="du-collapse du-collapse-arrow bg-transparent -mt-7.5! z-10 relative">
      <input type="checkbox" class="peer" checked />
      <div class="du-collapse-title font-semibold after:start-2 after:end-auto pe-4 ps-16 py-0"></div>
      <div class="du-collapse-content w-full p-0">
        <!-- Joint操作 -->
        <div class="flex justify-between">
          <VTooltip :delay="0" :distance="8">
            <button @click="onRandomizeJointsClick" class="du-btn du-btn-ghost du-btn-sm px-1 py-0.5">
              {{ i18n("webview.control.randomizeJoints") }}
            </button>
            <template #popper>
              <div class="max-w-50">{{ i18n("webview.control.randomizeJoints.hint") }}</div>
            </template>
          </VTooltip>
          <VTooltip :delay="0" :distance="8">
            <button @click="onResetJointsClick" class="du-btn du-btn-ghost du-btn-sm px-1 py-0.5">
              {{ i18n("webview.control.resetJoints") }}
            </button>
            <template #popper>
              <div class="max-w-50">{{ i18n("webview.control.resetJoints.hint") }}</div>
            </template>
          </VTooltip>
        </div>

        <!-- Joint列表内容 -->
        <ul class="p-0 w-full">
          <li v-for="[joint_name, joint_type] of Object.entries(urdfStore.jointTypes)" :key="joint_name"
            class="w-full my-2!">
            <!-- Joint名称和类型 -->
            <div class="flex justify-between w-full">
              <span>{{ joint_name }}</span>
              <div :class="jointTypeBadgeClass(joint_type)">{{ joint_type }}</div>
            </div>
            <!-- 可拖动Joint的值调节滑块 -->
            <div v-if="isDraggableJoint(joint_type)" class="w-full -mt-1!">
              <!-- 滑块 -->
              <input type="range" :min="urdfStore.jointLimitMin[joint_name]!"
                :max="urdfStore.jointLimitMax[joint_name]!" step="0.001" v-model="jointValueModels[joint_name]"
                @dblclick="jointValueModels[joint_name] = 0.0"
                class="du-range du-range-xs du-range-primary [--du-range-fill:0]"
                @mouseenter="urdfStore.hoveredJointName = joint_name" @mouseleave="urdfStore.hoveredJointName = null"
                :class="urdfStore.hoveredJointName === joint_name
                  ? '[--du-range-thumb:blue]'
                  : ''
                  " />
              <!-- 刻度条 -->
              <div class="px-2 -mt-1! text-[8px] h-2.5">
                <div class="relative w-full">
                  <span class="absolute left-0 -translate-x-1/2">|</span>
                  <span class="absolute -translate-x-1/2" :style="{
                    left:
                      `${Math.max(0, Math.min(1, (0.0 - urdfStore.jointLimitMin[joint_name]!) / (urdfStore.jointLimitMax[joint_name]! - urdfStore.jointLimitMin[joint_name]!)))
                      * 100}%`
                  }">
                    |
                  </span>
                  <span class="absolute right-0 translate-x-1/2">|</span>
                </div>
              </div>
              <!-- 边界数字和当前关节值数字 -->
              <div class="px-2 text-xs h-4">
                <div class="relative w-full" data-clamp-container>
                  <span class="absolute -left-1">
                    {{ jointValueToString(urdfStore.jointLimitMin[joint_name]!,
                      isAngularJoint(joint_type)) }}
                  </span>
                  <span class="absolute -right-1">
                    {{ jointValueToString(urdfStore.jointLimitMax[joint_name]!,
                      isAngularJoint(joint_type)) }}
                  </span>
                  <span class="absolute -translate-x-1/2 du-badge du-badge-info du-badge-sm" v-clamp-center-x="{
                    anchor: () => ({
                      percent: Math.max(0, Math.min(1, (urdfStore.jointValues[joint_name]! - urdfStore.jointLimitMin[joint_name]!) / (urdfStore.jointLimitMax[joint_name]! - urdfStore.jointLimitMin[joint_name]!)))
                    }),
                    padding: -8
                  }">
                    {{ jointValueToString(urdfStore.jointValues[joint_name]!,
                      isAngularJoint(joint_type)) }}
                  </span>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
