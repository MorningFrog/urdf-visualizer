<script setup lang="ts">
import { ref, computed, watch } from "vue";

import SettingsIcon from "/public/icons/settings.svg";
import HintIcon from "/public/icons/hint.svg";

import i18n from "@/stores/i18n";
import { visualSettings } from "@/stores/visual-settings";
import { measureSettings } from "@/stores/measure-settings";


</script>
<template>
    <div class="du-collapse du-collapse-arrow
        bg-base-100/50 border border-base-300 text-base-content 
        overflow-hidden transition-[width] duration-300 w-23 has-[>_input:checked]:w-50">
        <input type="checkbox" class="peer" />
        <div class="du-collapse-title 
            font-semibold text-base 
            after:start-5 after:end-auto pe-4 ps-12 py-0
            h-10 overflow-hidden">
            <div class="overflow-hidden w-full h-full">
                <div class="w-50! items-center flex h-full">
                    <SettingsIcon class="h-6 w-6 inline-block mr-2!" />
                    <span>{{ i18n("webview.settings.title") }}</span>
                </div>
            </div>

        </div>
        <div class="my-collapse-content du-collapse-content w-50 overflow-y-scroll pr-1 min-h-0"
            style="max-height: calc(100vh - 5rem)">
            <!-- 单位设置---------------- -->
            <!-- 标题 -->
            <div>
                <h1 class="text-center text-base justify-self-center">
                    {{ i18n("webview.settings.units") }}
                </h1>
            </div>
            <ul class="du-list p-0">
                <!-- 角度单位选择框 -->
                <label class="du-list-row my-list-row h-10!">
                    <div class="du-list-col-grow mx-0">{{ i18n("webview.settings.angleUnit") }}</div>
                    <select v-model="visualSettings.angleUnit" class="du-select my-select">
                        <option value="radian">{{ i18n("webview.settings.angleUnit.radian") }}</option>
                        <option value="degree">{{ i18n("webview.settings.angleUnit.degree") }}</option>
                    </select>
                </label>
                <!-- 长度单位选择框 -->
                <label class="du-list-row my-list-row h-10!">
                    <div class="du-list-col-grow mx-0">{{ i18n("webview.settings.lengthUnit") }}</div>
                    <select v-model="visualSettings.lengthUnit" class="du-select my-select">
                        <option value="meter">{{ i18n("webview.settings.lengthUnit.meter") }}</option>
                        <option value="centimeter">{{ i18n("webview.settings.lengthUnit.centimeter") }}</option>
                        <option value="millimeter">{{ i18n("webview.settings.lengthUnit.millimeter") }}</option>
                    </select>
                </label>
            </ul>

            <!-- 测量设置---------------- -->
            <!-- 标题 -->
            <div>
                <h1 class="text-center text-base justify-self-center">
                    {{ i18n("webview.settings.measurement.title") }}
                </h1>
            </div>
            <ul class="du-list p-0">
                <!-- 是否使用科学计数法 -->
                <label class="du-list-row my-list-row h-10!">
                    <div class="du-list-col-grow mx-0">
                        {{ i18n("webview.settings.measurement.useSciNotation") }}
                    </div>
                    <div class="w-12 flex items-center justify-center">
                        <input type="checkbox" v-model="measureSettings.useSciNotation"
                            class="du-toggle du-toggle-md" />
                    </div>
                    <VTooltip :delay="0" :distance="8">
                        <HintIcon class="my-hint-icon" />
                        <template #popper>
                            <div class="max-w-50">
                                {{ i18n("webview.settings.measurement.useSciNotation.hint") }}
                            </div>
                        </template>
                    </VTooltip>
                </label>
                <!-- 测量精度 -->
                <label class="du-list-row my-list-row h-10!">
                    <div class="du-list-col-grow">{{ i18n("webview.settings.measurement.precision") }}</div>
                    <div>
                        <input type="number" class="du-input du-validator w-12 h-8 ml-auto border-box pl-1" required
                            :title="i18n('webview.settings.measurement.precision.placeholder')" min="1" max="5"
                            v-model="measureSettings.precision" />
                        <div role="alert" class="du-alert du-alert-error du-validator-hint absolute left-0 z-20">
                            <span class="text-center">
                                ↑ {{ i18n("webview.settings.measurement.precision.validatorHint") }}</span>
                        </div>
                    </div>
                    <VTooltip :delay="0" :distance="8">
                        <HintIcon class="my-hint-icon" />
                        <template #popper>
                            <div class="max-w-50">{{ i18n("webview.settings.measurement.precision.hint") }}</div>
                        </template>
                    </VTooltip>
                </label>
                <!-- 标签尺寸 -->
                <label class="du-list-row my-list-row h-10!">
                    <div class="du-list-col-grow mx-0">
                        {{ i18n("webview.settings.measurement.labelSize") }}
                    </div>
                    <div>
                        <input type="number" class="du-input du-validator w-12 h-8 ml-auto border-box pl-1" required
                            :title="i18n('webview.settings.measurement.labelSize.placeholder')" min="1" max="30"
                            v-model="measureSettings.labelSize" />
                        <div role="alert" class="du-alert du-alert-error du-validator-hint absolute left-0 z-20">
                            <span class="text-center">
                                ↑ {{ i18n("webview.settings.measurement.labelSize.validatorHint") }}</span>
                        </div>
                    </div>
                    <VTooltip :delay="0" :distance="8">
                        <HintIcon class="my-hint-icon" />
                        <template #popper>
                            <div class="max-w-50">{{ i18n("webview.settings.measurement.labelSize.hint") }}</div>
                        </template>
                    </VTooltip>
                </label>
                <!-- 标签颜色 -->
                <label class="du-list-row my-list-row h-10!">
                    <div class="du-list-col-grow mx-0">
                        {{ i18n("webview.settings.measurement.labelColor") }}
                    </div>
                    <div class="w-10 flex items-center justify-center">
                        <color-picker v-model:pureColor="measureSettings.labelColor" shape="circle" format="rgb"
                            useType="pure" :roundHistory="true" class="border-gray-700" />
                    </div>
                    <VTooltip :delay="0" :distance="8">
                        <HintIcon class="my-hint-icon" />
                        <template #popper>
                            <div class="max-w-50">{{ i18n("webview.settings.measurement.labelColor.hint") }}</div>
                        </template>
                    </VTooltip>
                </label>
                <!-- 线颜色 -->
                <label class="du-list-row my-list-row h-10!">
                    <div class="du-list-col-grow mx-0">
                        {{ i18n("webview.settings.measurement.lineColor") }}
                    </div>
                    <div class="w-10 flex items-center justify-center">
                        <color-picker v-model:pureColor="measureSettings.lineColor" shape="circle" format="rgb"
                            useType="pure" :roundHistory="true" class="border-gray-700" />
                    </div>
                    <VTooltip :delay="0" :distance="8">
                        <HintIcon class="my-hint-icon" />
                        <template #popper>
                            <div class="max-w-50">{{ i18n("webview.settings.measurement.lineColor.hint") }}</div>
                        </template>
                    </VTooltip>
                </label>
                <!-- 线粗细 -->
                <label class="du-list-row my-list-row h-10!">
                    <div class="du-list-col-grow mx-0">
                        {{ i18n("webview.settings.measurement.lineThickness") }}
                    </div>
                    <div>
                        <input type="number" class="du-input du-validator w-12 h-8 ml-auto border-box pl-1" required
                            :title="i18n('webview.settings.measurement.lineThickness.placeholder')" min="1" max="10"
                            v-model="measureSettings.lineThickness" />
                        <div role="alert" class="du-alert du-alert-error du-validator-hint absolute left-0 z-20">
                            <span class="text-center">
                                ↑ {{ i18n("webview.settings.measurement.lineThickness.validatorHint") }}</span>
                        </div>
                    </div>
                    <VTooltip :delay="0" :distance="8">
                        <HintIcon class="my-hint-icon" />
                        <template #popper>
                            <div class="max-w-50">{{ i18n("webview.settings.measurement.lineThickness.hint") }}</div>
                        </template>
                    </VTooltip>
                </label>
                <!-- 点颜色 -->
                <label class="du-list-row my-list-row h-10!">
                    <div class="du-list-col-grow mx-0">
                        {{ i18n("webview.settings.measurement.pointColor") }}
                    </div>
                    <div class="w-10 flex items-center justify-center">
                        <color-picker v-model:pureColor="measureSettings.pointColor" shape="circle" format="rgb"
                            useType="pure" :roundHistory="true" class="border-gray-700" />
                    </div>
                    <VTooltip :delay="0" :distance="8">
                        <HintIcon class="my-hint-icon" />
                        <template #popper>
                            <div class="max-w-50">{{ i18n("webview.settings.measurement.pointColor.hint") }}</div>
                        </template>
                    </VTooltip>
                </label>
                <!-- 点大小 -->
                <label class="du-list-row my-list-row h-10!">
                    <div class="du-list-col-grow mx-0">
                        {{ i18n("webview.settings.measurement.pointSize") }}
                    </div>
                    <div>
                        <input type="number" class="du-input du-validator w-12 h-8 ml-auto border-box pl-1" required
                            :title="i18n('webview.settings.measurement.pointSize.placeholder')" min="1" max="30"
                            v-model="measureSettings.pointSize" />
                        <div role="alert" class="du-alert du-alert-error du-validator-hint absolute left-0 z-20">
                            <span class="text-center">
                                ↑ {{ i18n("webview.settings.measurement.pointSize.validatorHint") }}</span>
                        </div>
                    </div>
                    <VTooltip :delay="0" :distance="8">
                        <HintIcon class="my-hint-icon" />
                        <template #popper>
                            <div class="max-w-50">{{ i18n("webview.settings.measurement.pointSize.hint") }}</div>
                        </template>
                    </VTooltip>
                </label>
                <!-- 面颜色 -->
                <label class="du-list-row my-list-row h-10!">
                    <div class="du-list-col-grow mx-0">
                        {{ i18n("webview.settings.measurement.meshColor") }}
                    </div>
                    <div class="w-10 flex items-center justify-center">
                        <color-picker v-model:pureColor="measureSettings.surfaceColor" shape="circle" format="rgb"
                            useType="pure" :roundHistory="true" class="border-gray-700" />
                    </div>
                    <VTooltip :delay="0" :distance="8">
                        <HintIcon class="my-hint-icon" />
                        <template #popper>
                            <div class="max-w-50">{{ i18n("webview.settings.measurement.meshColor.hint") }}</div>
                        </template>
                    </VTooltip>
                </label>

                <!-- 其他设置---------------- -->
                <!-- 标题 -->
                <div>
                    <h1 class="text-center text-base justify-self-center">
                        {{ i18n("webview.settings.others") }}
                    </h1>
                </div>
                <!-- collision 颜色 -->
                <label class="du-list-row my-list-row h-10!">
                    <div class="du-list-col-grow mx-0">
                        {{ i18n("webview.settings.collisionColor") }}
                    </div>
                    <div class="w-10 flex items-center justify-center">
                        <color-picker v-model:pureColor="visualSettings.collisionColor" shape="circle" format="rgb"
                            useType="pure" :roundHistory="true" class="border-gray-700" />
                    </div>
                    <VTooltip :delay="0" :distance="8">
                        <HintIcon class="my-hint-icon" />
                        <template #popper>
                            <div class="max-w-50">{{ i18n("webview.settings.collisionColor.hint") }}</div>
                        </template>
                    </VTooltip>
                </label>
                <!-- 背景颜色 -->
                <label class="du-list-row my-list-row h-10!">
                    <div class="du-list-col-grow mx-0">
                        {{ i18n("webview.settings.backgroundColor") }}
                    </div>
                    <div class="w-10 flex items-center justify-center">
                        <color-picker v-model:pureColor="visualSettings.backgroundColor" shape="circle" format="hex"
                            useType="pure" :roundHistory="true" :disableAlpha="true" class="border-gray-700" />
                    </div>
                    <VTooltip :delay="0" :distance="8">
                        <HintIcon class="my-hint-icon" />
                        <template #popper>
                            <div class="max-w-50">{{ i18n("webview.settings.backgroundColor.hint") }}</div>
                        </template>
                    </VTooltip>
                </label>
            </ul>
        </div>
    </div>
</template>
<style scoped>
@reference '@/styles/main.css';

.my-select {
    @apply w-25 h-8 mx-0 pl-1 pr-1;
    background-position:
        calc(100% - 10px) calc(1px + 50%),
        calc(100% - 6px) calc(1px + 50%);
}
</style>
