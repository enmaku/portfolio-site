import { isFrontierExhausted, patchLogisticsNodeSurvey, resolveLogisticsNodeSurvey } from '../logisticsNodes/scoreLogisticsNodes.js'
import { computeFrontierBoundaryEdges } from '../frontier/computeFrontierBoundaryEdges.js'
import { computeMaritimeExplorationFrontierEdges } from '../frontier/computeMaritimeExplorationFrontierEdges.js'
import { hasUnvisitedSailCells } from '../frontier/hasUnvisitedSailCells.js'
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
import { allocateExpeditionSlots } from './allocateExpeditionSlots.js'
import { buildDryLandTraversableMask } from './buildDryLandTraversableMask.js'
import { classifySettlementMaritimeRole, isPortSettlement } from './classifySettlementMaritimeRole.js'
import { computeRealmExpeditionBudget } from './computeRealmExpeditionBudget.js'
import { evaluateFrontierEligibility } from './evaluateFrontierEligibility.js'
import { foundDaughterSettlement } from './foundDaughterSettlement.js'
import { planExpeditionDispatchForAssignment } from './planExpeditionDispatch.js'
import { resolveSailTraversableMask } from './expeditionRouting.js'
import {
  computeMaxActiveExpeditionsPerSettlement,
  countActiveExpeditionsForSettlement,
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
 * @property {(payload: NetworkSubstepHookPayload) => void} [onNetworkSubstep]
 */

/**
 * @typedef {Object} ExpeditionNetworkPhaseOptions
 * @property {ExpeditionNetworkPhaseHooks} [hooks]
 * @property {() => Promise<void>} [yieldToUi]
 */

/**
 * @typedef {Object} NetworkSubstepLifecyclePayload
 * @property {'substep-start' | 'substep-complete'} type
 * @property {number} substepIndex
 * @property {string} substepId
 */

/**
 * @typedef {Object} NetworkSubstepItemPayload
 * @property {'substep-item'} type
 * @property {number} substepIndex
 * @property {string} substepId
 * @property {number} itemIndex one-based position in the substep loop
 * @property {number} itemCount total items in the substep loop
 * @property {string} [phase]
 * @property {number} [phasePercent]
 */

/** @typedef {NetworkSubstepLifecyclePayload | NetworkSubstepItemPayload} NetworkSubstepHookPayload */

/**
 * @typedef {Object} ExpeditionAdvanceState
 * @property {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @property {import('../../types.js').WorldDocument} worldDocument
 * @property {object[]} foundingEvents
 * @property {import('./expeditionConstants.js').ExpeditionRecord[]} nextExpeditions
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
 * @param {ExpeditionNetworkPhaseHooks | undefined} hooks
 * @param {number} substepIndex
 * @param {string} substepId
 * @param {number} itemIndex
 * @param {number} itemCount
 * @param {string} [phase]
 * @param {number} [phasePercent]
 */
function emitNetworkSubstepItem(
  hooks,
  substepIndex,
  substepId,
  itemIndex,
  itemCount,
  phase,
  phasePercent,
) {
  hooks?.onNetworkSubstep?.({
    type: 'substep-item',
    substepIndex,
    substepId,
    itemIndex,
    itemCount,
    phase,
    phasePercent,
  })
}

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} worldDocument
 * @returns {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: import('../../types.js').WorldDocument,
 *   roadCellMask: Uint8Array,
 * }}
 */
function prepareNetworkPhaseState(slice, worldDocument) {
  const currentSlice = {
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
  const currentDoc = { ...worldDocument }
  const roadCellMask = buildLandRouteCellMask(
    currentSlice.roads,
    currentDoc.gridWidth,
    currentDoc.gridHeight,
  )
  return { slice: currentSlice, worldDocument: currentDoc, roadCellMask }
}

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} worldDocument
 * @param {boolean} frontierExhausted
 * @param {object[]} foundingEvents
 * @returns {NetworkPhaseResult}
 */
