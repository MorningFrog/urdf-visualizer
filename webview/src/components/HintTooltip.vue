<script setup lang="ts">
/**
 * @component HintTooltip
 *
 * @description
 * 提示图标 + 悬浮提示(Teleport 到 body, 不受 overflow:hidden 影响)
 *
 * @slots
 * - default: tooltip 内容(推荐)
 *
 * @props
 * - hint?: string 兼容兜底(未提供 slot 时显示)
 * - placement?: 'top' | 'bottom' | 'left' | 'right' 方向(默认 top)
 * - offset?: number 间距(默认 8)
 * - disabled?: boolean 是否禁用(默认 false)
 * - maxWidth?: number | string 最大宽度(默认 260)
 * - interactive?: boolean tooltip 是否可交互(默认 false, 默认 pointer-events:none)
 * - iconClass?: string 传给 HintIcon 的 class(用于 w/h、颜色等)
 */

import { computed, nextTick, onBeforeUnmount, ref, watch, useSlots } from 'vue'
import HintIcon from '/public/icons/hint.svg';

type Placement = 'top' | 'bottom' | 'left' | 'right'

const props = withDefaults(
    defineProps<{
        hint?: string
        placement?: Placement
        offset?: number
        disabled?: boolean
        maxWidth?: number | string
        interactive?: boolean
        iconClass?: string
    }>(),
    {
        placement: 'top',
        offset: 8,
        disabled: false,
        maxWidth: 260,
        interactive: false,
        iconClass: 'w-4 h-4',
    }
)

const slots = useSlots()

const triggerRef = ref<HTMLElement | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)

const show = ref(false)
const resolvedPlacement = ref<Placement>(props.placement)

const position = ref({ top: 0, left: 0 })
const transform = ref('translateX(-50%)')

const tooltipId = `hint-tooltip-${Math.random().toString(36).slice(2, 10)}`

const maxWidthStyle = computed(() => {
    const v = props.maxWidth
    return typeof v === 'number' ? `${v}px` : v
})

const hasContentSlot = computed(() => !!slots.default)

function getSpaces(rect: DOMRect) {
    const vw = window.innerWidth
    const vh = window.innerHeight
    return {
        top: rect.top,
        bottom: vh - rect.bottom,
        left: rect.left,
        right: vw - rect.right,
    }
}

function choosePlacement(preferred: Placement, rect: DOMRect, tipW: number, tipH: number) {
    const margin = 8
    const needV = tipH + props.offset + margin
    const needH = tipW + props.offset + margin

    const s = getSpaces(rect)
    if (preferred === 'top' && s.top < needV) return 'bottom'
    if (preferred === 'bottom' && s.bottom < needV) return 'top'
    if (preferred === 'left' && s.left < needH) return 'right'
    if (preferred === 'right' && s.right < needH) return 'left'
    return preferred
}

function computePosition(rect: DOMRect, placement: Placement) {
    const offset = props.offset
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    let top = 0
    let left = 0
    let tf = ''

    if (placement === 'top') {
        top = rect.top - offset
        left = cx
        tf = 'translate(-50%, -100%)'
    } else if (placement === 'bottom') {
        top = rect.bottom + offset
        left = cx
        tf = 'translateX(-50%)'
    } else if (placement === 'left') {
        top = cy
        left = rect.left - offset
        tf = 'translate(-100%, -50%)'
    } else {
        top = cy
        left = rect.right + offset
        tf = 'translate(0, -50%)'
    }

    // 视口边缘约束（避免跑出屏幕）
    const margin = 8
    top = Math.min(Math.max(top, margin), window.innerHeight - margin)
    left = Math.min(Math.max(left, margin), window.innerWidth - margin)

    return { top, left, tf }
}

