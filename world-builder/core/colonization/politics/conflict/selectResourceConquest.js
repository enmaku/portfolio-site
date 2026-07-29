/**
 * Resource Want / economic contest stake selection for conquest.
 * Domain: world-builder/CONTEXT.md — Conquest, Conflict engine, economic contest.
 */

import { getConflictTuning } from './conflictTuning.js'
import { projectMight, projectionPathHaulFraction } from './projectMight.js'

/** Yield / progress cadence while scoring attacker×stake pairs. */
export const CONQUEST_SELECT_YIELD_EVERY = 8

/**
 * @typedef {{
 *   attackerFactionId: string,
 *   contestedSettlementId: string,
 *   defenderFactionId: string | null,
 *   intensity: number,
 *   attackerMight: number,
 *   stakeCapacity: number,
 *   defendedMight?: number,
 *   pathHaul?: number,
 *   borderNeighbor?: boolean,
 * }} ConquestCandidate
 */

/**
 * Score and pick conquest stakes for factions not already busy this epoch.
 * Routine economic contest intensity below threshold does not escalate (and is not logged).
 *
 * @param {{
 *   slice: object,
 *   capacityBySettlementId: Record<string, number>,
 *   candidateEdges: object[],
 *   strategicReachHaulFractions: object,
 *   resourceScoreBySettlementId?: Record<string, number>,
 *   busyFactionIds?: Set<string>,
 *   maxConquests?: number,
 *   yieldToUi?: () => Promise<void>,
 *   onProgress?: (itemIndex: number, itemCount: number) => void,
 * }} params
 * @returns {Promise<ConquestCandidate[]>}
 */
