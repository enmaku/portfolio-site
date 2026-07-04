import { createSeededRandom, deriveFieldSeed } from '../../noise/seededRandom.js'
import { isFrontierExhausted, patchLogisticsNodeSurvey, resolveLogisticsNodeSurvey } from '../logisticsNodes/scoreLogisticsNodes.js'
import { buildRoadCellMask, resolveRoadSegments } from '../roads/roadNetwork.js'
import {
  markCellsVisited,
  markVisitDisc,
  resolveVisitRaster,
} from '../visitStatus/visitRaster.js'
import {
  evaluateFirstViableCorridorCandidate,
  listCorridorFoundingCandidates,
} from './evaluateCorridorFounding.js'
import {
  EXPEDITION_DISPATCH_BASE_PROBABILITY,
  FRONTIER_EXHAUSTED_DISPATCH_MULTIPLIER,
  LOGISTICS_NODE_VISIT_DISC_RADIUS,
} from './expeditionConstants.js'
import {
  advanceRouteProgress,
  buildCorridorCells,
  chooseLowestTravelTimeRoute,
  routeCellsUpToProgress,
} from './expeditionRouting.js'
import { foundDaughterSettlement } from './foundDaughterSettlement.js'
import { createExpeditionRouteContext } from './expeditionRouteContext.js'
import { pickExplorationTarget } from './pickExplorationTarget.js'
import {
  getActiveExpeditionForSettlement,
  livingSettlements,
  resolveExpeditions,
} from './expeditionConstants.js'

/**
 * @typedef {Object} NetworkPhaseResult
 * @property {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @property {import('../../types.js').WorldDocument} worldDocument
 * @property {object[]} foundingEvents
 */

/**
 * @typedef {Object} ExpeditionNetworkPhaseHooks
 * @property {(payload: { substepIndex: number, substepId: string, type: 'substep-start' | 'substep-complete' }) => void} [onNetworkSubstep]
 */

/**
 * @param {ExpeditionNetworkPhaseHooks | undefined} hooks
 * @param {'substep-start' | 'substep-complete'} type
 * @param {number} substepIndex
 * @param {string} substepId
 */
function emitNetworkSubstep(hooks, type, substepIndex, substepId) {
  hooks?.onNetworkSubstep?.({ type, substepIndex, substepId })
}

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} worldDocument
 * @param {{ hooks?: ExpeditionNetworkPhaseHooks, yieldToUi?: () => Promise<void> }} options
 * @returns {Promise<NetworkPhaseResult>}
 */
async function runExpeditionNetworkPhase(slice, worldDocument, options = {}) {
  if (slice.colonizationPhase !== 'running') {
    return { slice, worldDocument, foundingEvents: [] }
  }

  const hooks = options.hooks
  const yieldToUi = options.yieldToUi
  const geographySeed = worldDocument.geographySeed ?? 0
  const nextEpoch = slice.epoch + 1
  let currentSlice = {
    ...slice,
    expeditions: resolveExpeditions(slice.expeditions),
    visitedCells: resolveVisitRaster(
      slice.visitedCells,
      worldDocument.gridWidth,
      worldDocument.gridHeight,
    ),
    roads: resolveRoadSegments(slice.roads),
    logisticsNodeSurvey: resolveLogisticsNodeSurvey(slice.logisticsNodeSurvey),
  }
  let currentDoc = { ...worldDocument }

  const roadCellMask = buildRoadCellMask(
    currentSlice.roads,
    currentDoc.gridWidth,
    currentDoc.gridHeight,
  )

  /** @type {object[]} */
  const foundingEvents = []

  emitNetworkSubstep(hooks, 'substep-start', 0, 'dispatch')
  await yieldToUi?.()
  currentSlice = dispatchExpeditions(currentSlice, currentDoc, geographySeed, nextEpoch)
  emitNetworkSubstep(hooks, 'substep-complete', 0, 'dispatch')
  await yieldToUi?.()

  emitNetworkSubstep(hooks, 'substep-start', 1, 'advance')
  await yieldToUi?.()
  const advanced = advanceActiveExpeditions({
    slice: currentSlice,
    worldDocument: currentDoc,
    epoch: nextEpoch,
    roadCellMask,
  })
  currentSlice = advanced.slice
  currentDoc = advanced.worldDocument
  foundingEvents.push(...advanced.foundingEvents)
  emitNetworkSubstep(hooks, 'substep-complete', 1, 'advance')
  await yieldToUi?.()

  emitNetworkSubstep(hooks, 'substep-start', 2, 'frontier')
  await yieldToUi?.()
  const frontierExhausted = isFrontierExhausted(currentSlice.logisticsNodeSurvey ?? [])
  emitNetworkSubstep(hooks, 'substep-complete', 2, 'frontier')
  await yieldToUi?.()

  return {
    slice: {
      ...currentSlice,
      frontierExhausted,
    },
    worldDocument: {
      ...currentDoc,
      visitedCells: currentSlice.visitedCells,
      roads: currentSlice.roads,
      logisticsNodeSurvey: currentSlice.logisticsNodeSurvey,
      frontierExhausted,
    },
    foundingEvents,
  }
}

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} worldDocument
 * @param {{ hooks?: ExpeditionNetworkPhaseHooks }} [options]
 * @returns {NetworkPhaseResult}
 */
