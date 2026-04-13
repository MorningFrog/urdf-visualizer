<script setup lang="ts">
import { measureStore, MeasureMode } from '@/stores/measure-store';
import moduleMeasure from '@/modules/module-measure.vue';
import MeasureCoordinatesIcon from '/public/icons/measure-coordinates.svg';
import MeasureDistanceIcon from '/public/icons/measure-distance.svg';
import MeasureAngleIcon from '/public/icons/measure-angle.svg';
import MeasureAreaIcon from '/public/icons/measure-area.svg';
import CancelIcon from '/public/icons/cancel.svg';

function toggleMeasureMode(mode: MeasureMode) {
    if (measureStore.mode === mode) {
        measureStore.mode = MeasureMode.None;
        return;
    }
    measureStore.mode = mode;
}
function cancleMeasurement() {
    measureStore.mode = MeasureMode.None;
}

const measureButtonIcons = {
    [MeasureMode.Coordinates]: MeasureCoordinatesIcon,
    [MeasureMode.Distance]: MeasureDistanceIcon,
    [MeasureMode.Angle]: MeasureAngleIcon,
    [MeasureMode.Area]: MeasureAreaIcon,
};
const measureButtonClasses = {
    [MeasureMode.Coordinates]: 'w-5.5 h-5.5',
    [MeasureMode.Distance]: 'w-6 h-6',
    [MeasureMode.Angle]: 'w-5 h-5',
    [MeasureMode.Area]: 'w-5 h-5',
};

</script>
<template>
    <div>
        <div class="bg-base-300/50 p-2 rounded-full flex flex-col gap-2">
            <button class="du-btn du-btn-circle du-btn-sm du-btn-ghost du-btn-primary"
                v-for="mode in [MeasureMode.Coordinates, MeasureMode.Distance, MeasureMode.Angle, MeasureMode.Area]"
                :key="mode" @click="toggleMeasureMode(mode)" :class="{ 'du-btn-active': measureStore.mode === mode }">
                <component :is="measureButtonIcons[mode]" :class="measureButtonClasses[mode]" />
            </button>
            <div class="du-divider"></div>
            <button class="du-btn du-btn-circle du-btn-sm du-btn-ghost du-btn-warning" @click="cancleMeasurement">
                <CancelIcon class="w-5 h-5" />
            </button>
        </div>
        <module-measure></module-measure>
    </div>
</template>