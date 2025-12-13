<script setup lang="ts">
import ReloadIcon from '/public/icons/reload.svg';
import ExpandIcon from '/public/icons/expand.svg';
import HintIcon from '/public/icons/hint.svg';
import HintTooltip from '@/components/HintTooltip.vue';
import i18n from '@/stores/i18n';
import { visualSettings } from '@/stores/visual-settings';

</script>
<template>
    <div class="flex items-start gap-2">
        <div class="du-collapse du-collapse-arrow 
                bg-base-100/80 border border-base-300 
                w-40 has-[>_input:checked]:w-80 transition-[width] duration-300">
            <input type="checkbox" class="peer" />
            <div
                class="du-collapse-title font-semibold after:start-5 after:end-auto pe-4 ps-12 py-0 flex items-center h-10 text-base">
                <span>{{ i18n('webview.settings') }}</span>
            </div>
            <div class="du-collapse-content w-80">
                <ul class="du-list p-0">
                    <!-- 显示Visual复选框 -->
                    <label class="du-list-row my-list-row">
                        <input type="checkbox" v-model="visualSettings.showVisual"
                            class="du-checkbox du-checkbox-primary my-checkbox" />
                        <span>{{ i18n('webview.showVisual') }}</span>
                    </label>
                    <!-- 显示Collision复选框 -->
                    <label class="du-list-row my-list-row">
                        <input type="checkbox" v-model="visualSettings.showCollision"
                            class="du-checkbox du-checkbox-primary my-checkbox" />
                        <span>{{ i18n('webview.showCollision') }}</span>
                    </label>
                    <!-- 显示世界坐标系复选框 -->
                    <label class="du-list-row my-list-row">
                        <input type="checkbox" v-model="visualSettings.showWorldFrame"
                            class="du-checkbox du-checkbox-primary my-checkbox" />
                        <span>{{ i18n('webview.showWorldFrame') }}</span>
                        <hint-tooltip :hint="i18n('webview.showWorldFrameHint')" iconClass="w-4 h-4 text-info" />
                        <!-- <div class="du-tooltip">
                            <div class="du-tooltip-content">
                                {{ i18n('webview.showWorldFrameHint') }}
                            </div>
                            <HintIcon class="my-hint-icon" />
                        </div> -->
                    </label>
                </ul>
            </div>
        </div>
        <div class="du-tooltip du-tooltip-bottom" :data-tip="i18n('webview.reload.hint')">
            <button class="du-btn du-btn-outline du-btn-primary h-10">
                <ReloadIcon class="w-5 h-5 mr-2" />
                {{ i18n('webview.reload') }}
            </button>
        </div>
    </div>
</template>
<style scoped>
@reference '@/styles/main.css';

.my-list-row {
    @apply p-0;
    @apply hover:underline h-5 leading-5 mb-2;
}

.my-checkbox {
    @apply h-5 w-5;
}

.my-hint-icon {
    @apply w-4 h-4 ml-1;
    @apply text-base-content/60;
}
</style>