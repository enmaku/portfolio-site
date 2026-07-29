import { computed } from 'vue'
import { COLONIZATION_BEGIN_STEPS } from '../../world-builder/core/colonization/colonizationBeginSteps.js'
import {
  COLONIZATION_COLLAPSE_SUBSTEPS,
  COLONIZATION_EPOCH_FINALIZE_STEPS,
  COLONIZATION_EPOCH_MAP_SUBSTEPS,
  COLONIZATION_EPOCH_PHASES,
  COLONIZATION_NETWORK_SUBSTEPS,
  COLONIZATION_POLITICS_SUBSTEPS,
  COLONIZATION_TRADE_SUBSTEPS,
} from '../../world-builder/core/colonization/colonizationEpochSteps.js'
import {
  COLONIZATION_SESSION_RESTORE_SESSION_SUBSTEPS,
  COLONIZATION_SESSION_RESTORE_STEPS,
  COLONIZATION_VISITED_REHYDRATION_SUBSTEPS,
} from '../../world-builder/core/colonization/colonizationRehydrationSteps.js'
import {
  createGenerationStepStatuses,
  createHydrologySubstepStatuses,
} from '../../world-builder/worldBuilderPageModel.js'
import {
  buildBeginStatusSection,
  buildEpochStatusSection,
  buildRehydrationStatusSection,
} from '../../world-builder/buildWorldBuilderStatusBar.js'

/**
 * @param {ReadonlyArray<{ id: string, label: string }>} substeps
 * @param {number} activeIndex
 * @param {number} completedIndex
 * @param {{ itemIndex: number, itemCount: number, phase?: string, phasePercent?: number } | null} [activeItemProgress]
 */
function createItemAwareSubstepStatuses(
  substeps,
  activeIndex,
  completedIndex,
  activeItemProgress = null,
) {
  return createHydrologySubstepStatuses(
    substeps,
    activeIndex,
    completedIndex,
    new Set(),
    activeItemProgress,
  )
}

/**
 * @param {number} itemIndex
 * @param {number} itemCount
 * @param {{ phase?: string, phasePercent?: number }} [extras]
 */
function activeItemProgressFromCounts(itemIndex, itemCount, extras = {}) {
  if (!(itemCount > 0 && itemIndex > 0)) {
    return null
  }
  return {
    itemIndex,
    itemCount,
    ...extras,
  }
}

/**
 * Colonization progress → status-bar view-model wiring.
 *
 * @param {{
 *   epochStepProgress: import('vue').Ref<import('../../world-builder/core/colonization/colonizationEpochProgress.js').EpochStepProgressState>,
 *   beginColonizationProgress: import('vue').Ref<import('../../world-builder/core/colonization/beginColonizationProgress.js').BeginColonizationProgressState>,
 *   rehydrationProgress: import('vue').Ref<import('../../world-builder/core/colonization/rehydrateColonizationProgress.js').RehydrateColonizationProgressState>,
 *   showBeginColonizationProgress: import('vue').ComputedRef<boolean>,
 *   showEpochStepProgress: import('vue').ComputedRef<boolean>,
 *   showRehydrationProgress: import('vue').ComputedRef<boolean>,
 *   getSessionRestorePending?: () => boolean,
 * }} options
 */
