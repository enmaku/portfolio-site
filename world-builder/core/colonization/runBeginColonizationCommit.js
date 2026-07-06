import { applyPopulationCollapse } from './applyPopulationCollapse.js'
import { applyRuinTransitions } from './applyRuin.js'
import { createFoundingDynasty } from './createFoundingDynasty.js'
import { recomputePrimaryClaims, serializeClaimMap } from './computePrimaryClaimMap.js'
import { applySurvivalResolveToSettlement } from './resolveSurvivalTriad.js'
import { saltSpoilageMultiplier } from './saltSpoilageMultiplier.js'
import { scoreLogisticsNodes } from './logisticsNodes/scoreLogisticsNodes.js'
import { seedSettlementHaulShedVisited } from './expeditions/foundDaughterSettlement.js'
import {
  COLONIZATION_PHASE_RUNNING,
  cloneColonizationSlice,
} from './createDefaultColonizationSlice.js'
import { COLONIZATION_BEGIN_STEPS } from './colonizationBeginSteps.js'
import {
  createInitialBeginColonizationProgress,
  reduceBeginColonizationProgressOnRunComplete,
  reduceBeginColonizationProgressOnStepComplete,
  reduceBeginColonizationProgressOnStepStart,
  yieldBeginColonizationProgressToUi,
} from './beginColonizationProgress.js'

/** @typedef {import('./beginColonizationProgress.js').BeginColonizationProgressState} BeginColonizationProgressState */

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} current
 * @param {import('../types.js').WorldDocument} doc
 * @returns {import('./createDefaultColonizationSlice.js').ColonizationSlice}
 */
export function executeBeginColonizationCommitStepsSync(current, doc) {
  const landing = current.foundingLanding
  if (!landing) {
    return current
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
      landExpeditionRange: current.colonistSettings.landExpeditionRange,
      sailExpeditionRange: current.colonistSettings.sailExpeditionRange,
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

  const logisticsNodeSurvey = scoreLogisticsNodes(doc)
  const visitedCells = seedSettlementHaulShedVisited(
    { ...current, colonistSettings: current.colonistSettings },
    doc,
    landing,
  )

  const { slice: withCollapse } = applyPopulationCollapse(
    {
      ...current,
      colonizationPhase: COLONIZATION_PHASE_RUNNING,
      epoch: 0,
      settlements: ruined.settlements,
      historyLog: ruined.historyLog,
      primaryClaim: ruined.primaryClaim,
      notableFigures: [foundingDynasty],
      realmId: `realm-${doc.geographySeed ?? 0}-${landing.x}-${landing.y}`,
      visitedCells,
      expeditions: [],
      frontierExhausted: false,
      roads: [],
      logisticsNodeSurvey,
    },
    doc,
  )

  return withCollapse
}

/**
 * @typedef {Object} RunBeginColonizationCommitHandlers
 * @property {(progress: BeginColonizationProgressState) => void} [onProgress]
 */

/**
 * @typedef {Object} RunBeginColonizationCommitOptions
 * @property {RunBeginColonizationCommitHandlers} [handlers]
 * @property {() => Promise<void>} [yieldToUi]
 */

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} current
 * @param {import('../types.js').WorldDocument} doc
 * @param {{
 *   onStepStart?: (stepIndex: number) => void | Promise<void>,
 *   onStepComplete?: (stepIndex: number) => void | Promise<void>,
 * }} hooks
 * @returns {Promise<import('./createDefaultColonizationSlice.js').ColonizationSlice>}
 */