function finalizeNetworkPhaseResult(slice, worldDocument, frontierExhausted, foundingEvents) {
  return {
    slice: {
      ...slice,
      frontierExhausted,
    },
    worldDocument: {
      ...worldDocument,
      visitedCells: slice.visitedCells,
      roads: slice.roads,
      logisticsNodeSurvey: slice.logisticsNodeSurvey,
      frontierExhausted,
    },
    foundingEvents,
  }
}

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} doc
 * @param {number} geographySeed
 * @param {number} epoch
 * @param {boolean} frontierExhausted
 * @param {{ hooks?: ExpeditionNetworkPhaseHooks, yieldToUi?: () => Promise<void> }} [options]
 * @returns {Promise<import('../createDefaultColonizationSlice.js').ColonizationSlice>}
 */
async function dispatchExpeditionsWithBudget(
  slice,
  doc,
  geographySeed,
  epoch,
  frontierExhausted,
  options = {},
) {
  const { hooks, yieldToUi } = options
  const visitRaster = slice.visitedCells
  const roadCellMask = buildLandRouteCellMask(slice.roads, doc.gridWidth, doc.gridHeight)
  /** @type {import('./expeditionConstants.js').ExpeditionRecord[]} */
  const expeditions = [...resolveExpeditions(slice.expeditions)]

  const dryLandMask = buildDryLandTraversableMask(doc)
  const sailMask = resolveSailTraversableMask(doc)
  const landFrontierEdges = computeFrontierBoundaryEdges(
    visitRaster,
    dryLandMask,
    doc.gridWidth,
    doc.gridHeight,
  )
  const maritimeFrontierEdges = computeMaritimeExplorationFrontierEdges(
    visitRaster,
    sailMask,
    doc.gridWidth,
    doc.gridHeight,
  )
  const unvisitedSailCellsRemain = hasUnvisitedSailCells(visitRaster, sailMask)
  const maritimeFrontierOpen = maritimeFrontierEdges > 0 || unvisitedSailCellsRemain

  const living = livingSettlements(slice.settlements)
  const maxActiveExpeditionsPerSettlement = computeMaxActiveExpeditionsPerSettlement(living.length)
  const totalPopulation = living.reduce(
    (sum, settlement) => sum + (Number.isFinite(settlement.population) ? settlement.population : 0),
    0,
  )

  /** @type {import('./evaluateFrontierEligibility.js').FrontierEligibleSender[]} */
  const eligibleSenders = []
  /** @type {Map<string, number>} */
  const remainingDispatchCapacity = new Map()
  let eligiblePortCount = 0
  const settlementItemCount = living.length

  for (let settlementIndex = 0; settlementIndex < living.length; settlementIndex += 1) {
    const itemIndex = settlementIndex + 1
    const settlement = living[settlementIndex]
    const activeExpeditionCount = countActiveExpeditionsForSettlement({ expeditions }, settlement.id)
    const remainingCapacity = maxActiveExpeditionsPerSettlement - activeExpeditionCount
    if (remainingCapacity <= 0) {
      emitNetworkSubstepItem(hooks, 1, 'dispatch', itemIndex, settlementItemCount)
      await yieldToUi?.()
      continue
    }

    const maritimeRole = classifySettlementMaritimeRole(doc, settlement)
    const entry = evaluateFrontierEligibility({
      settlement,
      doc,
      dryLandMask,
      landFrontierEdges,
      maritimeFrontierEdges,
      maritimeFrontierOpen: unvisitedSailCellsRemain,
      maritimeRole,
    })
    if (entry) {
      eligibleSenders.push(entry)
      remainingDispatchCapacity.set(settlement.id, remainingCapacity)
    }
    emitNetworkSubstepItem(hooks, 1, 'dispatch', itemIndex, settlementItemCount)
    await yieldToUi?.()

    if (isPortSettlement(maritimeRole) && maritimeFrontierOpen) {
      eligiblePortCount += 1
    }
  }

  const budget = computeRealmExpeditionBudget({
    totalPopulation,
    landFrontierEdges,
    maritimeFrontierEdges,
    frontierExhausted,
    eligiblePortCount,
    hasUnvisitedSailCells: unvisitedSailCellsRemain,
  })

  const assignments = allocateExpeditionSlots({
    landSlots: budget.landSlots,
    maritimeSlots: budget.maritimeSlots,
    senders: eligibleSenders,
    geographySeed,
    epoch,
    remainingDispatchCapacity,
  })

  for (let assignmentIndex = 0; assignmentIndex < assignments.length; assignmentIndex += 1) {
    emitNetworkSubstepItem(hooks, 1, 'dispatch', assignmentIndex + 1, assignments.length)
    await yieldToUi?.()

    const assignment = assignments[assignmentIndex]
    const settlement = living.find((entry) => entry.id === assignment.settlementId)
    if (!settlement) continue

    const planned = planExpeditionDispatchForAssignment(assignment, {
      settlement,
      doc,
      visitRaster,
      geographySeed,
      epoch,
      assignmentIndex,
      roadCellMask,
    })
    if (planned) {
      expeditions.push(planned)
    }
  }

  return { ...slice, expeditions, frontierExhausted }
}

