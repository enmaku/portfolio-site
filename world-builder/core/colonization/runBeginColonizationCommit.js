import { applyPopulationCollapse } from './applyPopulationCollapse.js'
import { applyRuinTransitions } from './applyRuin.js'
import { createFoundingDynasty } from './createFoundingDynasty.js'
import { recomputePrimaryClaims, serializeClaimMap } from './computePrimaryClaimMap.js'
import { applySurvivalResolveToSettlement } from './resolveSurvivalTriad.js'
import { saltSpoilageMultiplier } from './saltSpoilageMultiplier.js'
import { scoreLogisticsNodes } from './logisticsNodes/scoreLogisticsNodes.js'
import { classifySettlementMaritimeRole } from './expeditions/classifySettlementMaritimeRole.js'
import { computeClaimProduction } from '../economy/founding/computeClaimProduction.js'
import { runTradeClearingSync } from '../economy/tradeClearing/runTradeClearing.js'
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
} from './beginColonizationProgress.js'

/** @typedef {import('./beginColonizationProgress.js').BeginColonizationProgressState} BeginColonizationProgressState */

/**
 * @typedef {Object} BeginCommitContext
 * @property {import('./createDefaultColonizationSlice.js').ColonizationSlice} current
 * @property {import('../types.js').WorldDocument} doc
 * @property {{ x: number, y: number }} landing
 * @property {object} [seedSettlement]
 * @property {ReturnType<typeof serializeClaimMap>} [primaryClaim]
 * @property {Array<{ x: number, y: number }>} [claimedCells]
 * @property {{ foodLb: number, saltLb: number } | null} [foundingDelivered]
 * @property {Record<string, number> | undefined} [foundingExternalTradeAccounts]
 * @property {object} [settlement]
 * @property {object} [historyEntry]
 * @property {{ settlements: object[], historyLog: object[], primaryClaim: ReturnType<typeof serializeClaimMap>, events?: object[] }} [ruined]
 * @property {object} [foundingDynasty]
 * @property {object} [logisticsNodeSurvey]
 * @property {Uint8Array} [visitedCells]
 * @property {() => Promise<void>} [yieldToUi]
 * @property {import('./createDefaultColonizationSlice.js').ColonizationSlice} [result]
 */

/**
 * @typedef {Object} BeginCommitStep
 * @property {import('./colonizationBeginSteps.js').ColonizationBeginStepId} id
 * @property {(ctx: BeginCommitContext) => void | Promise<void>} run
 */

/** @type {ReadonlyArray<BeginCommitStep>} */
const BEGIN_COMMIT_PIPELINE = Object.freeze([
  {
    id: 'claims',
    run(ctx) {
      ctx.seedSettlement = {
        id: `settlement-founding-${ctx.landing.x}-${ctx.landing.y}`,
        x: ctx.landing.x,
        y: ctx.landing.y,
        tier: /** @type {string | null} */ ('outpost'),
        population: ctx.current.colonistSettings.startingPopulation,
        status: 'living',
        mapNumber: 1,
        maritimeRole: classifySettlementMaritimeRole(ctx.doc, ctx.landing),
      }
      const claimMap = recomputePrimaryClaims({
        settlements: [ctx.seedSettlement],
        colonistSettings: ctx.current.colonistSettings,
        gridWidth: ctx.doc.gridWidth,
        gridHeight: ctx.doc.gridHeight,
        movementCost: ctx.doc.movementCost,
      })
      ctx.primaryClaim = serializeClaimMap(claimMap)
      ctx.claimedCells =
        ctx.primaryClaim[ctx.seedSettlement.id] ?? [{ x: ctx.landing.x, y: ctx.landing.y }]
    },
  },
  {
    id: 'trade',
    run(ctx) {
      const offMap = resolveFoundingPortOffMapDelivery(ctx)
      ctx.foundingDelivered = offMap?.delivered ?? null
      ctx.foundingExternalTradeAccounts = offMap?.externalTradeAccounts
    },
  },
  {
    id: 'survival',
    run(ctx) {
      const { settlement } = applySurvivalResolveToSettlement({
        settlement: ctx.seedSettlement,
        claimedCells: ctx.claimedCells,
        colonistSettings: ctx.current.colonistSettings,
        worldDocument: ctx.doc,
        saltSpoilageMultiplier: saltSpoilageMultiplier(ctx.claimedCells, ctx.doc.saltNodes),
        deliveredFoodLb: ctx.foundingDelivered?.foodLb,
        deliveredSaltLb: ctx.foundingDelivered?.saltLb,
      })
      ctx.settlement = settlement
      ctx.historyEntry = {
        kind: 'founding',
        epoch: 0,
        foundingLanding: { ...ctx.landing },
        colonistSettings: {
          threeDayHaulDistance: ctx.current.colonistSettings.threeDayHaulDistance,
          startingPopulation: ctx.current.colonistSettings.startingPopulation,
          peoplePerHabitableCell: ctx.current.colonistSettings.peoplePerHabitableCell,
          populationDensity: ctx.current.colonistSettings.populationDensity,
          yieldModifier: ctx.current.colonistSettings.yieldModifier,
          landExpeditionRange: ctx.current.colonistSettings.landExpeditionRange,
          inlandSailExpeditionRange: ctx.current.colonistSettings.inlandSailExpeditionRange,
          openSeaExpeditionRange: ctx.current.colonistSettings.openSeaExpeditionRange,
        },
      }
    },
  },
  {
    id: 'ruin',
    run(ctx) {
      ctx.ruined = applyRuinTransitions({
        settlements: [ctx.settlement],
        primaryClaim: ctx.primaryClaim,
        historyLog: [ctx.historyEntry],
        epoch: 0,
      })
    },
  },
  {
    id: 'dynasty',
    run(ctx) {
      ctx.foundingDynasty = createFoundingDynasty({
        settlementId: ctx.settlement.id,
        landing: ctx.landing,
        worldDocument: ctx.doc,
      })
    },
  },
  {
    id: 'logistics',
    run(ctx) {
      ctx.logisticsNodeSurvey = scoreLogisticsNodes(ctx.doc)
    },
  },
  {
    id: 'visited',
    run(ctx) {
      ctx.visitedCells = seedSettlementHaulShedVisited(
        { ...ctx.current, colonistSettings: ctx.current.colonistSettings },
        ctx.doc,
        ctx.landing,
      )
    },
  },
  {
    id: 'collapse',
    async run(ctx) {
      const { slice } = await applyPopulationCollapse(
        {
          ...ctx.current,
          colonizationPhase: COLONIZATION_PHASE_RUNNING,
          epoch: 0,
          settlements: ctx.ruined.settlements,
          historyLog: ctx.ruined.historyLog,
          primaryClaim: ctx.ruined.primaryClaim,
          notableFigures: [ctx.foundingDynasty],
          realmId: `realm-${ctx.doc.geographySeed ?? 0}-${ctx.landing.x}-${ctx.landing.y}`,
          visitedCells: ctx.visitedCells,
          expeditions: [],
          frontierExhausted: false,
          roads: [],
          logisticsNodeSurvey: ctx.logisticsNodeSurvey,
          externalTradeAccounts:
            ctx.foundingExternalTradeAccounts ?? ctx.current.externalTradeAccounts,
        },
        ctx.doc,
        { yieldToUi: ctx.yieldToUi },
      )
      ctx.result = slice
    },
  },
  {
    id: 'commit',
    run() {
      // result already assigned in collapse; commit is the progress chip for "done"
    },
  },
])

