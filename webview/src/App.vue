<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { mouseState } from '@/stores/mouse-state';
import MainView from '@/views/MainView.vue';
import ModelInfoPanel from '@/views/ModelInfoPanel.vue';
import ControlPanel from '@/views/ControlPanel/ControlPanel.vue';
import MeasurePanel from '@/views/MeasurePanel.vue';

// 监听鼠标状态变化
onMounted(() => {
  const updateMouseState = (event: MouseEvent) => {
    mouseState.isMouseDown = event.buttons === 1;
    mouseState.mouseX = event.clientX;
    mouseState.mouseY = event.clientY;
  };
  window.addEventListener('mousedown', updateMouseState);
  window.addEventListener('mouseup', updateMouseState);
  window.addEventListener('mousemove', updateMouseState);

  onBeforeUnmount(() => {
    window.removeEventListener('mousedown', updateMouseState);
    window.removeEventListener('mouseup', updateMouseState);
    window.removeEventListener('mousemove', updateMouseState);
  });
});

</script>

<template>
  <main class="w-screen h-screen overflow-hidden relative">
    <main-view class="w-full h-full overflow-hidden" />
    <ControlPanel class="absolute top-5 left-5" />
    <measure-panel class="absolute top-5 right-5" />
    <model-info-panel />
  </main>
</template>

<style scoped>
:root {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
}

body {
  margin: 0;
  background: #f6f7fb;
  color: #111;
}
</style>
