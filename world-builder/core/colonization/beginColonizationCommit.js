import {
  COLONIZATION_PHASE_RUNNING,
  COLONIZATION_PHASE_SETUP,
  cloneColonizationSlice,
} from './createDefaultColonizationSlice.js'
import { applyPopulationCollapse } from './applyPopulationCollapse.js'
import { applyRuinTransitions } from './applyRuin.js'
import { createFoundingDynasty } from './createFoundingDynasty.js'
import { recomputePrimaryClaims, serializeClaimMap } from './computePrimaryClaimMap.js'
import { applySurvivalResolveToSettlement } from './resolveSurvivalTriad.js'
import { saltSpoilageMultiplier } from './saltSpoilageMultiplier.js'

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} doc
 * @returns {import('./createDefaultColonizationSlice.js').ColonizationSlice}
 */
export function beginColonizationCommit(slice, doc) {
  if (slice.colonizationPhase !== COLONIZATION_PHASE_SETUP || !slice.foundingLanding) {
    return slice
  }

  const current = cloneColonizationSlice(slice)
  const landing = current.foundingLanding
  if (!landing) {
    return slice
  }

  const seedSettlement = {
    id: `settlement-founding-${landing.x}-${landing.y}`,
    x: landing.x,
    y: landing.y,
    tier: /** @type {string | null} */ ('outpost'),
    population: current.colonistSettings.startingPopulation,
    status: 'living',
  }

  const claimMap = recomputePrimaryClaims({
    settlements: [seedSettlement],
    colonistSettings: current.colonistSettings,
    gridWidth: doc.gridWidth,
    gridHeight: doc.gridHeight,
    movementCost: doc.movementCost,
  })
  const primaryClaim = serializeClaimMap(claimMap)
  const claimedCells = primaryClaim[seedSettlement.id] ?? [{ x: landing.x, y: landing.y }]

  const { settlement } = applySurvivalResolveToSettlement({
    settlement: seedSettlement,
    claimedCells,
    colonistSettings: current.colonistSettings,
    worldDocument: doc,
    saltSpoilageMultiplier: saltSpoilageMultiplier(claimedCells, doc.saltNodes),
  })

  const historyEntry = {
    kind: 'founding',
    epoch: 0,
    foundingLanding: { ...landing },
    colonistSettings: {
      threeDayHaulDistance: current.colonistSettings.threeDayHaulDistance,
      startingPopulation: current.colonistSettings.startingPopulation,
      yieldModifier: current.colonistSettings.yieldModifier,
      epochBatch: current.colonistSettings.epochBatch,
    },
  }

  const ruined = applyRuinTransitions({
    settlements: [settlement],
    primaryClaim,
    historyLog: [historyEntry],
    epoch: 0,
  })

  const foundingDynasty = createFoundingDynasty({
    settlementId: settlement.id,
    landing,
    worldDocument: doc,
  })

  const withCollapse = applyPopulationCollapse(
    {
      ...current,
      colonizationPhase: COLONIZATION_PHASE_RUNNING,
      epoch: 0,
      settlements: ruined.settlements,
      historyLog: ruined.historyLog,
      primaryClaim: ruined.primaryClaim,
      notableFigures: [foundingDynasty],
      realmId: `realm-${doc.geographySeed ?? 0}-${landing.x}-${landing.y}`,
    },
    doc,
  )

  /** @type {object[]} */
  const committedTips = [
    {
      epoch: 0,
      settlements: ruined.settlements.map((row) => ({ ...row })),
      foundingLanding: { ...landing },
      colonistSettings: { ...current.colonistSettings },
      historyLog: ruined.historyLog.map((row) => ({ ...row })),
      claimMap: { ...primaryClaim },
    },
  ]

  for (const event of ruined.events) {
    committedTips.push({
      epoch: 0,
      settlements: ruined.settlements.map((row) => ({ ...row })),
      foundingLanding: { ...landing },
      colonistSettings: { ...current.colonistSettings },
      historyLog: ruined.historyLog.map((row) => ({ ...row })),
      claimMap: event.claimMap,
      eventKind: event.kind,
    })
  }

  return {
    ...withCollapse,
    committedTips,
  }
}