export function applyExpeditionNetworkPhase(slice, worldDocument, options = {}) {
  if (slice.colonizationPhase !== 'running') {
    return { slice, worldDocument, foundingEvents: [] }
  }

  const hooks = options.hooks
  const geographySeed = worldDocument.geographySeed ?? 0
  const nextEpoch = slice.epoch + 1
  let currentSlice = {
    ...slice,
    expeditions: resolveExpeditions(slice.expeditions),
    visitedCells: resolveVisitRaster(
      slice.visitedCells,
      worldDocument.gridWidth,
      worldDocument.gridHeight,
    ),
    roads: resolveRoadSegments(slice.roads),
    logisticsNodeSurvey: resolveLogisticsNodeSurvey(slice.logisticsNodeSurvey),
  }
  let currentDoc = { ...worldDocument }

  const roadCellMask = buildRoadCellMask(
    currentSlice.roads,
    currentDoc.gridWidth,
    currentDoc.gridHeight,
  )

  /** @type {object[]} */
  const foundingEvents = []

  emitNetworkSubstep(hooks, 'substep-start', 0, 'dispatch')
  currentSlice = dispatchExpeditions(currentSlice, currentDoc, geographySeed, nextEpoch)
  emitNetworkSubstep(hooks, 'substep-complete', 0, 'dispatch')

  emitNetworkSubstep(hooks, 'substep-start', 1, 'advance')
  const advanced = advanceActiveExpeditions({
    slice: currentSlice,
    worldDocument: currentDoc,
    epoch: nextEpoch,
    roadCellMask,
  })
  currentSlice = advanced.slice
  currentDoc = advanced.worldDocument
  foundingEvents.push(...advanced.foundingEvents)
  emitNetworkSubstep(hooks, 'substep-complete', 1, 'advance')

  emitNetworkSubstep(hooks, 'substep-start', 2, 'frontier')
  const frontierExhausted = isFrontierExhausted(currentSlice.logisticsNodeSurvey ?? [])
  emitNetworkSubstep(hooks, 'substep-complete', 2, 'frontier')

  return {
    slice: {
      ...currentSlice,
      frontierExhausted,
    },
    worldDocument: {
      ...currentDoc,
      visitedCells: currentSlice.visitedCells,
      roads: currentSlice.roads,
      logisticsNodeSurvey: currentSlice.logisticsNodeSurvey,
      frontierExhausted,
    },
    foundingEvents,
  }
}

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} worldDocument
 * @param {{ hooks?: ExpeditionNetworkPhaseHooks, yieldToUi?: () => Promise<void> }} [options]
 * @returns {Promise<NetworkPhaseResult>}
 */
export function applyExpeditionNetworkPhaseAsync(slice, worldDocument, options = {}) {
  return runExpeditionNetworkPhase(slice, worldDocument, options)
}

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} doc
 * @param {number} geographySeed
 * @param {number} epoch
 */
function dispatchExpeditions(slice, doc, geographySeed, epoch) {
  const survey = slice.logisticsNodeSurvey ?? []
  const frontierExhausted = isFrontierExhausted(survey)
  const dispatchMultiplier = frontierExhausted ? FRONTIER_EXHAUSTED_DISPATCH_MULTIPLIER : 1
  const visitRaster = slice.visitedCells
  const explorationHorizon = slice.colonistSettings.threeDayHaulDistance
  const routeContext = createExpeditionRouteContext(doc)
  /** @type {import('./expeditionConstants.js').ExpeditionRecord[]} */
  const expeditions = [...resolveExpeditions(slice.expeditions)]

  for (const settlement of livingSettlements(slice.settlements)) {
    if (getActiveExpeditionForSettlement({ expeditions }, settlement.id)) {
      continue
    }
    const random = createSeededRandom(
      deriveFieldSeed(geographySeed, `expedition-dispatch-${epoch}-${settlement.id}`),
    )
    const populationBias = Math.min(0.25, (settlement.population ?? 0) / 1000)
    const dispatchProbability = Math.min(
      0.95,
      (EXPEDITION_DISPATCH_BASE_PROBABILITY + populationBias) * dispatchMultiplier,
    )
    if (random() > dispatchProbability) {
      continue
    }

    const target = pickExplorationTarget({
      doc,
      visitRaster,
      settlement,
      random,
      horizonCells: explorationHorizon,
    })
    if (!target) continue

    const routeChoice = chooseLowestTravelTimeRoute(
      doc,
      { x: settlement.x, y: settlement.y },
      target,
      routeContext,
    )
    if (!routeChoice || routeChoice.cells.length < 2) continue

    expeditions.push({
      id: `expedition-${epoch}-${settlement.id}-${target.x}-${target.y}`,
      settlementId: settlement.id,
      mode: routeChoice.mode,
      route: routeChoice.cells,
      progressIndex: 0,
      target,
      status: 'active',
    })
  }

  return { ...slice, expeditions }
}

