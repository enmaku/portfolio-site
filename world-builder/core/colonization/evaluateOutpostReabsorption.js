import {
  OUTPOST_REABSORPTION_POPULATION_CAP,
  OUTPOST_REABSORPTION_STAGNATION_EPOCHS,
} from './mergeCounters.js'

/**
 * @typedef {Object} SettlementMergeCandidate
 * @property {string} survivorSettlementId
 * @property {string} absorbedSettlementId
 * @property {'outpost_reabsorption' | 'living_sphere_consolidation'} path
 */

/**
 * @param {{
 *   settlements: object[],
 *   mergeCounters: Record<string, import('./createDefaultColonizationSlice.js').MergeCounterEntry>,
 *   foundingSettlementId: string | null,
 *   alreadyAbsorbedThisEpoch: Set<string>,
 *   alreadySurvivorThisEpoch: Set<string>,
 * }} params
 * @returns {SettlementMergeCandidate[]}
 */
export function evaluateOutpostReabsorption(params) {
  const {
    settlements,
    mergeCounters,
    foundingSettlementId,
    alreadyAbsorbedThisEpoch,
    alreadySurvivorThisEpoch,
  } = params

  /** @type {SettlementMergeCandidate[]} */
  const candidates = []

  for (const settlement of settlements) {
    if (settlement.status === 'ruin') continue
    if (settlement.id === foundingSettlementId) continue
    if (alreadyAbsorbedThisEpoch.has(settlement.id)) continue
    if (!settlement.originSettlementId) continue
    if (settlement.tier !== 'outpost') continue
    if (settlement.population > OUTPOST_REABSORPTION_POPULATION_CAP) continue

    const stagnation = mergeCounters[settlement.id]?.outpostStagnation ?? 0
    if (stagnation < OUTPOST_REABSORPTION_STAGNATION_EPOCHS) continue

    const origin = settlements.find((entry) => entry.id === settlement.originSettlementId)
    if (!origin || origin.status === 'ruin') continue
    if (alreadySurvivorThisEpoch.has(origin.id)) continue

    candidates.push({
      survivorSettlementId: origin.id,
      absorbedSettlementId: settlement.id,
      path: 'outpost_reabsorption',
    })
    alreadyAbsorbedThisEpoch.add(settlement.id)
    alreadySurvivorThisEpoch.add(origin.id)
  }

  return candidates
}
