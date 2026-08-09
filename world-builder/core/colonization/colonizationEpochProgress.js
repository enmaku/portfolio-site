import {
  COLONIZATION_COLLAPSE_SUBSTEPS,
  COLONIZATION_EPOCH_FINALIZE_STEPS,
  COLONIZATION_EPOCH_FINALIZE_STEP_COUNT,
  COLONIZATION_EPOCH_MAP_SUBSTEPS,
  COLONIZATION_EPOCH_PHASE_COUNT,
  COLONIZATION_EPOCH_PHASES,
  COLONIZATION_NETWORK_SUBSTEPS,
  COLONIZATION_POLITICS_SUBSTEPS,
  COLONIZATION_TRADE_SUBSTEPS,
} from './colonizationEpochSteps.js'

/**
 * @typedef {Object} EpochStepProgressState
 * @property {number} percent
 * @property {number} activeEpochIndex
 * @property {number} completedEpochIndex
 * @property {number} activePhaseIndex
 * @property {number} completedPhaseIndex
 * @property {string} label
 * @property {number} activeNetworkSubstepIndex
 * @property {number} completedNetworkSubstepIndex
 * @property {number} networkSubstepItemIndex one-based item within active network substep; -1 when idle
 * @property {number} networkSubstepItemCount total items in active network substep loop; 0 when idle
 * @property {string} networkSubstepPhase optional in-item phase label (e.g. Land)
 * @property {number} networkSubstepPhasePercent optional 0-100 progress within the phase
 * @property {number} activeCollapseSubstepIndex
 * @property {number} completedCollapseSubstepIndex
 * @property {number} collapseSubstepItemIndex one-based item within active collapse substep; -1 when idle
 * @property {number} collapseSubstepItemCount total items in active collapse substep loop; 0 when idle
 * @property {number} activeTradeSubstepIndex
 * @property {number} completedTradeSubstepIndex
 * @property {number} tradeSubstepItemIndex one-based item within active trade substep; -1 when idle
 * @property {number} tradeSubstepItemCount total items in active trade substep loop; 0 when idle
 * @property {number} activePoliticsSubstepIndex
 * @property {number} completedPoliticsSubstepIndex
 * @property {number} politicsSubstepItemIndex one-based item within active politics substep; -1 when idle
 * @property {number} politicsSubstepItemCount total items in active politics substep loop; 0 when idle
 * @property {number} activeFinalizeStepIndex
 * @property {number} completedFinalizeStepIndex
 * @property {number} activeMapSubstepIndex
 * @property {number} completedMapSubstepIndex
 */

/**
 * @returns {EpochStepProgressState}
 */
export function createInitialEpochStepProgress() {
  return {
    percent: 0,
    activeEpochIndex: -1,
    completedEpochIndex: -1,
    activePhaseIndex: -1,
    completedPhaseIndex: -1,
    label: '',
    activeNetworkSubstepIndex: -1,
    completedNetworkSubstepIndex: -1,
    networkSubstepItemIndex: -1,
    networkSubstepItemCount: 0,
    networkSubstepPhase: '',
    networkSubstepPhasePercent: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
    collapseSubstepItemIndex: -1,
    collapseSubstepItemCount: 0,
    activeTradeSubstepIndex: -1,
    completedTradeSubstepIndex: -1,
    tradeSubstepItemIndex: -1,
    tradeSubstepItemCount: 0,
    activePoliticsSubstepIndex: -1,
    completedPoliticsSubstepIndex: -1,
    politicsSubstepItemIndex: -1,
    politicsSubstepItemCount: 0,
    activeFinalizeStepIndex: -1,
    completedFinalizeStepIndex: -1,
    activeMapSubstepIndex: -1,
    completedMapSubstepIndex: -1,
  }
}

/**
 * @param {number} unitIndex zero-based completed-or-active unit across phases + finalize
 * @param {number} unitCount phaseCount + finalizeStepCount
 * @returns {number}
 */
