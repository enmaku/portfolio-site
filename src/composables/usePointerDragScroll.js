import { ref, unref } from 'vue'
import {
  createPointerDragScrollController,
  filterMousePrimaryButton,
} from './pointerDragScrollController.js'

/**
 * @param {{
 *   scrollElRef: import('vue').Ref<{ scrollTop: number, scrollLeft: number } | null>
 *   axis?: 'y' | 'both'
 *   thresholdPx?: number
 *   scrollBeforeThreshold?: boolean
 *   shouldBegin?: (event: { pointerType?: string, button?: number }) => boolean
 * }} options
 */
export function usePointerDragScroll(options) {
  const dragActive = ref(false)

  const controller = createPointerDragScrollController({
    getScrollEl: () => unref(options.scrollElRef),
    axis: options.axis,
    thresholdPx: options.thresholdPx,
    scrollBeforeThreshold: options.scrollBeforeThreshold,
    shouldBegin: options.shouldBegin,
    onActiveChange: (active) => {
      dragActive.value = active
    },
  })

  return {
    dragActive,
    handlers: controller,
    filterMousePrimaryButton,
  }
}
