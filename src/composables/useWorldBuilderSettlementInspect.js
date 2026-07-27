import { computed, ref } from 'vue'
import { livingSettlements } from '../../world-builder/core/colonization/expeditions/expeditionConstants.js'
import { COLONIZATION_PHASE_RUNNING } from '../../world-builder/core/colonization/createDefaultColonizationSlice.js'
import { buildSettlementEconomyInspect } from '../../world-builder/core/economy/settlementEconomyInspect.js'

/**
 * Settlement hover / focus / trade tooltip for the colonization map.
 *
 * @param {{
 *   getViewport?: () => {
 *     setSettlementFocusMarker?: (marker: { x: number, y: number } | null) => void,
 *     onSettlementFocusClear?: (handler: (() => void) | null) => void,
 *     onSettlementHover?: (
 *       handler: ((payload: { settlementId: string, clientX: number, clientY: number } | null) => void) | null,
 *     ) => void,
 *   } | null,
 *   slice: import('vue').Ref<import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice>,
 *   getGeographyDocument?: () => import('../../world-builder/core/types.js').WorldDocument | null,
 * }} options
 */
export function useWorldBuilderSettlementInspect(options) {
  const { getViewport, slice, getGeographyDocument } = options

  /** @type {import('vue').Ref<string | null>} */
  const hoveredSettlementId = ref(null)
  /** @type {import('vue').Ref<{ x: number, y: number } | null>} */
  const hoveredSettlementScreenPosition = ref(null)
  /** @type {import('vue').Ref<string | null>} */
  const focusedSettlementId = ref(null)
  /** @type {import('vue').Ref<string | null>} */
  const focusedExtremeKey = ref(null)

  function clearSettlementHover() {
    hoveredSettlementId.value = null
    hoveredSettlementScreenPosition.value = null
  }

  function clearSettlementFocus() {
    focusedSettlementId.value = null
    focusedExtremeKey.value = null
    syncSettlementFocusMarker()
  }

  function syncSettlementFocusMarker() {
    const viewport = getViewport?.()
    if (!viewport?.setSettlementFocusMarker) {
      return
    }
    const id = focusedSettlementId.value
    if (!id || slice.value.colonizationPhase !== COLONIZATION_PHASE_RUNNING) {
      viewport.setSettlementFocusMarker(null)
      return
    }
    const settlement = livingSettlements(slice.value.settlements ?? []).find(
      (entry) => entry.id === id,
    )
    if (!settlement || !Number.isFinite(settlement.x) || !Number.isFinite(settlement.y)) {
      focusedSettlementId.value = null
      focusedExtremeKey.value = null
      viewport.setSettlementFocusMarker(null)
      return
    }
    viewport.setSettlementFocusMarker({ x: settlement.x, y: settlement.y })
  }

  /**
   * Toggle or move settlement focus from a sidebar extreme control.
   * Clears only when the same extreme key is activated again (not when another
   * extreme happens to name the same settlement).
   *
   * @param {{ settlementId?: string | null, focusKey?: string | null } | string | null | undefined} target
   */
  function setSettlementFocus(target) {
    if (slice.value.colonizationPhase !== COLONIZATION_PHASE_RUNNING) {
      return
    }
    const settlementId =
      typeof target === 'string'
        ? target
        : target && typeof target === 'object'
          ? target.settlementId
          : null
    const focusKey =
      typeof target === 'string'
        ? settlementId
        : target && typeof target === 'object'
          ? target.focusKey ?? settlementId
          : null
    if (!settlementId || !focusKey) {
      clearSettlementFocus()
      return
    }
    if (focusedExtremeKey.value === focusKey) {
      clearSettlementFocus()
      return
    }
    focusedSettlementId.value = settlementId
    focusedExtremeKey.value = focusKey
    syncSettlementFocusMarker()
  }

  /**
   * @param {{
   *   onSettlementHover?: (
   *     handler: ((payload: { settlementId: string, clientX: number, clientY: number } | null) => void) | null,
   *   ) => void,
   * } | null | undefined} viewport
   */
  function wireSettlementHover(viewport) {
    viewport?.onSettlementHover?.((payload) => {
      if (!payload?.settlementId) {
        clearSettlementHover()
        return
      }
      hoveredSettlementId.value = payload.settlementId
      hoveredSettlementScreenPosition.value = {
        x: payload.clientX,
        y: payload.clientY,
      }
    })
  }

  /**
   * @param {{
   *   onSettlementFocusClear?: (handler: (() => void) | null) => void,
   * } | null | undefined} viewport
   * @param {{ placementEnabled: boolean }} options
   */
  function wireSettlementFocusClear(viewport, { placementEnabled }) {
    if (placementEnabled) {
      viewport?.onSettlementFocusClear?.(null)
      clearSettlementFocus()
      return
    }
    viewport?.onSettlementFocusClear?.(() => {
      clearSettlementFocus()
    })
  }

  const settlementTradeTooltip = computed(() => {
    const id = hoveredSettlementId.value
    if (!id) {
      return null
    }
    const geography = getGeographyDocument?.() ?? null
    return buildSettlementEconomyInspect(
      {
        settlements: slice.value.settlements,
        tradeAccounts: slice.value.tradeAccounts,
        lastTradeEpochResult: slice.value.lastTradeEpochResult,
        externalTradeAccounts: slice.value.externalTradeAccounts,
        saltNodes: geography?.saltNodes,
        metalNodes: geography?.metalNodes,
      },
      id,
    )
  })

  return {
    hoveredSettlementId,
    hoveredSettlementScreenPosition,
    focusedSettlementId,
    focusedExtremeKey,
    settlementTradeTooltip,
    clearSettlementHover,
    clearSettlementFocus,
    syncSettlementFocusMarker,
    setSettlementFocus,
    wireSettlementHover,
    wireSettlementFocusClear,
  }
}