export function useWorldBuilderColonizationProgressStatus(options) {
  const {
    epochStepProgress,
    beginColonizationProgress,
    rehydrationProgress,
    showBeginColonizationProgress,
    showEpochStepProgress,
    showRehydrationProgress,
    getSessionRestorePending,
  } = options

  const epochStepPhaseStatuses = computed(() =>
    createGenerationStepStatuses(
      COLONIZATION_EPOCH_PHASES,
      epochStepProgress.value.activePhaseIndex,
      epochStepProgress.value.completedPhaseIndex,
    ),
  )
  const epochStepNetworkSubstepStatuses = computed(() => {
    const phase = epochStepProgress.value.networkSubstepPhase
    const phasePercent = epochStepProgress.value.networkSubstepPhasePercent
    return createItemAwareSubstepStatuses(
      COLONIZATION_NETWORK_SUBSTEPS,
      epochStepProgress.value.activeNetworkSubstepIndex,
      epochStepProgress.value.completedNetworkSubstepIndex,
      activeItemProgressFromCounts(
        epochStepProgress.value.networkSubstepItemIndex,
        epochStepProgress.value.networkSubstepItemCount,
        {
          phase: phase || undefined,
          phasePercent: phasePercent >= 0 ? phasePercent : undefined,
        },
      ),
    )
  })
  const epochStepTradeSubstepStatuses = computed(() =>
    createItemAwareSubstepStatuses(
      COLONIZATION_TRADE_SUBSTEPS,
      epochStepProgress.value.activeTradeSubstepIndex,
      epochStepProgress.value.completedTradeSubstepIndex,
      activeItemProgressFromCounts(
        epochStepProgress.value.tradeSubstepItemIndex,
        epochStepProgress.value.tradeSubstepItemCount,
      ),
    ),
  )
  const epochStepCollapseSubstepStatuses = computed(() =>
    createItemAwareSubstepStatuses(
      COLONIZATION_COLLAPSE_SUBSTEPS,
      epochStepProgress.value.activeCollapseSubstepIndex,
      epochStepProgress.value.completedCollapseSubstepIndex,
      activeItemProgressFromCounts(
        epochStepProgress.value.collapseSubstepItemIndex,
        epochStepProgress.value.collapseSubstepItemCount,
      ),
    ),
  )
  const epochStepPoliticsSubstepStatuses = computed(() =>
    createItemAwareSubstepStatuses(
      COLONIZATION_POLITICS_SUBSTEPS,
      epochStepProgress.value.activePoliticsSubstepIndex,
      epochStepProgress.value.completedPoliticsSubstepIndex,
      activeItemProgressFromCounts(
        epochStepProgress.value.politicsSubstepItemIndex,
        epochStepProgress.value.politicsSubstepItemCount,
      ),
    ),
  )
  const epochStepFinalizeStepStatuses = computed(() =>
    createGenerationStepStatuses(
      COLONIZATION_EPOCH_FINALIZE_STEPS,
      epochStepProgress.value.activeFinalizeStepIndex,
      epochStepProgress.value.completedFinalizeStepIndex,
    ),
  )
  const epochStepMapSubstepStatuses = computed(() =>
    createHydrologySubstepStatuses(
      COLONIZATION_EPOCH_MAP_SUBSTEPS,
      epochStepProgress.value.activeMapSubstepIndex,
      epochStepProgress.value.completedMapSubstepIndex,
    ),
  )
  const beginColonizationStepStatuses = computed(() =>
    createGenerationStepStatuses(
      COLONIZATION_BEGIN_STEPS,
      beginColonizationProgress.value.activeStepIndex,
      beginColonizationProgress.value.completedStepIndex,
    ),
  )
  const rehydrationStepStatuses = computed(() =>
    createGenerationStepStatuses(
      COLONIZATION_SESSION_RESTORE_STEPS,
      rehydrationProgress.value.activeStepIndex,
      rehydrationProgress.value.completedStepIndex,
    ),
  )
  const rehydrationSessionSubstepStatuses = computed(() =>
    createHydrologySubstepStatuses(
      COLONIZATION_SESSION_RESTORE_SESSION_SUBSTEPS,
      rehydrationProgress.value.activeSessionSubstepIndex,
      rehydrationProgress.value.completedSessionSubstepIndex,
    ),
  )
  const rehydrationVisitedSubstepStatuses = computed(() => {
    const {
      activeVisitedSubstepIndex,
      completedVisitedSubstepIndex,
      visitedSubstepItemIndex,
      visitedSubstepItemCount,
    } = rehydrationProgress.value
    return createItemAwareSubstepStatuses(
      COLONIZATION_VISITED_REHYDRATION_SUBSTEPS,
      activeVisitedSubstepIndex,
      completedVisitedSubstepIndex,
      activeItemProgressFromCounts(visitedSubstepItemIndex, visitedSubstepItemCount),
    )
  })
  const rehydrationCollapseSubstepStatuses = computed(() =>
    createItemAwareSubstepStatuses(
      COLONIZATION_COLLAPSE_SUBSTEPS,
      rehydrationProgress.value.activeCollapseSubstepIndex,
      rehydrationProgress.value.completedCollapseSubstepIndex,
      activeItemProgressFromCounts(
        rehydrationProgress.value.collapseSubstepItemIndex,
        rehydrationProgress.value.collapseSubstepItemCount,
      ),
    ),
  )

  /**
   * Colonization-owned status-bar section (begin > epoch > rehydration), or null when idle.
   * The page controller merges this with generation + overlays under the global priority.
   * @type {import('vue').ComputedRef<import('../../world-builder/buildWorldBuilderStatusBar.js').StatusBarViewModel | null>}
   */
  const colonizationStatusSection = computed(() => {
    if (showBeginColonizationProgress.value) {
      return buildBeginStatusSection({
        percent: beginColonizationProgress.value.percent,
        steps: beginColonizationStepStatuses.value,
      })
    }
    if (showEpochStepProgress.value) {
      return buildEpochStatusSection({
        percent: epochStepProgress.value.percent,
        phaseSteps: epochStepPhaseStatuses.value,
        finalizeSteps: epochStepFinalizeStepStatuses.value,
        networkSubsteps: epochStepNetworkSubstepStatuses.value,
        tradeSubsteps: epochStepTradeSubstepStatuses.value,
        collapseSubsteps: epochStepCollapseSubstepStatuses.value,
        politicsSubsteps: epochStepPoliticsSubstepStatuses.value,
        mapSubsteps: epochStepMapSubstepStatuses.value,
      })
    }
    const sessionRestorePending = getSessionRestorePending?.() ?? false
    if (showRehydrationProgress.value || sessionRestorePending) {
      return buildRehydrationStatusSection({
        percent: rehydrationProgress.value.percent,
        indeterminate:
          sessionRestorePending ||
          (showRehydrationProgress.value && rehydrationProgress.value.activeStepIndex < 0),
        steps: rehydrationStepStatuses.value,
        sessionSubsteps: rehydrationSessionSubstepStatuses.value,
        visitedSubsteps: rehydrationVisitedSubstepStatuses.value,
        collapseSubsteps: rehydrationCollapseSubstepStatuses.value,
      })
    }
    return null
  })

  return {
    epochStepPhaseStatuses,
    epochStepNetworkSubstepStatuses,
    epochStepTradeSubstepStatuses,
    epochStepCollapseSubstepStatuses,
    epochStepPoliticsSubstepStatuses,
    epochStepFinalizeStepStatuses,
    epochStepMapSubstepStatuses,
    beginColonizationStepStatuses,
    rehydrationStepStatuses,
    rehydrationSessionSubstepStatuses,
    rehydrationVisitedSubstepStatuses,
    rehydrationCollapseSubstepStatuses,
    colonizationStatusSection,
  }
}