/**
 * Founding port off-map trade before its first survival resolve: local exports earn
 * external credit that funds same-commit food or salt imports (export-first). Non-port
 * foundings return null so survival resolves against local production only.
 *
 * @param {BeginCommitContext} ctx
 * @returns {{ delivered: { foodLb: number, saltLb: number }, externalTradeAccounts: Record<string, number> } | null}
 */
function resolveFoundingPortOffMapDelivery(ctx) {
  const seedSettlement = ctx.seedSettlement
  if (!seedSettlement) {
    return null
  }
  const maritimeRole = classifySettlementMaritimeRole(ctx.doc, {
    x: ctx.landing.x,
    y: ctx.landing.y,
  })
  if (maritimeRole !== 'port') {
    return null
  }

  const production = computeClaimProduction({
    settlementId: seedSettlement.id,
    claimedCells: ctx.claimedCells ?? [],
    worldDocument: ctx.doc,
    yieldModifier: ctx.current.colonistSettings.yieldModifier,
    populationDensity: ctx.current.colonistSettings.populationDensity,
  })
  const result = runTradeClearingSync({
    settlements: [{ id: seedSettlement.id, population: seedSettlement.population, maritimeRole }],
    graph: { edges: [] },
    production: { [seedSettlement.id]: production },
    offMapShippingCost: ctx.current.colonistSettings.offMapShippingCost,
    externalAccountsCp: {},
  })
  const delivered = result.effectiveDelivered[seedSettlement.id]
  if (!delivered) {
    return null
  }
  /** @type {Record<string, number>} */
  const externalTradeAccounts = {}
  for (const [id, delta] of Object.entries(result.externalAccountDeltas)) {
    externalTradeAccounts[id] = Math.max(0, delta)
  }
  return { delivered, externalTradeAccounts }
}

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} current
 * @param {import('../types.js').WorldDocument} doc
 * @param {{
 *   onStepStart?: (stepIndex: number) => void | Promise<void>,
 *   onStepComplete?: (stepIndex: number) => void | Promise<void>,
 *   yieldToUi?: () => Promise<void>,
 * }} [hooks]
 * @returns {Promise<import('./createDefaultColonizationSlice.js').ColonizationSlice>}
 */
export async function executeBeginColonizationCommitSteps(current, doc, hooks = {}) {
  const landing = current.foundingLanding
  if (!landing) {
    return current
  }

  /** @type {BeginCommitContext} */
  const ctx = { current, doc, landing, yieldToUi: hooks.yieldToUi }

  for (let stepIndex = 0; stepIndex < BEGIN_COMMIT_PIPELINE.length; stepIndex += 1) {
    const step = BEGIN_COMMIT_PIPELINE[stepIndex]
    await hooks.onStepStart?.(stepIndex)
    await step.run(ctx)
    await hooks.onStepComplete?.(stepIndex)
  }

  return ctx.result ?? current
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

  const yieldToUi = options.yieldToUi ?? (async () => {})
  const handlers = options.handlers ?? {}

  let progress = createInitialBeginColonizationProgress()
  handlers.onProgress?.(progress)
  await yieldToUi()

  const next = await executeBeginColonizationCommitSteps(cloneColonizationSlice(slice), doc, {
    yieldToUi,
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
