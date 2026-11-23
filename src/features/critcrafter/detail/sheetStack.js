import { computed, shallowRef } from 'vue'
import { breakdownView } from './breakdownModel.js'
import { detailView } from './featuresModel.js'

/**
 * Stack of bottom sheets (breakdown, then stacked item/feature detail). Pure state; the
 * CritcrafterSheetHost component renders `top`.
 */
export function createSheetStack() {
  const stack = shallowRef([])
  const top = computed(() => stack.value[stack.value.length - 1] ?? null)
  const canGoBack = computed(() => stack.value.length > 1)
  return {
    top,
    canGoBack,
    /** @param {{ label: string, stat: any, signed?: boolean }} target A tappable stat. */
    openBreakdown({ label, stat, signed = true }) {
      stack.value = [{ kind: 'breakdown', view: breakdownView(label, stat, { signed }) }]
    },
    /** @param {any} entry Any sheet entry (feat, action, item, spell). Stacks on what is open. */
    openDetail(entry) {
      stack.value = [...stack.value, { kind: 'detail', view: detailView(entry) }]
    },
    back() {
      stack.value = stack.value.slice(0, -1)
    },
    close() {
      stack.value = []
    },
  }
}

/** The viewer's single shared stack. Components call these; CritcrafterSheetHost renders it. */
export const sheets = createSheetStack()
export const openBreakdown = sheets.openBreakdown
export const openDetail = sheets.openDetail
