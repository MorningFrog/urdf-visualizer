import { reactive } from "vue";

export interface MouseState {
    isMouseDown: boolean;
    mouseX: number;
    mouseY: number;
}

export const mouseState = reactive<MouseState>({
    isMouseDown: false,
    mouseX: 0,
    mouseY: 0,
});
