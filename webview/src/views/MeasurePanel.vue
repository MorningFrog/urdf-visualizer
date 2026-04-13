<script setup lang="ts">
import {
    measureStore,
    MeasureMode,
} from '@/stores/measure-store';
import i18n from "@/stores/i18n";
import ModuleMeasure from '@/modules/module-measure.vue';
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
function cancelMeasurement() {
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
const measureButtonTooltips = {
    [MeasureMode.Coordinates]: i18n("webview.measure.coordinates.hint"),
    [MeasureMode.Distance]: i18n("webview.measure.distance.hint"),
    [MeasureMode.Angle]: i18n("webview.measure.angle.hint"),
    [MeasureMode.Area]: i18n("webview.measure.area.hint"),
};

</script>
<template>
    <div>
        <div class="bg-base-300/50 p-2 rounded-full flex flex-col gap-2">
            <VTooltip class="pointer-events-auto"
                v-for="mode in [MeasureMode.Coordinates, MeasureMode.Distance, MeasureMode.Angle, MeasureMode.Area]"
                :key="mode" placement="left" :delay="0" :distance="8">
                <button class="du-btn du-btn-circle du-btn-sm du-btn-ghost du-btn-primary"
                    @click="toggleMeasureMode(mode)" :class="{ 'du-btn-active': measureStore.mode === mode }">
                    <component :is="measureButtonIcons[mode]" :class="measureButtonClasses[mode]" />
                </button>
                <template #popper>
                    {{ measureButtonTooltips[mode] }}
                </template>
            </VTooltip>
            <div class="du-divider"></div>
            <VTooltip class="pointer-events-auto" placement="left" :delay="0" :distance="8">
                <button class="du-btn du-btn-circle du-btn-sm du-btn-ghost du-btn-warning" @click="cancelMeasurement">
                    <CancelIcon class="w-5 h-5" />
                </button>
                <template #popper>
                    {{ i18n("webview.measure.cancel.hint") }}
                </template>
            </VTooltip>
        </div>
        <ModuleMeasure></ModuleMeasure>
    </div>
</template>