async function updatePosition() {
    const el = triggerRef.value
    if (!el) return

    const rect = el.getBoundingClientRect()

    // 等待 tooltip 渲染后再拿尺寸更准确
    await nextTick()

    const tipRect = tooltipRef.value?.getBoundingClientRect()
    const tipW = tipRect?.width ?? 0
    const tipH = tipRect?.height ?? 0

    const p = choosePlacement(props.placement, rect, tipW, tipH)
    resolvedPlacement.value = p

    const { top, left, tf } = computePosition(rect, p)
    position.value = { top, left }
    transform.value = tf
}

function onEnter() {
    if (props.disabled) return
    show.value = true
    updatePosition()
}

function onLeave() {
    show.value = false
}

function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onLeave()
}

const onScrollOrResize = () => {
    if (!show.value) return
    updatePosition()
}

let ro: ResizeObserver | null = null

watch(show, async (v) => {
    if (v) {
        window.addEventListener('resize', onScrollOrResize, { passive: true })
        window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true } as any)
        window.addEventListener('keydown', onKeydown)

        await nextTick()
        ro?.disconnect()
        if (tooltipRef.value) {
            ro = new ResizeObserver(() => updatePosition())
            ro.observe(tooltipRef.value)
        }
    } else {
        window.removeEventListener('resize', onScrollOrResize)
        window.removeEventListener('scroll', onScrollOrResize, true)
        window.removeEventListener('keydown', onKeydown)
        ro?.disconnect()
        ro = null
    }
})

watch(
    () => [props.placement, props.offset, props.maxWidth],
    () => {
        if (show.value) updatePosition()
    }
)

onBeforeUnmount(() => {
    window.removeEventListener('resize', onScrollOrResize)
    window.removeEventListener('scroll', onScrollOrResize, true)
    window.removeEventListener('keydown', onKeydown)
    ro?.disconnect()
})
</script>

<template>
    <span ref="triggerRef" class="inline-flex items-center align-middle" tabindex="0"
        :aria-describedby="show ? tooltipId : undefined" @mouseenter="onEnter" @mouseleave="onLeave" @focusin="onEnter"
        @focusout="onLeave">
        <HintIcon class="cursor-help" :class="props.iconClass" />
    </span>

    <Teleport to="body">
        <Transition name="hint-tooltip-fade">
            <div v-if="show" :id="tooltipId" ref="tooltipRef" role="tooltip"
                class="hint-tooltip fixed z-[9999] rounded-xl border border-base-300 bg-base-200 px-3 py-2 text-sm text-base-content shadow-lg"
                :class="props.interactive ? 'pointer-events-auto' : 'pointer-events-none'"
                :data-placement="resolvedPlacement" :style="{
                    top: position.top + 'px',
                    left: position.left + 'px',
                    transform,
                    maxWidth: maxWidthStyle,
                    whiteSpace: 'pre-line',
                }">
                <!-- 优先 slot；无 slot 时用 hint 兜底 -->
                <slot v-if="hasContentSlot" />
                <template v-else>{{ props.hint }}</template>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.hint-tooltip-fade-enter-active,
.hint-tooltip-fade-leave-active {
    transition: opacity 0.12s ease, transform 0.12s ease;
}

.hint-tooltip-fade-enter-from,
.hint-tooltip-fade-leave-to {
    opacity: 0;
}

/* 箭头(旋转方块) */
.hint-tooltip::after {
    content: '';
    position: absolute;
    width: 10px;
    height: 10px;
    background: inherit;
    transform: rotate(45deg);
}

.hint-tooltip[data-placement='top']::after {
    left: 50%;
    bottom: -5px;
    transform: translateX(-50%) rotate(45deg);
}

.hint-tooltip[data-placement='bottom']::after {
    left: 50%;
    top: -5px;
    transform: translateX(-50%) rotate(45deg);
}

.hint-tooltip[data-placement='left']::after {
    top: 50%;
    right: -5px;
    transform: translateY(-50%) rotate(45deg);
}

.hint-tooltip[data-placement='right']::after {
    top: 50%;
    left: -5px;
    transform: translateY(-50%) rotate(45deg);
}
</style>