/**
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: import('../../types.js').WorldDocument,
 *   epoch: number,
 *   roadCellMask: Uint8Array,
 *   geographySeed: number,
 * }} params
 */
function advanceActiveExpeditions(params) {
  const { slice, worldDocument, epoch, roadCellMask } = params
  let currentSlice = { ...slice }
  let currentDoc = { ...worldDocument }
  /** @type {object[]} */
  const foundingEvents = []
  /** @type {import('./expeditionConstants.js').ExpeditionRecord[]} */
  const nextExpeditions = []

  for (const expedition of resolveExpeditions(slice.expeditions)) {
    if (expedition.status !== 'active') {
      nextExpeditions.push(expedition)
      continue
    }

    const budget = slice.colonistSettings.threeDayHaulDistance
    const progressIndex = advanceRouteProgress(
      currentDoc,
      expedition.route,
      expedition.progressIndex,
      budget,
      expedition.mode,
      roadCellMask,
    )
    const traveled = routeCellsUpToProgress(expedition.route, progressIndex)
    markCellsVisited(currentSlice.visitedCells, traveled, currentDoc.gridWidth)

    for (const cell of traveled) {
      const node = (currentSlice.logisticsNodeSurvey ?? []).find(
        (entry) => entry.x === cell.x && entry.y === cell.y,
      )
      if (node) {
        markVisitDisc(
          currentSlice.visitedCells,
          cell.x,
          cell.y,
          currentDoc.gridWidth,
          currentDoc.gridHeight,
          LOGISTICS_NODE_VISIT_DISC_RADIUS,
        )
      }
    }

    const corridor = buildCorridorCells(
      traveled,
      currentDoc.gridWidth,
      currentDoc.gridHeight,
    )
    const candidates = listCorridorFoundingCandidates(
      corridor,
      currentSlice.logisticsNodeSurvey ?? [],
    )
    const evaluation = evaluateFirstViableCorridorCandidate(
      candidates,
      currentSlice.settlements,
      currentSlice.colonistSettings,
      currentDoc,
      currentSlice.roads,
    )

    if (evaluation && 'rejected' in evaluation) {
      currentSlice = {
        ...currentSlice,
        logisticsNodeSurvey: patchLogisticsNodeSurvey(
          currentSlice.logisticsNodeSurvey ?? [],
          evaluation.rejected.x,
          evaluation.rejected.y,
          { exhausted: true },
        ),
      }
    }

    if (evaluation && 'candidate' in evaluation) {
      const founded = foundDaughterSettlement({
        slice: currentSlice,
        worldDocument: currentDoc,
        candidate: evaluation.candidate,
        originSettlementId: expedition.settlementId,
        epoch,
        expeditionRoute: expedition.route,
        progressIndex,
        mode: expedition.mode,
      })
      currentSlice = {
        ...founded.slice,
        roads: founded.worldDocument.roads ?? founded.slice.roads,
        logisticsNodeSurvey:
          founded.worldDocument.logisticsNodeSurvey ?? founded.slice.logisticsNodeSurvey,
      }
      currentDoc = founded.worldDocument
      foundingEvents.push({
        kind: 'settlement_founded',
        retainTip: true,
        historyEntry: founded.historyEntry,
        epoch,
      })
      nextExpeditions.push({ ...expedition, progressIndex, status: 'completed' })
      continue
    }

    if (progressIndex >= expedition.route.length - 1) {
      nextExpeditions.push({ ...expedition, progressIndex, status: 'completed' })
    } else {
      nextExpeditions.push({ ...expedition, progressIndex, status: 'active' })
    }
  }

  return {
    slice: { ...currentSlice, expeditions: nextExpeditions },
    worldDocument: currentDoc,
    foundingEvents,
  }
}
