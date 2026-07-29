/**
 * Conflict engine pass: decay, peace clears, conquest (and later rebellion).
 * Domain: world-builder/CONTEXT.md — Conflict engine.
 */

import { clearEligibleBelligerentTradeBlocks } from './belligerentTradeBlocks.js'
import { decayWarExhaustion, warExhaustionPenaltyFor } from './applyWarExhaustion.js'
import { applyConquestResolution } from './applyConquestResolution.js'
import { applyRebellionResolution } from './applyRebellionResolution.js'
import { computeMartialCapacity } from './computeMartialCapacity.js'
import { getConflictTuning } from './conflictTuning.js'
import { selectResourceConquests } from './selectResourceConquest.js'

/**
 * @param {{
 *   slice: object,
 *   candidateEdges?: object[],
 *   strategicReachHaulFractions?: object,
 *   capacityBySettlementId?: Record<string, number>,
 *   resourceScoreBySettlementId?: Record<string, number>,
 *   martialInputBySettlementId?: Record<string, {
 *     foodSurplusLb?: number,
 *     baseMetalsAccess?: number,
 *     spendableWealthCp?: number,
 *   }>,
 *   taxDrainCpBySettlementId?: Record<string, number>,
 *   adjacentFactionIdBySettlementId?: Record<string, string | null>,
 *   corridorDependentBySettlementId?: Record<string, boolean>,
 * }} params
 * @returns {{ slice: object, events: object[], busyFactionIds: Set<string> }}
 */
export function applyConflictEnginePass(params) {
  const events = []
  const historyBefore = (params.slice.historyLog ?? []).length
  let next = decayWarExhaustion({ slice: params.slice, epoch: params.slice.epoch }).slice
  next = clearEligibleBelligerentTradeBlocks({ slice: next, epoch: next.epoch })
  const added = (next.historyLog ?? []).slice(historyBefore)
  events.push(...added)

  const busyFactionIds = new Set()
  let capacityBySettlementId =
    params.capacityBySettlementId ??
    buildCapacities(next, params.martialInputBySettlementId ?? {})

  const reach =
    params.strategicReachHaulFractions ?? defaultStrategicReach(next.colonistSettings)
  const edges = params.candidateEdges ?? next.tradeRouteState?.candidates ?? []
  const tuning = getConflictTuning()

  // Conquest before rebellion so tax revolts do not busy-out every territorial grab.
  const maxConquests = Math.max(1, Math.floor(Number(tuning.maxConquestsPerEpoch) || 1))
  for (let i = 0; i < maxConquests; i += 1) {
    const selected = selectResourceConquests({
      slice: next,
      capacityBySettlementId,
      candidateEdges: edges,
      strategicReachHaulFractions: reach,
      resourceScoreBySettlementId: params.resourceScoreBySettlementId,
      busyFactionIds,
      maxConquests: 1,
    })
    const [conquest] = selected
    if (!conquest) break

    const resolved = applyConquestResolution({
      slice: next,
      attackerFactionId: conquest.attackerFactionId,
      contestedSettlementId: conquest.contestedSettlementId,
      capacityBySettlementId,
      candidateEdges: edges,
      strategicReachHaulFractions: reach,
    })
    next = resolved.slice
    events.push(...resolved.events)
    for (const id of resolved.participatingFactionIds) busyFactionIds.add(id)
    capacityBySettlementId = buildCapacities(next, params.martialInputBySettlementId ?? {})
  }

  const rebellion = applyRebellionResolution({
    slice: next,
    capacityBySettlementId,
    candidateEdges: edges,
    strategicReachHaulFractions: reach,
    busyFactionIds,
    taxDrainCpBySettlementId:
      params.taxDrainCpBySettlementId ??
      next.lastTradeEpochResult?.factionTaxNetCpBySettlementId ??
      {},
    adjacentFactionIdBySettlementId: params.adjacentFactionIdBySettlementId,
    corridorDependentBySettlementId: params.corridorDependentBySettlementId,
  })
  next = rebellion.slice
  events.push(...rebellion.events)
  for (const id of rebellion.participatingFactionIds) busyFactionIds.add(id)

  return { slice: next, events, busyFactionIds }
}

/**
 * @param {object} slice
 * @param {Record<string, {
 *   foodSurplusLb?: number,
 *   baseMetalsAccess?: number,
 *   spendableWealthCp?: number,
 * }>} martialInputBySettlementId
 */
function buildCapacities(slice, martialInputBySettlementId) {
  /** @type {Record<string, number>} */
  const capacities = {}
  for (const settlement of slice.settlements ?? []) {
    if (settlement.status !== 'living') continue
    const input = martialInputBySettlementId[settlement.id] ?? {}
    capacities[settlement.id] = computeMartialCapacity({
      population: settlement.population ?? 0,
      foodSurplusLb: input.foodSurplusLb ?? 0,
      baseMetalsAccess: input.baseMetalsAccess ?? 0,
      spendableWealthCp: input.spendableWealthCp ?? 0,
      warExhaustionPenalty: warExhaustionPenaltyFor(slice, settlement.id),
    })
  }
  return capacities
}

/**
 * @param {object | undefined} settings
 */
function defaultStrategicReach(settings) {
  const haul = Number(settings?.threeDayHaulDistance) || 1
  const land = (Number(settings?.landExpeditionRange) || 2) * haul
  const inland = (Number(settings?.inlandSailExpeditionRange) || 4) * haul
  const sea = (Number(settings?.openSeaExpeditionRange) || 6) * haul
  return {
    overland: land,
    road: land,
    inlandWater: inland,
    openSea: sea,
  }
}