async function executeBeginColonizationCommitStepsAsync(current, doc, hooks) {
  const landing = current.foundingLanding
  if (!landing) {
    return current
  }

  const runStep = async (stepIndex, fn) => {
    await hooks.onStepStart?.(stepIndex)
    const result = fn()
    await hooks.onStepComplete?.(stepIndex)
    return result
  }

  const seedSettlement = {
    id: `settlement-founding-${landing.x}-${landing.y}`,
    x: landing.x,
    y: landing.y,
    tier: /** @type {string | null} */ ('outpost'),
    population: current.colonistSettings.startingPopulation,
    status: 'living',
  }

  const claimMap = await runStep(0, () =>
    recomputePrimaryClaims({
      settlements: [seedSettlement],
      colonistSettings: current.colonistSettings,
      gridWidth: doc.gridWidth,
      gridHeight: doc.gridHeight,
      movementCost: doc.movementCost,
    }),
  )
  const primaryClaim = serializeClaimMap(claimMap)
  const claimedCells = primaryClaim[seedSettlement.id] ?? [{ x: landing.x, y: landing.y }]

  const { settlement } = await runStep(1, () =>
    applySurvivalResolveToSettlement({
      settlement: seedSettlement,
      claimedCells,
      colonistSettings: current.colonistSettings,
      worldDocument: doc,
      saltSpoilageMultiplier: saltSpoilageMultiplier(claimedCells, doc.saltNodes),
    }),
  )

  const historyEntry = {
    kind: 'founding',
    epoch: 0,
    foundingLanding: { ...landing },
    colonistSettings: {
      threeDayHaulDistance: current.colonistSettings.threeDayHaulDistance,
      startingPopulation: current.colonistSettings.startingPopulation,
      yieldModifier: current.colonistSettings.yieldModifier,
      epochBatch: current.colonistSettings.epochBatch,
      landExpeditionRange: current.colonistSettings.landExpeditionRange,
      sailExpeditionRange: current.colonistSettings.sailExpeditionRange,
    },
  }

  const ruined = await runStep(2, () =>
    applyRuinTransitions({
      settlements: [settlement],
      primaryClaim,
      historyLog: [historyEntry],
      epoch: 0,
    }),
  )

  const foundingDynasty = await runStep(3, () =>
    createFoundingDynasty({
      settlementId: settlement.id,
      landing,
      worldDocument: doc,
    }),
  )

  const logisticsNodeSurvey = await runStep(4, () => scoreLogisticsNodes(doc))

  const visitedCells = await runStep(5, () =>
    seedSettlementHaulShedVisited(
      { ...current, colonistSettings: current.colonistSettings },
      doc,
      landing,
    ),
  )

  const { slice: withCollapse } = await runStep(6, () =>
    applyPopulationCollapse(
      {
        ...current,
        colonizationPhase: COLONIZATION_PHASE_RUNNING,
        epoch: 0,
        settlements: ruined.settlements,
        historyLog: ruined.historyLog,
        primaryClaim: ruined.primaryClaim,
        notableFigures: [foundingDynasty],
        realmId: `realm-${doc.geographySeed ?? 0}-${landing.x}-${landing.y}`,
        visitedCells,
        expeditions: [],
        frontierExhausted: false,
        roads: [],
        logisticsNodeSurvey,
      },
      doc,
    ),
  )

  return runStep(7, () => withCollapse)
}

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} doc
 * @param {RunBeginColonizationCommitOptions} [options]
 * @returns {Promise<{
 *   slice: import('./createDefaultColonizationSlice.js').ColonizationSlice,
 *   committed: boolean,
 * }>}
 */
export async function runBeginColonizationCommit(slice, doc, options = {}) {
  if (slice.colonizationPhase !== 'setup' || !slice.foundingLanding) {
    return { slice, committed: false }
  }

  const yieldToUi = options.yieldToUi ?? yieldBeginColonizationProgressToUi
  const handlers = options.handlers ?? {}

  let progress = createInitialBeginColonizationProgress()
  handlers.onProgress?.(progress)
  await yieldToUi()

  const next = await executeBeginColonizationCommitStepsAsync(cloneColonizationSlice(slice), doc, {
    async onStepStart(stepIndex) {
      const step = COLONIZATION_BEGIN_STEPS[stepIndex]
      progress = reduceBeginColonizationProgressOnStepStart(progress, {
        stepIndex,
        label: step?.label ?? '',
      })
      handlers.onProgress?.(progress)
      await yieldToUi()
    },
    async onStepComplete(stepIndex) {
      progress = reduceBeginColonizationProgressOnStepComplete(progress, { stepIndex })
      handlers.onProgress?.(progress)
      await yieldToUi()
    },
  })

  progress = reduceBeginColonizationProgressOnRunComplete(progress)
  handlers.onProgress?.(progress)

  return { slice: next, committed: next.colonizationPhase === COLONIZATION_PHASE_RUNNING }
}
