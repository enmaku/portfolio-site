import { applyPopulationCollapse } from './applyPopulationCollapse.js'
import { applyRuinTransitions } from './applyRuin.js'
import { recomputePrimaryClaims, serializeClaimMap } from './computePrimaryClaimMap.js'
import { applySurvivalResolveToSettlement } from './resolveSurvivalTriad.js'
import { saltSpoilageMultiplierForSettlement as defaultSaltSpoilage } from './saltSpoilageMultiplier.js'
import { settlementTierFromPopulation } from './settlementTierFromPopulation.js'

/**
 * Annual colonization tick order:
 * network (no-op in increment 1) → claims → survival → politics (no-op until #394).
 *
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} worldDocument
 * @param {{ saltSpoilageMultiplierForSettlement?: (settlement: object, claimedCells: Array<{x:number,y:number}>, worldDocument: import('../types.js').WorldDocument) => number }} [options]
 * @returns {{
 *   slice: import('./createDefaultColonizationSlice.js').ColonizationSlice,
 *   events: object[],
 * }}
 */
export function applyColonizationEpoch(slice, worldDocument, options = {}) {
  if (slice.colonizationPhase !== 'running') {
    return { slice, events: [] }
  }

  applyNetworkPhaseNoop()

  const claimMap = recomputePrimaryClaims({
    settlements: slice.settlements,
    colonistSettings: slice.colonistSettings,
    gridWidth: worldDocument.gridWidth,
    gridHeight: worldDocument.gridHeight,
    movementCost: worldDocument.movementCost,
  })
  const primaryClaim = serializeClaimMap(claimMap)

  /** @type {object[]} */
  const nextSettlements = []

  for (const settlement of slice.settlements) {
    if (settlement.status === 'ruin') {
      nextSettlements.push({ ...settlement })
      continue
    }

    const claimedCells = primaryClaim[settlement.id] ?? []
    const saltResolver = options.saltSpoilageMultiplierForSettlement ?? defaultSaltSpoilage
    const saltSpoilageMultiplier = saltResolver(settlement, claimedCells, worldDocument)

    const { settlement: resolved, survival } = applySurvivalResolveToSettlement({
      settlement,
      claimedCells,
      colonistSettings: slice.colonistSettings,
      worldDocument,
      saltSpoilageMultiplier,
    })

    let population = resolved.population
    if (survival.hasFreshwater) {
      population = applySurplusPopulationDelta(
        population,
        survival.foodSurplus,
        survival.populationCeiling,
      )
    } else {
      population = 0
    }

    nextSettlements.push({
      ...resolved,
      population,
      tier: settlementTierFromPopulation(population),
    })
  }

  const nextEpoch = slice.epoch + 1
  const ruined = applyRuinTransitions({
    settlements: nextSettlements,
    primaryClaim,
    historyLog: slice.historyLog,
    epoch: nextEpoch,
  })

  applyPoliticsPhaseNoop()

  const withClaims = {
    ...slice,
    epoch: nextEpoch,
    settlements: ruined.settlements,
    primaryClaim: ruined.primaryClaim,
    historyLog: ruined.historyLog,
  }

  const { slice: collapsed } = applyPopulationCollapse(withClaims, worldDocument)

  return {
    slice: collapsed,
    events: ruined.events,
  }
}

/**
 * Surplus-driven population change in people-units, clamped by ceiling.
 *
 * @param {number} population
 * @param {number} foodSurplus
 * @param {number} populationCeiling
 * @returns {number}
 */
export function applySurplusPopulationDelta(population, foodSurplus, populationCeiling) {
  let next = population
  if (foodSurplus > 0) {
    next = population + Math.max(1, Math.floor(foodSurplus * 0.1))
  } else if (foodSurplus < 0) {
    next = population - Math.max(1, Math.floor(Math.abs(foodSurplus) * 0.1))
  }
  return Math.max(0, Math.min(Math.floor(next), populationCeiling))
}

function applyNetworkPhaseNoop() {}

function applyPoliticsPhaseNoop() {}