export async function selectResourceConquests(params) {
  const tuning = getConflictTuning()
  const maxConquests = Math.max(
    1,
    Math.floor(Number(params.maxConquests ?? tuning.maxConquestsPerEpoch) || 1),
  )
  const busy = new Set(params.busyFactionIds ?? [])
  const settlements = (params.slice.settlements ?? []).filter((s) => s.status === 'living')
  const activeFactions = (params.slice.factions ?? []).filter((f) => f.status === 'active')
  const attackers = activeFactions.filter((f) => !busy.has(f.id))
  const factionById = new Map(activeFactions.map((f) => [f.id, f]))
  const neighborsBySettlementId = buildNeighborIndex(
    params.candidateEdges,
    Number(tuning.borderNeighborHaulFraction) || 0.35,
  )
  /** @type {ConquestCandidate[]} */
  const candidates = []
  const totalWork = Math.max(1, attackers.length * settlements.length)
  let workIndex = 0
  const { yieldToUi, onProgress } = params

  for (const attacker of attackers) {
    const memberIds = attacker.settlementIds ?? []
    const coreMemberIds = contiguousCoreMemberIds(
      memberIds,
      attacker.capitalSettlementId,
      neighborsBySettlementId,
    )

    for (const stake of settlements) {
      workIndex += 1
      if (
        workIndex === 1 ||
        workIndex === totalWork ||
        workIndex % CONQUEST_SELECT_YIELD_EVERY === 0
      ) {
        onProgress?.(workIndex, totalWork)
        await yieldToUi?.()
      }
      if (stake.factionId === attacker.id) {
        continue
      }
      const defenderFactionId = stake.factionId ?? null
      if (defenderFactionId && busy.has(defenderFactionId)) {
        continue
      }

      const attackerMight = sumProjection({
        memberIds,
        capacityBySettlementId: params.capacityBySettlementId,
        contestedSettlementId: stake.id,
        candidateEdges: params.candidateEdges,
        strategicReachHaulFractions: params.strategicReachHaulFractions,
      })
      if (!(attackerMight > 0)) {
        continue
      }

      const defenderMemberIds = defenderFactionId
        ? (factionById.get(defenderFactionId)?.settlementIds ?? [stake.id])
        : [stake.id]
      const defenderMight = sumProjection({
        memberIds: defenderMemberIds,
        capacityBySettlementId: params.capacityBySettlementId,
        contestedSettlementId: stake.id,
        candidateEdges: params.candidateEdges,
        strategicReachHaulFractions: params.strategicReachHaulFractions,
      })
      const isCapital =
        Boolean(defenderFactionId) &&
        factionById.get(defenderFactionId)?.capitalSettlementId === stake.id
      const advantage = estimateStakeAdvantage(stake.tier, isCapital, tuning)
      const stakeCapacity = params.capacityBySettlementId[stake.id] ?? 0
      // Match resolveContestedSettlement: advantage applies only to the stake pin.
      const defended = defenderMight + stakeCapacity * (advantage - 1)

      const resourceScore = params.resourceScoreBySettlementId?.[stake.id] ?? 0
      const rivalBonus = defenderFactionId ? tuning.rivalBonus : 0
      const intensity =
        resourceScore +
        rivalBonus +
        Math.min(tuning.mightIntensityCap, attackerMight / tuning.mightIntensityDivisor)
      if (intensity < tuning.warThreshold) {
        continue
      }

      // Skip hopeless fights: major wars should usually flip the pin.
      if (tuning.requireAttackerEdge && !(attackerMight > defended * tuning.attackerEdgeMargin)) {
        continue
      }

      const pathHaul = minMemberHaul({
        memberIds,
        contestedSettlementId: stake.id,
        candidateEdges: params.candidateEdges,
      })
      if (pathHaul == null) continue

      const pathHaulFromCore = minMemberHaul({
        memberIds: [...coreMemberIds],
        contestedSettlementId: stake.id,
        candidateEdges: params.candidateEdges,
      })

      const reach = params.strategicReachHaulFractions ?? {}
      const landReach = Math.max(1, Number(reach.road) || Number(reach.overland) || 1)
      const maxHaulFraction = Number(tuning.maxStakeHaulReachFraction)
      if (Number.isFinite(maxHaulFraction) && maxHaulFraction < 1) {
        if (pathHaul > landReach * Math.max(0, maxHaulFraction)) {
          continue
        }
      }

      const borderHaul = Math.max(0, Number(tuning.borderNeighborHaulFraction) || 0.35)
      const edgeBorder = [...(neighborsBySettlementId.get(stake.id) ?? [])].some((id) =>
        coreMemberIds.has(id),
      )
      // pathHaul is already in three-day-haul fractions (0–1+), not × landReach.
      const nearCore = pathHaulFromCore != null && pathHaulFromCore <= borderHaul
      // Contiguous expansion: stake must sit near the capital's short-haul core.
      // Optional exception: distant unaligned free towns (creates leapfrog pins).
      const borderNeighbor = edgeBorder || nearCore
      if (tuning.requireBorderNeighbor && !borderNeighbor) {
        const distantCap = Math.max(
          borderHaul,
          Number(tuning.distantUnalignedHaulFraction) || borderHaul,
        )
        const withinDistantCap =
          pathHaulFromCore != null && pathHaulFromCore <= distantCap
        const allowDistantUnaligned =
          tuning.allowDistantUnalignedConquest &&
          defenderFactionId == null &&
          withinDistantCap
        if (!allowDistantUnaligned) {
          continue
        }
      }

      candidates.push({
        attackerFactionId: attacker.id,
        contestedSettlementId: stake.id,
        defenderFactionId,
        intensity,
        attackerMight,
        stakeCapacity,
        defendedMight: defended,
        pathHaul,
        borderNeighbor,
      })
    }
  }

  candidates.sort((a, b) => compareCandidates(a, b, tuning.preferWinnableStakes))

  /** @type {ConquestCandidate[]} */
  const picked = []
  const usedAttackers = new Set()
  const usedDefenders = new Set()
  const usedStakes = new Set()
  for (const candidate of candidates) {
    if (picked.length >= maxConquests) break
    if (usedAttackers.has(candidate.attackerFactionId)) continue
    if (usedStakes.has(candidate.contestedSettlementId)) continue
    if (candidate.defenderFactionId && usedDefenders.has(candidate.defenderFactionId)) continue
    if (candidate.defenderFactionId && usedAttackers.has(candidate.defenderFactionId)) continue
    if (usedDefenders.has(candidate.attackerFactionId)) continue
    picked.push(candidate)
    usedAttackers.add(candidate.attackerFactionId)
    usedStakes.add(candidate.contestedSettlementId)
    if (candidate.defenderFactionId) usedDefenders.add(candidate.defenderFactionId)
  }

  return picked
}

/**
 * @param {{
 *   slice: object,
 *   capacityBySettlementId: Record<string, number>,
 *   candidateEdges: object[],
 *   strategicReachHaulFractions: object,
 *   resourceScoreBySettlementId?: Record<string, number>,
 *   busyFactionIds?: Set<string>,
 *   yieldToUi?: () => Promise<void>,
 *   onProgress?: (itemIndex: number, itemCount: number) => void,
 * }} params
 * @returns {Promise<ConquestCandidate | null>}
 */
export async function selectResourceConquest(params) {
  const picked = await selectResourceConquests({ ...params, maxConquests: 1 })
  return picked[0] ?? null
}

/**
 * @param {ConquestCandidate} a
 * @param {ConquestCandidate} b
 * @param {boolean} preferWinnable
 */