export function epochStepProgressValue(unitIndex, unitCount) {
  if (unitCount <= 0) return 0
  return Math.round(((unitIndex + 1) / unitCount) * 100)
}

/**
 * @param {number} phaseIndex
 * @returns {number}
 */
export function epochStepUnitIndex(phaseIndex) {
  return phaseIndex
}

/**
 * @returns {number}
 */
export function epochStepUnitCount() {
  return COLONIZATION_EPOCH_PHASE_COUNT + COLONIZATION_EPOCH_FINALIZE_STEP_COUNT
}

/**
 * @param {number} finalizeStepIndex
 * @returns {number}
 */
export function epochStepFinalizeUnitIndex(finalizeStepIndex) {
  return COLONIZATION_EPOCH_PHASE_COUNT + finalizeStepIndex
}

/**
 * @param {number} simulationEpoch slice epoch before the step runs
 * @returns {string}
 */
export function epochStepEpochLabel(simulationEpoch) {
  return `Epoch ${simulationEpoch + 1}`
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ simulationEpoch: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnEpochStart(progress, payload) {
  return {
    ...progress,
    activeEpochIndex: 0,
    completedEpochIndex: progress.completedEpochIndex,
    activePhaseIndex: -1,
    completedPhaseIndex: -1,
    label: epochStepEpochLabel(payload.simulationEpoch),
    activeNetworkSubstepIndex: -1,
    completedNetworkSubstepIndex: -1,
    networkSubstepItemIndex: -1,
    networkSubstepItemCount: 0,
    networkSubstepPhase: '',
    networkSubstepPhasePercent: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
    collapseSubstepItemIndex: -1,
    collapseSubstepItemCount: 0,
    activeTradeSubstepIndex: -1,
    completedTradeSubstepIndex: -1,
    tradeSubstepItemIndex: -1,
    tradeSubstepItemCount: 0,
    activePoliticsSubstepIndex: -1,
    completedPoliticsSubstepIndex: -1,
    politicsSubstepItemIndex: -1,
    politicsSubstepItemCount: 0,
    activeFinalizeStepIndex: -1,
    completedFinalizeStepIndex: -1,
    activeMapSubstepIndex: -1,
    completedMapSubstepIndex: -1,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ simulationEpoch: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnEpochComplete(progress, payload) {
  const unitCount = epochStepUnitCount()
  const unitIndex = epochStepUnitIndex(COLONIZATION_EPOCH_PHASE_COUNT - 1)
  return {
    ...progress,
    percent: epochStepProgressValue(unitIndex, unitCount),
    activeEpochIndex: 0,
    completedEpochIndex: 0,
    activePhaseIndex: -1,
    completedPhaseIndex: COLONIZATION_EPOCH_PHASE_COUNT - 1,
    label: epochStepEpochLabel(payload.simulationEpoch),
    activeNetworkSubstepIndex: -1,
    completedNetworkSubstepIndex: -1,
    networkSubstepItemIndex: -1,
    networkSubstepItemCount: 0,
    networkSubstepPhase: '',
    networkSubstepPhasePercent: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
    collapseSubstepItemIndex: -1,
    collapseSubstepItemCount: 0,
    activeTradeSubstepIndex: -1,
    completedTradeSubstepIndex: -1,
    tradeSubstepItemIndex: -1,
    tradeSubstepItemCount: 0,
    activePoliticsSubstepIndex: -1,
    completedPoliticsSubstepIndex: -1,
    politicsSubstepItemIndex: -1,
    politicsSubstepItemCount: 0,
    activeFinalizeStepIndex: -1,
    completedFinalizeStepIndex: -1,
    activeMapSubstepIndex: -1,
    completedMapSubstepIndex: -1,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ simulationEpoch: number, phaseIndex: number, phaseId: string }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnPhaseStart(progress, payload) {
  const phase = COLONIZATION_EPOCH_PHASES[payload.phaseIndex]
  const unitCount = epochStepUnitCount()
  const unitIndex = epochStepUnitIndex(payload.phaseIndex)
  return {
    ...progress,
    percent: epochStepProgressValue(unitIndex, unitCount),
    activeEpochIndex: 0,
    activePhaseIndex: payload.phaseIndex,
    label: `${epochStepEpochLabel(payload.simulationEpoch)} · ${phase?.label ?? payload.phaseId}`,
    activeNetworkSubstepIndex: payload.phaseId === 'network' ? -1 : progress.activeNetworkSubstepIndex,
    completedNetworkSubstepIndex:
      payload.phaseId === 'network' ? -1 : progress.completedNetworkSubstepIndex,
    activeCollapseSubstepIndex:
      payload.phaseId === 'collapse' ? -1 : progress.activeCollapseSubstepIndex,
    completedCollapseSubstepIndex:
      payload.phaseId === 'collapse' ? -1 : progress.completedCollapseSubstepIndex,
    collapseSubstepItemIndex:
      payload.phaseId === 'collapse' ? -1 : progress.collapseSubstepItemIndex,
    collapseSubstepItemCount:
      payload.phaseId === 'collapse' ? 0 : progress.collapseSubstepItemCount,
    activeTradeSubstepIndex: payload.phaseId === 'trade' ? -1 : progress.activeTradeSubstepIndex,
    completedTradeSubstepIndex:
      payload.phaseId === 'trade' ? -1 : progress.completedTradeSubstepIndex,
    tradeSubstepItemIndex: payload.phaseId === 'trade' ? -1 : progress.tradeSubstepItemIndex,
    tradeSubstepItemCount: payload.phaseId === 'trade' ? 0 : progress.tradeSubstepItemCount,
    activePoliticsSubstepIndex:
      payload.phaseId === 'politics' ? -1 : progress.activePoliticsSubstepIndex,
    completedPoliticsSubstepIndex:
      payload.phaseId === 'politics' ? -1 : progress.completedPoliticsSubstepIndex,
    politicsSubstepItemIndex:
      payload.phaseId === 'politics' ? -1 : progress.politicsSubstepItemIndex,
    politicsSubstepItemCount:
      payload.phaseId === 'politics' ? 0 : progress.politicsSubstepItemCount,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ phaseIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnPhaseComplete(progress, payload) {
  const unitCount = epochStepUnitCount()
  const unitIndex = epochStepUnitIndex(payload.phaseIndex)
  return {
    ...progress,
    percent: epochStepProgressValue(unitIndex, unitCount),
    activeEpochIndex: 0,
    activePhaseIndex: payload.phaseIndex,
    completedPhaseIndex: payload.phaseIndex,
    activeNetworkSubstepIndex: -1,
    completedNetworkSubstepIndex: -1,
    networkSubstepItemIndex: -1,
    networkSubstepItemCount: 0,
    networkSubstepPhase: '',
    networkSubstepPhasePercent: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
    collapseSubstepItemIndex: -1,
    collapseSubstepItemCount: 0,
    activeTradeSubstepIndex: -1,
    completedTradeSubstepIndex: -1,
    tradeSubstepItemIndex: -1,
    tradeSubstepItemCount: 0,
    activePoliticsSubstepIndex: -1,
    completedPoliticsSubstepIndex: -1,
    politicsSubstepItemIndex: -1,
    politicsSubstepItemCount: 0,
  }
}

/**
 * @param {string} substepLabel
 * @param {{ itemIndex: number, itemCount: number, phase?: string, phasePercent?: number }} itemProgress
 * @returns {string}
 */
export function formatSubstepItemLabel(substepLabel, itemProgress) {
  if (itemProgress.itemCount <= 0 || itemProgress.itemIndex <= 0) {
    return substepLabel
  }
  let label = `${substepLabel} ${itemProgress.itemIndex}/${itemProgress.itemCount}`
  if (
    itemProgress.phase &&
    Number.isFinite(itemProgress.phasePercent) &&
    itemProgress.phasePercent >= 0
  ) {
    label += ` - ${itemProgress.phase} ${itemProgress.phasePercent}%`
  }
  return label
}

export const formatNetworkSubstepItemLabel = formatSubstepItemLabel
export const formatCollapseSubstepItemLabel = formatSubstepItemLabel
export const formatTradeSubstepItemLabel = formatSubstepItemLabel
export const formatPoliticsSubstepItemLabel = formatSubstepItemLabel

/**
 * @param {{
 *   phaseLabel: string,
 *   substeps: ReadonlyArray<{ id: string, label: string }>,
 *   activeKey: keyof EpochStepProgressState,
 *   completedKey: keyof EpochStepProgressState,
 *   itemIndexKey: keyof EpochStepProgressState,
 *   itemCountKey: keyof EpochStepProgressState,
 *   clearExtras?: () => Partial<EpochStepProgressState>,
 *   itemExtras?: (payload: {
 *     substepIndex: number,
 *     itemIndex: number,
 *     itemCount: number,
 *     phase?: string,
 *     phasePercent?: number,
 *   }) => Partial<EpochStepProgressState>,
 * }} config
 */
function createSubstepLaneReducers(config) {
  const {
    phaseLabel,
    substeps,
    activeKey,
    completedKey,
    itemIndexKey,
    itemCountKey,
    clearExtras,
    itemExtras,
  } = config

  /**
   * @param {EpochStepProgressState} progress
   * @param {{ substepIndex: number }} payload
   * @returns {EpochStepProgressState}
   */
  function onStart(progress, payload) {
    const substep = substeps[payload.substepIndex]
    return {
      ...progress,
      [activeKey]: payload.substepIndex,
      [itemIndexKey]: -1,
      [itemCountKey]: 0,
      ...(clearExtras?.() ?? {}),
      label: progress.label.includes('·')
        ? `${progress.label.split(' · ')[0]} · ${phaseLabel} · ${substep?.label ?? ''}`
        : progress.label,
    }
  }

  /**
   * @param {EpochStepProgressState} progress
   * @param {{ substepIndex: number }} payload
   * @returns {EpochStepProgressState}
   */
  function onComplete(progress, payload) {
    return {
      ...progress,
      [activeKey]: payload.substepIndex,
      [completedKey]: payload.substepIndex,
      [itemIndexKey]: -1,
      [itemCountKey]: 0,
      ...(clearExtras?.() ?? {}),
    }
  }

  /**
   * @param {EpochStepProgressState} progress
   * @param {{
   *   substepIndex: number,
   *   itemIndex: number,
   *   itemCount: number,
   *   phase?: string,
   *   phasePercent?: number,
   * }} payload
   * @returns {EpochStepProgressState}
   */
  function onItem(progress, payload) {
    const substep = substeps[payload.substepIndex]
    const epochLabel = progress.label.includes('·') ? progress.label.split(' · ')[0] : progress.label
    const itemLabel = formatSubstepItemLabel(substep?.label ?? '', {
      itemIndex: payload.itemIndex,
      itemCount: payload.itemCount,
      phase: payload.phase,
      phasePercent: payload.phasePercent,
    })
    return {
      ...progress,
      [activeKey]: payload.substepIndex,
      [itemIndexKey]: payload.itemIndex,
      [itemCountKey]: payload.itemCount,
      ...(itemExtras?.(payload) ?? {}),
      label: `${epochLabel} · ${phaseLabel} · ${itemLabel}`,
    }
  }

  return { onStart, onComplete, onItem }
}

const networkLane = createSubstepLaneReducers({
  phaseLabel: 'Network',
  substeps: COLONIZATION_NETWORK_SUBSTEPS,
  activeKey: 'activeNetworkSubstepIndex',
  completedKey: 'completedNetworkSubstepIndex',
  itemIndexKey: 'networkSubstepItemIndex',
  itemCountKey: 'networkSubstepItemCount',
  clearExtras: () => ({
    networkSubstepPhase: '',
    networkSubstepPhasePercent: -1,
  }),
  itemExtras: (payload) => ({
    networkSubstepPhase: payload.phase ?? '',
    networkSubstepPhasePercent:
      Number.isFinite(payload.phasePercent) && payload.phasePercent >= 0
        ? payload.phasePercent
        : -1,
  }),
})

const collapseLane = createSubstepLaneReducers({
  phaseLabel: 'Collapse',
  substeps: COLONIZATION_COLLAPSE_SUBSTEPS,
  activeKey: 'activeCollapseSubstepIndex',
  completedKey: 'completedCollapseSubstepIndex',
  itemIndexKey: 'collapseSubstepItemIndex',
  itemCountKey: 'collapseSubstepItemCount',
})

const tradeLane = createSubstepLaneReducers({
  phaseLabel: 'Trade',
  substeps: COLONIZATION_TRADE_SUBSTEPS,
  activeKey: 'activeTradeSubstepIndex',
  completedKey: 'completedTradeSubstepIndex',
  itemIndexKey: 'tradeSubstepItemIndex',
  itemCountKey: 'tradeSubstepItemCount',
})

const politicsLane = createSubstepLaneReducers({
  phaseLabel: 'Politics',
  substeps: COLONIZATION_POLITICS_SUBSTEPS,
  activeKey: 'activePoliticsSubstepIndex',
  completedKey: 'completedPoliticsSubstepIndex',
  itemIndexKey: 'politicsSubstepItemIndex',
  itemCountKey: 'politicsSubstepItemCount',
})

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnNetworkSubstepStart(progress, payload) {
  return networkLane.onStart(progress, payload)
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnNetworkSubstepComplete(progress, payload) {
  return networkLane.onComplete(progress, payload)
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{
 *   substepIndex: number,
 *   itemIndex: number,
 *   itemCount: number,
 *   phase?: string,
 *   phasePercent?: number,
 * }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnNetworkSubstepItemProgress(progress, payload) {
  return networkLane.onItem(progress, payload)
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnCollapseSubstepStart(progress, payload) {
  return collapseLane.onStart(progress, payload)
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnCollapseSubstepComplete(progress, payload) {
  return collapseLane.onComplete(progress, payload)
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number, itemIndex: number, itemCount: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnCollapseSubstepItemProgress(progress, payload) {
  return collapseLane.onItem(progress, payload)
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnTradeSubstepStart(progress, payload) {
  return tradeLane.onStart(progress, payload)
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnTradeSubstepComplete(progress, payload) {
  return tradeLane.onComplete(progress, payload)
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number, itemIndex: number, itemCount: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnTradeSubstepItemProgress(progress, payload) {
  return tradeLane.onItem(progress, payload)
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnPoliticsSubstepStart(progress, payload) {
  return politicsLane.onStart(progress, payload)
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnPoliticsSubstepComplete(progress, payload) {
  return politicsLane.onComplete(progress, payload)
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number, itemIndex: number, itemCount: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnPoliticsSubstepItemProgress(progress, payload) {
  return politicsLane.onItem(progress, payload)
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ stepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnFinalizeStepStart(progress, payload) {
  const step = COLONIZATION_EPOCH_FINALIZE_STEPS[payload.stepIndex]
  const unitCount = epochStepUnitCount()
  const unitIndex = epochStepFinalizeUnitIndex(payload.stepIndex)
  return {
    ...progress,
    percent: epochStepProgressValue(unitIndex, unitCount),
    activeEpochIndex: progress.completedEpochIndex,
    activePhaseIndex: -1,
    completedPhaseIndex: COLONIZATION_EPOCH_PHASE_COUNT - 1,
    label: step?.label ?? '',
    activeNetworkSubstepIndex: -1,
    completedNetworkSubstepIndex: -1,
    networkSubstepItemIndex: -1,
    networkSubstepItemCount: 0,
    networkSubstepPhase: '',
    networkSubstepPhasePercent: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
    collapseSubstepItemIndex: -1,
    collapseSubstepItemCount: 0,
    activeTradeSubstepIndex: -1,
    completedTradeSubstepIndex: -1,
    tradeSubstepItemIndex: -1,
    tradeSubstepItemCount: 0,
    activePoliticsSubstepIndex: -1,
    completedPoliticsSubstepIndex: -1,
    politicsSubstepItemIndex: -1,
    politicsSubstepItemCount: 0,
    activeFinalizeStepIndex: payload.stepIndex,
    activeMapSubstepIndex: step?.id === 'map' ? -1 : progress.activeMapSubstepIndex,
    completedMapSubstepIndex: step?.id === 'map' ? -1 : progress.completedMapSubstepIndex,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ stepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnFinalizeStepComplete(progress, payload) {
  const unitCount = epochStepUnitCount()
  const unitIndex = epochStepFinalizeUnitIndex(payload.stepIndex)
  return {
    ...progress,
    percent: epochStepProgressValue(unitIndex, unitCount),
    activeFinalizeStepIndex: payload.stepIndex,
    completedFinalizeStepIndex: payload.stepIndex,
    activeNetworkSubstepIndex: -1,
    completedNetworkSubstepIndex: -1,
    networkSubstepItemIndex: -1,
    networkSubstepItemCount: 0,
    networkSubstepPhase: '',
    networkSubstepPhasePercent: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
    collapseSubstepItemIndex: -1,
    collapseSubstepItemCount: 0,
    activeTradeSubstepIndex: -1,
    completedTradeSubstepIndex: -1,
    tradeSubstepItemIndex: -1,
    tradeSubstepItemCount: 0,
    activePoliticsSubstepIndex: -1,
    completedPoliticsSubstepIndex: -1,
    politicsSubstepItemIndex: -1,
    politicsSubstepItemCount: 0,
    activeMapSubstepIndex: -1,
    completedMapSubstepIndex: -1,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnMapSubstepStart(progress, payload) {
  const substep = COLONIZATION_EPOCH_MAP_SUBSTEPS[payload.substepIndex]
  return {
    ...progress,
    activeMapSubstepIndex: payload.substepIndex,
    label: progress.label.startsWith('Map')
      ? `Map · ${substep?.label ?? ''}`
      : progress.label,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @param {{ substepIndex: number }} payload
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnMapSubstepComplete(progress, payload) {
  return {
    ...progress,
    activeMapSubstepIndex: payload.substepIndex,
    completedMapSubstepIndex: payload.substepIndex,
  }
}

/**
 * @param {EpochStepProgressState} progress
 * @returns {EpochStepProgressState}
 */
export function reduceEpochStepProgressOnRunComplete(progress) {
  return {
    ...progress,
    percent: 100,
    activeEpochIndex: -1,
    activePhaseIndex: -1,
    activeNetworkSubstepIndex: -1,
    networkSubstepItemIndex: -1,
    networkSubstepItemCount: 0,
    networkSubstepPhase: '',
    networkSubstepPhasePercent: -1,
    activeCollapseSubstepIndex: -1,
    collapseSubstepItemIndex: -1,
    collapseSubstepItemCount: 0,
    activeTradeSubstepIndex: -1,
    tradeSubstepItemIndex: -1,
    tradeSubstepItemCount: 0,
    activePoliticsSubstepIndex: -1,
    completedPoliticsSubstepIndex: -1,
    politicsSubstepItemIndex: -1,
    politicsSubstepItemCount: 0,
    activeFinalizeStepIndex: -1,
    activeMapSubstepIndex: -1,
  }
}