/**
 * @param {ExpeditionAdvanceState} state
 * @param {import('./expeditionConstants.js').ExpeditionRecord} expedition
 * @param {number} epoch
 * @param {Uint8Array} roadCellMask
 * @param {Uint8Array} dryLandMask
 * @param {Uint8Array} sailMask
 */
function processExpeditionAdvance(state, expedition, epoch, roadCellMask, dryLandMask, sailMask) {
  if (expedition.status !== 'active') {
    state.nextExpeditions.push(expedition)
    return
  }

  const advanced = advanceBearingExpedition({
    expedition,
    doc: state.worldDocument,
    colonistSettings: state.slice.colonistSettings,
    dryLandMask,
    sailMask,
    visitRaster: state.slice.visitedCells,
    roadCellMask,
  })

  markCellsVisited(state.slice.visitedCells, advanced.traveledCells, state.worldDocument.gridWidth)

  const updated = advanced.expedition
  const tip = updated.route[updated.progressIndex]
  if (tip) {
    const node = (state.slice.logisticsNodeSurvey ?? []).find(
      (entry) => entry.x === tip.x && entry.y === tip.y,
    )
    if (node) {
      markVisitDisc(
        state.slice.visitedCells,
        tip.x,
        tip.y,
        state.worldDocument.gridWidth,
        state.worldDocument.gridHeight,
        LOGISTICS_NODE_VISIT_DISC_RADIUS,
      )
    }
  }

  const candidates = tip
    ? listCorridorFoundingCandidates([tip], state.slice.logisticsNodeSurvey ?? [])
    : []
  const evaluation = evaluateFirstViableCorridorCandidate(
    candidates,
    state.slice.settlements,
    state.slice.colonistSettings,
    state.worldDocument,
    state.slice.roads,
    expedition.mode,
    expedition.settlementId,
  )

  if (evaluation && 'rejected' in evaluation) {
    state.slice = {
      ...state.slice,
      logisticsNodeSurvey: patchLogisticsNodeSurvey(
        state.slice.logisticsNodeSurvey ?? [],
        evaluation.rejected.x,
        evaluation.rejected.y,
        { exhausted: true },
      ),
    }
  }

  if (evaluation && 'candidate' in evaluation) {
    const founded = foundDaughterSettlement({
      slice: state.slice,
      worldDocument: state.worldDocument,
      candidate: evaluation.candidate,
      originSettlementId: expedition.settlementId,
      epoch,
      expeditionRoute: updated.route,
      progressIndex: updated.progressIndex,
      mode: expedition.mode,
    })
    state.slice = {
      ...founded.slice,
      roads: founded.worldDocument.roads ?? founded.slice.roads,
      logisticsNodeSurvey:
        founded.worldDocument.logisticsNodeSurvey ?? founded.slice.logisticsNodeSurvey,
    }
    state.worldDocument = founded.worldDocument
    state.foundingEvents.push({
      kind: 'settlement_founded',
      epoch,
    })
    state.nextExpeditions.push({
      ...updated,
      status: 'completed',
      endReason: 'founded',
    })
    return
  }

  state.nextExpeditions.push(updated)
}

