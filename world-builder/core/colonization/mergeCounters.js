import { DAUGHTER_OUTPOST_HEADCOUNT } from './expeditions/expeditionConstants.js'

export const OUTPOST_REABSORPTION_STAGNATION_EPOCHS = 5
export const LIVING_SPHERE_DEFICIT_EPOCHS = 3
export const OUTPOST_REABSORPTION_POPULATION_CAP = DAUGHTER_OUTPOST_HEADCOUNT * 2

/**
 * @typedef {import('./createDefaultColonizationSlice.js').MergeCounterEntry} MergeCounterEntry
 */

/**
 * @param {Record<string, MergeCounterEntry>} counters
 * @param {string} settlementId
 * @param {Partial<MergeCounterEntry>} patch
 * @returns {Record<string, MergeCounterEntry>}
 */
export function patchMergeCounter(counters, settlementId, patch) {
  const next = { ...counters }
  const current = { ...(next[settlementId] ?? {}) }
  if (patch.outpostStagnation === 0) {
    delete current.outpostStagnation
  } else if (Number.isFinite(patch.outpostStagnation)) {
    current.outpostStagnation = patch.outpostStagnation
  }
  if (patch.livingSphereDeficit === 0) {
    delete current.livingSphereDeficit
  } else if (Number.isFinite(patch.livingSphereDeficit)) {
    current.livingSphereDeficit = patch.livingSphereDeficit
  }
  if (Object.keys(current).length === 0) {
    delete next[settlementId]
  } else {
    next[settlementId] = current
  }
  return next
}

/**
 * @param {{
 *   settlement: object,
 *   survival: { foodSurplus: number },
 *   counters: Record<string, MergeCounterEntry>,
 * }} params
 * @returns {Record<string, MergeCounterEntry>}
 */
export function updateOutpostStagnationCounter(params) {
  const { settlement, survival, counters } = params
  if (
    !settlement.originSettlementId ||
    settlement.tier !== 'outpost' ||
    settlement.population > OUTPOST_REABSORPTION_POPULATION_CAP
  ) {
    return patchMergeCounter(counters, settlement.id, { outpostStagnation: 0 })
  }

  const stagnant = survival.foodSurplus <= 0
  if (!stagnant) {
    return patchMergeCounter(counters, settlement.id, { outpostStagnation: 0 })
  }

  const previous = counters[settlement.id]?.outpostStagnation ?? 0
  return patchMergeCounter(counters, settlement.id, {
    outpostStagnation: previous + 1,
  })
}

/**
 * @param {{
 *   settlement: object,
 *   survival: { foodSurplus: number },
 *   counters: Record<string, MergeCounterEntry>,
 * }} params
 * @returns {Record<string, MergeCounterEntry>}
 */
export function updateLivingSphereDeficitCounter(params) {
  const { settlement, survival, counters } = params
  if (survival.foodSurplus >= 0) {
    return patchMergeCounter(counters, settlement.id, { livingSphereDeficit: 0 })
  }

  const previous = counters[settlement.id]?.livingSphereDeficit ?? 0
  return patchMergeCounter(counters, settlement.id, {
    livingSphereDeficit: previous + 1,
  })
}
