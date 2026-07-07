import { computeHaulShedTravelTimes } from './computeHaulShedIsochrone.js'
import { LIVING_SPHERE_DEFICIT_EPOCHS } from './mergeCounters.js'
import { SETTLEMENT_TIER_THRESHOLDS } from './settlementTierFromPopulation.js'

/**
 * @typedef {import('./evaluateOutpostReabsorption.js').SettlementMergeCandidate} SettlementMergeCandidate
 */

/**
 * @param {string | null | undefined} tier
 * @returns {number}
 */
function tierRank(tier) {
  if (!tier) return -1
  const index = SETTLEMENT_TIER_THRESHOLDS.findIndex((band) => band.tier === tier)
  return index >= 0 ? index : -1
}

/**
 * @param {{
 *   settlements: object[],
 *   survivalBySettlementId: Record<string, { foodSurplus: number }>,
 *   mergeCounters: Record<string, import('./createDefaultColonizationSlice.js').MergeCounterEntry>,
 *   colonistSettings: import('./createDefaultColonizationSlice.js').ColonistSettings,
 *   worldDocument: import('../types.js').WorldDocument,
 *   roadCellMask: Uint8Array | null,
 *   foundingSettlementId: string | null,
 *   alreadyAbsorbedThisEpoch: Set<string>,
 *   alreadySurvivorThisEpoch: Set<string>,
 * }} params
 * @returns {SettlementMergeCandidate[]}
 */
export function evaluateLivingSphereConsolidation(params) {
  const {
    settlements,
    survivalBySettlementId,
    mergeCounters,
    colonistSettings,
    worldDocument,
    roadCellMask,
    foundingSettlementId,
    alreadyAbsorbedThisEpoch,
    alreadySurvivorThisEpoch,
  } = params

  /** @type {SettlementMergeCandidate[]} */
  const candidates = []

  for (const deficitSite of settlements) {
    if (deficitSite.status === 'ruin') continue
    if (deficitSite.id === foundingSettlementId) continue
    if (alreadyAbsorbedThisEpoch.has(deficitSite.id)) continue

    const deficitSurvival = survivalBySettlementId[deficitSite.id]
    if (!deficitSurvival || deficitSurvival.foodSurplus >= 0) continue

    const deficitCounter = mergeCounters[deficitSite.id]?.livingSphereDeficit ?? 0
    if (deficitCounter < LIVING_SPHERE_DEFICIT_EPOCHS) continue

    const neighbor = pickLivingSphereNeighbor({
      deficitSite,
      settlements,
      survivalBySettlementId,
      colonistSettings,
      worldDocument,
      roadCellMask,
      foundingSettlementId,
      alreadyAbsorbedThisEpoch,
      alreadySurvivorThisEpoch,
    })
    if (!neighbor) continue

    const survivor =
      tierRank(neighbor.tier) > tierRank(deficitSite.tier) ||
      (tierRank(neighbor.tier) === tierRank(deficitSite.tier) &&
        neighbor.population >= deficitSite.population)
        ? neighbor
        : deficitSite
    const absorbed = survivor.id === neighbor.id ? deficitSite : neighbor

    if (absorbed.id === foundingSettlementId) continue
    if (alreadySurvivorThisEpoch.has(survivor.id)) continue

    candidates.push({
      survivorSettlementId: survivor.id,
      absorbedSettlementId: absorbed.id,
      path: 'living_sphere_consolidation',
    })
    alreadyAbsorbedThisEpoch.add(absorbed.id)
    alreadySurvivorThisEpoch.add(survivor.id)
  }

  return candidates
}

/**
 * @param {object} params
 * @returns {object | null}
 */
function pickLivingSphereNeighbor(params) {
  const {
    deficitSite,
    settlements,
    survivalBySettlementId,
    colonistSettings,
    worldDocument,
    roadCellMask,
    foundingSettlementId,
    alreadyAbsorbedThisEpoch,
    alreadySurvivorThisEpoch,
  } = params

  const travelTime = computeHaulShedTravelTimes({
    origin: { x: deficitSite.x, y: deficitSite.y },
    budget: colonistSettings.threeDayHaulDistance,
    gridWidth: worldDocument.gridWidth,
    gridHeight: worldDocument.gridHeight,
    movementCost: worldDocument.movementCost,
    roadCellMask,
  })

  /** @type {Array<{ settlement: object, travelTime: number, surplus: number }>} */
  const neighbors = []
  for (const candidate of settlements) {
    if (candidate.status === 'ruin') continue
    if (candidate.id === deficitSite.id) continue
    if (candidate.id === foundingSettlementId) continue
    if (alreadyAbsorbedThisEpoch.has(candidate.id)) continue
    if (alreadySurvivorThisEpoch.has(candidate.id)) continue

    const survival = survivalBySettlementId[candidate.id]
    if (!survival || survival.foodSurplus <= 0) continue

    const index = candidate.y * worldDocument.gridWidth + candidate.x
    const time = travelTime[index]
    if (!Number.isFinite(time) || time > colonistSettings.threeDayHaulDistance) continue

    neighbors.push({
      settlement: candidate,
      travelTime: time,
      surplus: survival.foodSurplus,
    })
  }

  if (neighbors.length === 0) return null

  neighbors.sort((a, b) => {
    if (b.surplus !== a.surplus) return b.surplus - a.surplus
    if (a.travelTime !== b.travelTime) return a.travelTime - b.travelTime
    return tierRank(b.settlement.tier) - tierRank(a.settlement.tier)
  })

  return neighbors[0].settlement
}
