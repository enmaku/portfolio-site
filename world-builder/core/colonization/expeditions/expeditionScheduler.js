import { isFrontierExhausted, patchLogisticsNodeSurvey, resolveLogisticsNodeSurvey } from '../logisticsNodes/scoreLogisticsNodes.js'
import { buildLandRouteCellMask, resolveRoadSegments } from '../roads/roadNetwork.js'
import {
  markCellsVisited,
  markVisitDisc,
  resolveVisitRaster,
} from '../visitStatus/visitRaster.js'
import {
  evaluateFirstViableCorridorCandidate,
  listCorridorFoundingCandidates,
} from './evaluateCorridorFounding.js'
import { LOGISTICS_NODE_VISIT_DISC_RADIUS } from './expeditionConstants.js'
import { advanceBearingExpedition } from './advanceBearingExpedition.js'
import { buildDryLandTraversableMask } from './buildDryLandTraversableMask.js'
import { foundDaughterSettlement } from './foundDaughterSettlement.js'
import { planExpeditionDispatch } from './planExpeditionDispatch.js'
import { resolveSailTraversableMask } from './expeditionRouting.js'
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

  const roadCellMask = buildLandRouteCellMask(
    currentSlice.roads,
    currentDoc.gridWidth,
    currentDoc.gridHeight,
  )

  /** @type {object[]} */
  const foundingEvents = []

  emitNetworkSubstep(hooks, 'substep-start', 0, 'dispatch')
  await yieldToUi?.()
  currentSlice = await dispatchExpeditions(currentSlice, currentDoc, geographySeed, nextEpoch, yieldToUi)
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

  const roadCellMask = buildLandRouteCellMask(
    currentSlice.roads,
    currentDoc.gridWidth,
    currentDoc.gridHeight,
  )

  /** @type {object[]} */
  const foundingEvents = []

  emitNetworkSubstep(hooks, 'substep-start', 0, 'dispatch')
  currentSlice = dispatchExpeditionsSync(currentSlice, currentDoc, geographySeed, nextEpoch)
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
 * @param {{
 *   settlement: { id: string, x: number, y: number },
 *   doc: import('../../types.js').WorldDocument,
 *   visitRaster: Uint8Array,
 *   geographySeed: number,
 *   epoch: number,
 *   roadCellMask: Uint8Array,
 * }} params
 * @returns {import('./expeditionConstants.js').ExpeditionRecord | null}
 */
function planExpeditionForSettlement(params) {
  return planExpeditionDispatch(params)
}

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} doc
 * @param {number} geographySeed
 * @param {number} epoch
 */
function dispatchExpeditionsSync(slice, doc, geographySeed, epoch) {
  const visitRaster = slice.visitedCells
  const roadCellMask = buildLandRouteCellMask(slice.roads, doc.gridWidth, doc.gridHeight)
  /** @type {import('./expeditionConstants.js').ExpeditionRecord[]} */
  const expeditions = [...resolveExpeditions(slice.expeditions)]

  for (const settlement of livingSettlements(slice.settlements)) {
    if (getActiveExpeditionForSettlement({ expeditions }, settlement.id)) {
      continue
    }

    const planned = planExpeditionForSettlement({
      settlement,
      doc,
      visitRaster,
      geographySeed,
      epoch,
      roadCellMask,
    })
    if (planned) {
      expeditions.push(planned)
    }
  }

  return { ...slice, expeditions }
}

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} doc
 * @param {number} geographySeed
 * @param {number} epoch
 * @param {(() => Promise<void>) | undefined} [yieldToUi]
 */
async function dispatchExpeditions(slice, doc, geographySeed, epoch, yieldToUi) {
  const visitRaster = slice.visitedCells
  const roadCellMask = buildLandRouteCellMask(slice.roads, doc.gridWidth, doc.gridHeight)
  /** @type {import('./expeditionConstants.js').ExpeditionRecord[]} */
  const expeditions = [...resolveExpeditions(slice.expeditions)]

  for (const settlement of livingSettlements(slice.settlements)) {
    await yieldToUi?.()

    if (getActiveExpeditionForSettlement({ expeditions }, settlement.id)) {
      continue
    }

    const planned = planExpeditionForSettlement({
      settlement,
      doc,
      visitRaster,
      geographySeed,
      epoch,
      roadCellMask,
    })
    if (planned) {
      expeditions.push(planned)
    }
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

  const dryLandMask = buildDryLandTraversableMask(currentDoc)
  const sailMask = resolveSailTraversableMask(currentDoc)

  for (const expedition of resolveExpeditions(slice.expeditions)) {
    if (expedition.status !== 'active') {
      nextExpeditions.push(expedition)
      continue
    }

    const advanced = advanceBearingExpedition({
      expedition,
      doc: currentDoc,
      colonistSettings: slice.colonistSettings,
      dryLandMask,
      sailMask,
      visitRaster: currentSlice.visitedCells,
      roadCellMask,
    })

    markCellsVisited(currentSlice.visitedCells, advanced.traveledCells, currentDoc.gridWidth)

    const updated = advanced.expedition
    const tip = updated.route[updated.progressIndex]
    if (tip) {
      const node = (currentSlice.logisticsNodeSurvey ?? []).find(
        (entry) => entry.x === tip.x && entry.y === tip.y,
      )
      if (node) {
        markVisitDisc(
          currentSlice.visitedCells,
          tip.x,
          tip.y,
          currentDoc.gridWidth,
          currentDoc.gridHeight,
          LOGISTICS_NODE_VISIT_DISC_RADIUS,
        )
      }
    }

    const candidates = tip
      ? listCorridorFoundingCandidates([tip], currentSlice.logisticsNodeSurvey ?? [])
      : []
    const evaluation = evaluateFirstViableCorridorCandidate(
      candidates,
      currentSlice.settlements,
      currentSlice.colonistSettings,
      currentDoc,
      currentSlice.roads,
      expedition.mode,
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
        expeditionRoute: updated.route,
        progressIndex: updated.progressIndex,
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
        epoch,
      })
      nextExpeditions.push({
        ...updated,
        status: 'completed',
        endReason: 'founded',
      })
      continue
    }

    nextExpeditions.push(updated)
  }

  return {
    slice: { ...currentSlice, expeditions: nextExpeditions },
    worldDocument: currentDoc,
    foundingEvents,
  }
}