/**
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: import('../../types.js').WorldDocument,
 *   epoch: number,
 *   roadCellMask: Uint8Array,
 *   hooks?: ExpeditionNetworkPhaseHooks,
 *   yieldToUi?: () => Promise<void>,
 * }} params
 * @returns {Promise<Pick<ExpeditionAdvanceState, 'slice' | 'worldDocument' | 'foundingEvents'>>}
 */
async function advanceActiveExpeditions(params) {
  const { slice, worldDocument, epoch, roadCellMask, hooks, yieldToUi } = params
  /** @type {ExpeditionAdvanceState} */
  const state = {
    slice: { ...slice },
    worldDocument: { ...worldDocument },
    foundingEvents: [],
    nextExpeditions: [],
  }

  const dryLandMask = buildDryLandTraversableMask(state.worldDocument)
  const sailMask = resolveSailTraversableMask(state.worldDocument)
  const expeditions = resolveExpeditions(slice.expeditions)
  const expeditionItemCount = expeditions.length

  for (let expeditionIndex = 0; expeditionIndex < expeditions.length; expeditionIndex += 1) {
    emitNetworkSubstepItem(hooks, 2, 'advance', expeditionIndex + 1, expeditionItemCount)
    await yieldToUi?.()

    processExpeditionAdvance(
      state,
      expeditions[expeditionIndex],
      epoch,
      roadCellMask,
      dryLandMask,
      sailMask,
    )
  }

  return {
    slice: { ...state.slice, expeditions: state.nextExpeditions },
    worldDocument: state.worldDocument,
    foundingEvents: state.foundingEvents,
  }
}

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} worldDocument
 * @param {{ hooks?: ExpeditionNetworkPhaseHooks, yieldToUi?: () => Promise<void> }} [options]
 * @returns {Promise<NetworkPhaseResult>}
 */
export async function applyExpeditionNetworkPhase(slice, worldDocument, options = {}) {
  if (slice.colonizationPhase !== 'running') {
    return { slice, worldDocument, foundingEvents: [] }
  }

  const hooks = options.hooks
  const yieldToUi = options.yieldToUi
  const geographySeed = worldDocument.geographySeed ?? 0
  const nextEpoch = slice.epoch + 1
  const prepared = prepareNetworkPhaseState(slice, worldDocument)
  let currentSlice = prepared.slice
  let currentDoc = prepared.worldDocument
  const roadCellMask = prepared.roadCellMask

  /** @type {object[]} */
  const foundingEvents = []

  emitNetworkSubstep(hooks, 'substep-start', 0, 'frontier')
  await yieldToUi?.()
  const frontierExhausted = isFrontierExhausted(currentSlice.logisticsNodeSurvey ?? [])
  emitNetworkSubstep(hooks, 'substep-complete', 0, 'frontier')
  await yieldToUi?.()

  emitNetworkSubstep(hooks, 'substep-start', 1, 'dispatch')
  await yieldToUi?.()
  currentSlice = await dispatchExpeditionsWithBudget(
    currentSlice,
    currentDoc,
    geographySeed,
    nextEpoch,
    frontierExhausted,
    { hooks, yieldToUi },
  )
  emitNetworkSubstep(hooks, 'substep-complete', 1, 'dispatch')
  await yieldToUi?.()

  emitNetworkSubstep(hooks, 'substep-start', 2, 'advance')
  await yieldToUi?.()
  const advanced = await advanceActiveExpeditions({
    slice: currentSlice,
    worldDocument: currentDoc,
    epoch: nextEpoch,
    roadCellMask,
    hooks,
    yieldToUi,
  })
  currentSlice = advanced.slice
  currentDoc = advanced.worldDocument
  foundingEvents.push(...advanced.foundingEvents)
  emitNetworkSubstep(hooks, 'substep-complete', 2, 'advance')
  await yieldToUi?.()

  return finalizeNetworkPhaseResult(currentSlice, currentDoc, frontierExhausted, foundingEvents)
}
