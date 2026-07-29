/**
 * Resource Want / economic contest stake selection for conquest.
 * Domain: world-builder/CONTEXT.md — Conquest, Conflict engine, economic contest.
 */

import { ECONOMIC_CONTEST_WAR_THRESHOLD } from './conflictConstants.js'
import { projectMight } from './projectMight.js'

/**
 * @typedef {{
 *   attackerFactionId: string,
 *   contestedSettlementId: string,
 *   defenderFactionId: string | null,
 *   intensity: number,
 * }} ConquestCandidate
 */

/**
 * Score and pick at most one conquest stake for factions not already busy this epoch.
 * Routine economic contest intensity below threshold does not escalate (and is not logged).
 *
 * @param {{
 *   slice: object,
 *   capacityBySettlementId: Record<string, number>,
 *   candidateEdges: object[],
 *   strategicReachHaulFractions: object,
 *   resourceScoreBySettlementId?: Record<string, number>,
 *   busyFactionIds?: Set<string>,
 * }} params
 * @returns {ConquestCandidate | null}
 */
export function selectResourceConquest(params) {
  const busy = params.busyFactionIds ?? new Set()
  const settlements = (params.slice.settlements ?? []).filter((s) => s.status === 'living')
  const activeFactions = (params.slice.factions ?? []).filter((f) => f.status === 'active')
  /** @type {ConquestCandidate[]} */
  const candidates = []

  for (const attacker of activeFactions) {
    if (busy.has(attacker.id)) continue
    const memberIds = attacker.settlementIds ?? []

    for (const stake of settlements) {
      if (stake.factionId === attacker.id) continue
      const defenderFactionId = stake.factionId ?? null
      if (defenderFactionId && busy.has(defenderFactionId)) continue

      const attackerMight = sumProjection({
        memberIds,
        capacityBySettlementId: params.capacityBySettlementId,
        contestedSettlementId: stake.id,
        candidateEdges: params.candidateEdges,
        strategicReachHaulFractions: params.strategicReachHaulFractions,
      })
      if (!(attackerMight > 0)) continue

      const resourceScore = params.resourceScoreBySettlementId?.[stake.id] ?? 0
      const intensity = resourceScore + Math.min(40, attackerMight / 10)
      if (intensity < ECONOMIC_CONTEST_WAR_THRESHOLD) continue

      candidates.push({
        attackerFactionId: attacker.id,
        contestedSettlementId: stake.id,
        defenderFactionId,
        intensity,
      })
    }
  }

  candidates.sort((a, b) => {
    if (b.intensity !== a.intensity) return b.intensity - a.intensity
    return a.contestedSettlementId.localeCompare(b.contestedSettlementId)
  })
  return candidates[0] ?? null
}

/**
 * @param {{
 *   memberIds: string[],
 *   capacityBySettlementId: Record<string, number>,
 *   contestedSettlementId: string,
 *   candidateEdges: object[],
 *   strategicReachHaulFractions: object,
 * }} params
 */
function sumProjection(params) {
  let total = 0
  for (const id of params.memberIds) {
    total += projectMight({
      contributorCapacity: params.capacityBySettlementId[id] ?? 0,
      fromSettlementId: id,
      contestedSettlementId: params.contestedSettlementId,
      candidateEdges: params.candidateEdges,
      strategicReachHaulFractions: params.strategicReachHaulFractions,
    })
  }
  return total
}
