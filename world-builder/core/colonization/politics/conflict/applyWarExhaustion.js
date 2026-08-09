/**
 * War exhaustion: lasting population loss and temporary martial penalty.
 * Domain: world-builder/CONTEXT.md — War exhaustion; ADR 0020.
 */

import {
  WAR_DEATH_FRACTION_OF_CONTRIBUTION,
  WAR_EXHAUSTION_DECAY_EPOCHS,
  WAR_EXHAUSTION_PENALTY,
  WAR_STAKE_DEATH_PREMIUM_FRACTION,
} from './conflictConstants.js'

/**
 * @param {{
 *   slice: object,
 *   contributionsBySettlementId: Record<string, number>,
 *   contestedSettlementId: string,
 *   epoch: number,
 *   fought: boolean,
 * }} params
 * @returns {{
 *   slice: object,
 *   populationLosses: Record<string, number>,
 * }}
 */
export function applyWarExhaustion(params) {
  if (!params.fought) {
    return { slice: params.slice, populationLosses: {} }
  }

  const contributions = params.contributionsBySettlementId ?? {}
  const totalContribution = Object.values(contributions).reduce(
    (sum, value) => sum + Math.max(0, Number(value) || 0),
    0,
  )
  if (!(totalContribution > 0)) {
    return { slice: params.slice, populationLosses: {} }
  }

  /** @type {Record<string, number>} */
  const populationLosses = {}
  const settlements = (params.slice.settlements ?? []).map((settlement) => {
    const contribution = Math.max(0, Number(contributions[settlement.id]) || 0)
    if (!(contribution > 0) || settlement.status !== 'living') return settlement

    const share = contribution / totalContribution
    let lossFraction = WAR_DEATH_FRACTION_OF_CONTRIBUTION * share
    if (settlement.id === params.contestedSettlementId) {
      lossFraction += WAR_STAKE_DEATH_PREMIUM_FRACTION
    }
    const pop = Math.max(0, Number(settlement.population) || 0)
    const loss = Math.min(pop, Math.floor(pop * lossFraction))
    if (loss <= 0) return settlement
    populationLosses[settlement.id] = loss
    return { ...settlement, population: pop - loss }
  })

  const warExhaustionBySettlementId = {
    ...(params.slice.warExhaustionBySettlementId ?? {}),
  }
  for (const settlementId of Object.keys(contributions)) {
    if (!(Math.max(0, Number(contributions[settlementId]) || 0) > 0)) continue
    warExhaustionBySettlementId[settlementId] = {
      penalty: WAR_EXHAUSTION_PENALTY,
      expiresEpoch: params.epoch + WAR_EXHAUSTION_DECAY_EPOCHS,
    }
  }

  return {
    slice: {
      ...params.slice,
      settlements,
      warExhaustionBySettlementId,
    },
    populationLosses,
  }
}

/**
 * Drop expired war-exhaustion penalties.
 *
 * @param {{ slice: object, epoch: number }} params
 * @returns {{ slice: object }}
 */
export function decayWarExhaustion(params) {
  const current = params.slice.warExhaustionBySettlementId ?? {}
  /** @type {Record<string, { penalty: number, expiresEpoch: number }>} */
  const next = {}
  for (const [settlementId, entry] of Object.entries(current)) {
    if (!entry) continue
    if (params.epoch >= entry.expiresEpoch) continue
    next[settlementId] = entry
  }
  return {
    slice: {
      ...params.slice,
      warExhaustionBySettlementId: next,
    },
  }
}

/**
 * @param {object} slice
 * @param {string} settlementId
 * @returns {number}
 */
export function warExhaustionPenaltyFor(slice, settlementId) {
  const entry = slice?.warExhaustionBySettlementId?.[settlementId]
  if (!entry) return 0
  if (slice.epoch >= entry.expiresEpoch) return 0
  return Math.max(0, Number(entry.penalty) || 0)
}
