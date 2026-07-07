import { resolveExpeditions } from './expeditions/expeditionConstants.js'
import { settlementTierFromPopulation } from './settlementTierFromPopulation.js'

/**
 * @typedef {import('./evaluateOutpostReabsorption.js').SettlementMergeCandidate} SettlementMergeCandidate
 */

/**
 * @param {{
 *   slice: import('./createDefaultColonizationSlice.js').ColonizationSlice,
 *   candidates: SettlementMergeCandidate[],
 *   survivalBySettlementId: Record<string, { populationCeiling: number }>,
 *   epoch: number,
 * }} params
 * @returns {{
 *   slice: import('./createDefaultColonizationSlice.js').ColonizationSlice,
 *   events: object[],
 * }}
 */
export function applySettlementMergeTransitions(params) {
  const { slice, candidates, survivalBySettlementId, epoch } = params
  if (candidates.length === 0) {
    return { slice, events: [] }
  }

  let settlements = slice.settlements.map((settlement) => ({ ...settlement }))
  let expeditions = resolveExpeditions(slice.expeditions)
  let notableFigures = (slice.notableFigures ?? []).map((figure) => ({ ...figure }))
  let mergeCounters = { ...(slice.mergeCounters ?? {}) }
  const historyLog = [...slice.historyLog]
  /** @type {object[]} */
  const events = []

  for (const candidate of candidates) {
    const survivorIndex = settlements.findIndex(
      (entry) => entry.id === candidate.survivorSettlementId,
    )
    const absorbedIndex = settlements.findIndex(
      (entry) => entry.id === candidate.absorbedSettlementId,
    )
    if (survivorIndex < 0 || absorbedIndex < 0) continue

    const survivor = settlements[survivorIndex]
    const absorbed = settlements[absorbedIndex]
    if (survivor.status === 'ruin' || absorbed.status === 'ruin') continue

    const ceiling = survivalBySettlementId[survivor.id]?.populationCeiling ?? Infinity
    const mergedPopulation = Math.min(
      Math.floor(survivor.population + absorbed.population),
      Math.floor(ceiling),
    )

    settlements[survivorIndex] = {
      ...survivor,
      population: mergedPopulation,
      tier: settlementTierFromPopulation(mergedPopulation),
    }
    settlements[absorbedIndex] = {
      ...absorbed,
      population: 0,
      tier: null,
      status: 'ruin',
    }

    expeditions = expeditions.map((expedition) =>
      expedition.settlementId === absorbed.id && expedition.status === 'active'
        ? { ...expedition, status: 'completed', endReason: 'blocked' }
        : expedition,
    )

    notableFigures = notableFigures.map((figure) =>
      figure.settlementId === absorbed.id
        ? {
            ...figure,
            status: 'absorbed',
            absorbedIntoSettlementId: survivor.id,
          }
        : figure,
    )

    delete mergeCounters[absorbed.id]

    historyLog.push({
      kind: 'settlement_merged',
      epoch,
      settlementId: survivor.id,
      absorbedSettlementId: absorbed.id,
      mergePath: candidate.path,
    })
    events.push({
      kind: 'settlement_merged',
      settlementId: survivor.id,
      absorbedSettlementId: absorbed.id,
    })
  }

  return {
    slice: {
      ...slice,
      settlements,
      expeditions,
      notableFigures,
      mergeCounters,
      historyLog,
    },
    events,
  }
}

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @returns {string | null}
 */
export function resolveFoundingSettlementId(slice) {
  const landing = slice.foundingLanding
  if (!landing) return null
  return `settlement-founding-${landing.x}-${landing.y}`
}
