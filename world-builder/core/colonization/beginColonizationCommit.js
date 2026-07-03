import {
  COLONIZATION_PHASE_RUNNING,
  COLONIZATION_PHASE_SETUP,
  cloneColonizationSlice,
} from './createDefaultColonizationSlice.js'

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

  const settlement = {
    id: `settlement-founding-${landing.x}-${landing.y}`,
    x: landing.x,
    y: landing.y,
    tier: 'outpost',
    population: current.colonistSettings.startingPopulation,
    status: 'living',
  }

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

  const committedTip = {
    epoch: 0,
    settlements: [{ ...settlement }],
    foundingLanding: { ...landing },
    colonistSettings: { ...current.colonistSettings },
    historyLog: [{ ...historyEntry }],
  }

  return {
    ...current,
    colonizationPhase: COLONIZATION_PHASE_RUNNING,
    epoch: 0,
    settlements: [settlement],
    historyLog: [historyEntry],
    committedTips: [committedTip],
    realmId: `realm-${doc.geographySeed ?? 0}-${landing.x}-${landing.y}`,
  }
}