function compareCandidates(a, b, preferWinnable) {
  if (preferWinnable) {
    const easeA = conquestEase(a)
    const easeB = conquestEase(b)
    if (easeB !== easeA) return easeB - easeA
  }
  if (b.intensity !== a.intensity) return b.intensity - a.intensity
  return a.contestedSettlementId.localeCompare(b.contestedSettlementId)
}

/**
 * Higher = likelier attacker win and closer logistics grip.
 * Border / short-haul stakes beat distant free-town leapfrogs.
 * @param {ConquestCandidate} candidate
 */
function conquestEase(candidate) {
  const tuning = getConflictTuning()
  const unalignedBoost =
    candidate.defenderFactionId == null ? Math.max(1, Number(tuning.unalignedEaseBoost) || 1) : 1
  const borderBoost = candidate.borderNeighbor
    ? Math.max(1, Number(tuning.borderEaseBoost) || 1)
    : Math.max(0, Number(tuning.nonBorderEaseMult) || 0)
  const haul = Math.max(0, Number(candidate.pathHaul) || 0)
  const haulWeight = Math.max(0, Number(tuning.haulProximityWeight) || 0)
  const proximity = 1 / (1 + haul * haulWeight)
  const denom = Math.max(1, candidate.defendedMight ?? candidate.stakeCapacity)
  return (
    unalignedBoost *
    borderBoost *
    proximity *
    (candidate.attackerMight / denom) *
    Math.max(1, candidate.intensity)
  )
}

/**
 * Short-haul neighbor index for border / contiguity checks.
 * Full candidate reach (≤1 haul) is too wide to mean "adjacent polity".
 * @param {object[]} edges
 * @param {number} maxHaulFraction
 * @returns {Map<string, Set<string>>}
 */
function buildNeighborIndex(edges, maxHaulFraction = 0.35) {
  /** @type {Map<string, Set<string>>} */
  const neighbors = new Map()
  const maxHaul = Math.max(0, Number(maxHaulFraction) || 0)
  for (const edge of edges ?? []) {
    const a = edge?.fromSettlementId
    const b = edge?.toSettlementId
    if (!a || !b) continue
    const haul = Number(edge.haulDistanceFraction)
    if (!(haul >= 0) || haul > maxHaul) continue
    if (!neighbors.has(a)) neighbors.set(a, new Set())
    if (!neighbors.has(b)) neighbors.set(b, new Set())
    neighbors.get(a)?.add(b)
    neighbors.get(b)?.add(a)
  }
  return neighbors
}

/**
 * Capital-connected component under the short-haul neighbor graph.
 * Leapfrog islands do not count as polity border for expansion.
 * @param {string[]} memberIds
 * @param {string | null | undefined} capitalId
 * @param {Map<string, Set<string>>} neighbors
 * @returns {Set<string>}
 */
function contiguousCoreMemberIds(memberIds, capitalId, neighbors) {
  const memberSet = new Set(memberIds)
  const start =
    capitalId && memberSet.has(capitalId) ? capitalId : memberIds.find((id) => memberSet.has(id))
  /** @type {Set<string>} */
  const core = new Set()
  if (!start) return core
  core.add(start)
  /** @type {string[]} */
  const stack = [start]
  while (stack.length) {
    const id = stack.pop()
    for (const next of neighbors.get(id) ?? []) {
      if (!memberSet.has(next) || core.has(next)) continue
      core.add(next)
      stack.push(next)
    }
  }
  return core
}

/**
 * @param {{
 *   memberIds: string[],
 *   contestedSettlementId: string,
 *   candidateEdges: object[],
 * }} params
 * @returns {number | null}
 */
function minMemberHaul(params) {
  let min = Infinity
  for (const id of params.memberIds) {
    const haul = projectionPathHaulFraction({
      fromSettlementId: id,
      contestedSettlementId: params.contestedSettlementId,
      candidateEdges: params.candidateEdges,
    })
    if (haul == null) continue
    if (haul < min) min = haul
  }
  return Number.isFinite(min) ? min : null
}

/**
 * @param {string | null | undefined} tier
 * @param {boolean} isCapital
 * @param {import('./conflictTuning.js').ConflictTuning} tuning
 */
function estimateStakeAdvantage(tier, isCapital, tuning) {
  const byTier = {
    hamlet: tuning.defenderHamlet,
    village: tuning.defenderVillage,
    town: tuning.defenderTown,
    city: tuning.defenderCity,
  }
  const tierMult =
    tier && Object.prototype.hasOwnProperty.call(byTier, tier)
      ? byTier[/** @type {keyof typeof byTier} */ (tier)]
      : tuning.defenderDefault
  return isCapital ? tierMult * tuning.defenderCapitalBump : tierMult
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
