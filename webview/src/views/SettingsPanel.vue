<script setup lang="ts">
import { ref } from 'vue';
import ReloadIcon from '/public/icons/reload.svg';
import ExpandIcon from '/public/icons/expand.svg';
import HintIcon from '/public/icons/hint.svg';
import i18n from '@/stores/i18n';
import { visualSettings } from '@/stores/visual-settings';

const open = ref(false)         // 是否勾选(展开)
const fullyOpen = ref(false)    // 是否"动画已结束的展开态"

const onChange = () => {
    // 一旦开始关闭(open=false), 立刻收回 overflow-visible
    if (!open.value) fullyOpen.value = false
    // 如果是打开: 先保持 fullyOpen=false, 等 transitionend 再置 true
}

const onTransitionEnd = (e: TransitionEvent) => {
    // 只关心宽度的过渡结束(避免其它 transition 干扰)
    if (e.propertyName !== 'width') return
    // 过渡结束时, 根据当前 open 状态决定是否 fullyOpen
    fullyOpen.value = open.value
}

</script>
<template>
    <div class="flex items-start gap-2">
        <div class="du-collapse du-collapse-arrow 
                bg-base-100/50 border border-base-300 
                text-base-content
                transition-[width] duration-300" :class="[
                    open ? 'w-60' : 'w-35',
                    fullyOpen ? 'overflow-visible' : 'overflow-hidden',
                ]" @transitionend="onTransitionEnd">
            <input type="checkbox" class="peer" v-model="open" @change="onChange" />
            <div
                class="du-collapse-title font-semibold after:start-5 after:end-auto pe-4 ps-12 py-0 flex items-center h-10 text-base">
                <span>{{ i18n('webview.settings') }}</span>
            </div>
            <div class="du-collapse-content w-60">
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
                        <div class="du-tooltip du-tooltip-top">
                            <div class="du-tooltip-content">
                                {{ i18n('webview.showWorldFrameHint') }}
                            </div>
                            <HintIcon class="my-hint-icon" />
                        </div>
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
    @apply h-4 w-4;
}

.my-hint-icon {
    @apply w-4 h-4 ml-1;
    @apply text-base-content/60;
}
</style>