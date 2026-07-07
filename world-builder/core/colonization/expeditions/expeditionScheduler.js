import { isFrontierExhausted, patchLogisticsNodeSurvey, resolveLogisticsNodeSurvey } from '../logisticsNodes/scoreLogisticsNodes.js'
import { computeFrontierBoundaryEdges } from '../frontier/computeFrontierBoundaryEdges.js'
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
 * @property {(payload: NetworkSubstepHookPayload) => void} [onNetworkSubstep]
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
 */

/** @typedef {NetworkSubstepLifecyclePayload | NetworkSubstepItemPayload} NetworkSubstepHookPayload */

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
 */
function emitNetworkSubstepItem(hooks, substepIndex, substepId, itemIndex, itemCount) {
  hooks?.onNetworkSubstep?.({
    type: 'substep-item',
    substepIndex,
    substepId,
    itemIndex,
    itemCount,
  })
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

  emitNetworkSubstep(hooks, 'substep-start', 0, 'frontier')
  await yieldToUi?.()
  const frontierExhausted = isFrontierExhausted(currentSlice.logisticsNodeSurvey ?? [])
  emitNetworkSubstep(hooks, 'substep-complete', 0, 'frontier')
  await yieldToUi?.()

  emitNetworkSubstep(hooks, 'substep-start', 1, 'dispatch')
  await yieldToUi?.()
  currentSlice = await dispatchExpeditions(
    currentSlice,
    currentDoc,
    geographySeed,
    nextEpoch,
    frontierExhausted,
    yieldToUi,
    hooks,
  )
  emitNetworkSubstep(hooks, 'substep-complete', 1, 'dispatch')
  await yieldToUi?.()

  emitNetworkSubstep(hooks, 'substep-start', 2, 'advance')
  await yieldToUi?.()
  const advanced = await advanceActiveExpeditionsAsync({
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

  emitNetworkSubstep(hooks, 'substep-start', 0, 'frontier')
  const frontierExhausted = isFrontierExhausted(currentSlice.logisticsNodeSurvey ?? [])
  emitNetworkSubstep(hooks, 'substep-complete', 0, 'frontier')

  emitNetworkSubstep(hooks, 'substep-start', 1, 'dispatch')
  currentSlice = dispatchExpeditionsSync(
    currentSlice,
    currentDoc,
    geographySeed,
    nextEpoch,
    frontierExhausted,
  )
  emitNetworkSubstep(hooks, 'substep-complete', 1, 'dispatch')

  emitNetworkSubstep(hooks, 'substep-start', 2, 'advance')
  const advanced = advanceActiveExpeditions({
    slice: currentSlice,
    worldDocument: currentDoc,
    epoch: nextEpoch,
    roadCellMask,
  })
  currentSlice = advanced.slice
  currentDoc = advanced.worldDocument
  foundingEvents.push(...advanced.foundingEvents)
  emitNetworkSubstep(hooks, 'substep-complete', 2, 'advance')

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
 * @param {boolean} frontierExhausted
 */
function dispatchExpeditionsSync(slice, doc, geographySeed, epoch, frontierExhausted) {
  return dispatchExpeditionsWithBudget(slice, doc, geographySeed, epoch, frontierExhausted)
}

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} doc
 * @param {number} geographySeed
 * @param {number} epoch
 * @param {boolean} frontierExhausted
 * @param {(() => Promise<void>) | undefined} [yieldToUi]
 */
async function dispatchExpeditions(slice, doc, geographySeed, epoch, frontierExhausted, yieldToUi, hooks) {
  await yieldToUi?.()
  return dispatchExpeditionsWithBudgetAsync(
    slice,
    doc,
    geographySeed,
    epoch,
    frontierExhausted,
    hooks,
    yieldToUi,
  )
}

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} doc
 * @param {number} geographySeed
 * @param {number} epoch
 * @param {boolean} frontierExhausted
 */
function dispatchExpeditionsWithBudget(slice, doc, geographySeed, epoch, frontierExhausted) {
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
  const maritimeFrontierEdges = computeFrontierBoundaryEdges(
    visitRaster,
    sailMask,
    doc.gridWidth,
    doc.gridHeight,
  )

  const living = livingSettlements(slice.settlements)
  const totalPopulation = living.reduce(
    (sum, settlement) => sum + (Number.isFinite(settlement.population) ? settlement.population : 0),
    0,
  )

  /** @type {import('./evaluateFrontierEligibility.js').FrontierEligibleSender[]} */
  const eligibleSenders = []
  let eligiblePortCount = 0

  for (const settlement of living) {
    if (getActiveExpeditionForSettlement({ expeditions }, settlement.id)) {
      continue
    }

    const maritimeRole = classifySettlementMaritimeRole(doc, settlement)
    const entries = evaluateFrontierEligibility({
      settlement,
      doc,
      visitRaster,
      colonistSettings: slice.colonistSettings,
      roadCellMask,
    })
    eligibleSenders.push(...entries)

    if (
      isPortSettlement(maritimeRole) &&
      entries.some((entry) => entry.pool === 'maritime') &&
      maritimeFrontierEdges > 0
    ) {
      eligiblePortCount += 1
    }
  }

  const budget = computeRealmExpeditionBudget({
    totalPopulation,
    landFrontierEdges,
    maritimeFrontierEdges,
    frontierExhausted,
    eligiblePortCount,
  })

  const assignments = allocateExpeditionSlots({
    landSlots: budget.landSlots,
    maritimeSlots: budget.maritimeSlots,
    senders: eligibleSenders,
    geographySeed,
    epoch,
  })

  for (const assignment of assignments) {
    const settlement = living.find((entry) => entry.id === assignment.settlementId)
    if (!settlement) continue

    const planned = planExpeditionDispatchForAssignment(assignment, {
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

  return { ...slice, expeditions, frontierExhausted }
}

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} doc
 * @param {number} geographySeed
 * @param {number} epoch
 * @param {boolean} frontierExhausted
 * @param {ExpeditionNetworkPhaseHooks | undefined} hooks
 * @param {(() => Promise<void>) | undefined} yieldToUi
 */
async function dispatchExpeditionsWithBudgetAsync(
  slice,
  doc,
  geographySeed,
  epoch,
  frontierExhausted,
  hooks,
  yieldToUi,
) {
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
  const maritimeFrontierEdges = computeFrontierBoundaryEdges(
    visitRaster,
    sailMask,
    doc.gridWidth,
    doc.gridHeight,
  )

  const living = livingSettlements(slice.settlements)
  const totalPopulation = living.reduce(
    (sum, settlement) => sum + (Number.isFinite(settlement.population) ? settlement.population : 0),
    0,
  )

  /** @type {import('./evaluateFrontierEligibility.js').FrontierEligibleSender[]} */
  const eligibleSenders = []
  let eligiblePortCount = 0
  const settlementItemCount = living.length

  for (let settlementIndex = 0; settlementIndex < living.length; settlementIndex += 1) {
    emitNetworkSubstepItem(hooks, 1, 'dispatch', settlementIndex + 1, settlementItemCount)
    await yieldToUi?.()

    const settlement = living[settlementIndex]
    if (getActiveExpeditionForSettlement({ expeditions }, settlement.id)) {
      continue
    }

    const maritimeRole = classifySettlementMaritimeRole(doc, settlement)
    const entries = evaluateFrontierEligibility({
      settlement,
      doc,
      visitRaster,
      colonistSettings: slice.colonistSettings,
      roadCellMask,
    })
    eligibleSenders.push(...entries)

    if (
      isPortSettlement(maritimeRole) &&
      entries.some((entry) => entry.pool === 'maritime') &&
      maritimeFrontierEdges > 0
    ) {
      eligiblePortCount += 1
    }
  }

  const budget = computeRealmExpeditionBudget({
    totalPopulation,
    landFrontierEdges,
    maritimeFrontierEdges,
    frontierExhausted,
    eligiblePortCount,
  })

  const assignments = allocateExpeditionSlots({
    landSlots: budget.landSlots,
    maritimeSlots: budget.maritimeSlots,
    senders: eligibleSenders,
    geographySeed,
    epoch,
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
      roadCellMask,
    })
    if (planned) {
      expeditions.push(planned)
    }
  }

  return { ...slice, expeditions, frontierExhausted }
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

/**
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: import('../../types.js').WorldDocument,
 *   epoch: number,
 *   roadCellMask: Uint8Array,
 *   hooks?: ExpeditionNetworkPhaseHooks,
 *   yieldToUi?: () => Promise<void>,
 * }} params
 */
async function advanceActiveExpeditionsAsync(params) {
  const { slice, worldDocument, epoch, roadCellMask, hooks, yieldToUi } = params
  let currentSlice = { ...slice }
  let currentDoc = { ...worldDocument }
  /** @type {object[]} */
  const foundingEvents = []
  /** @type {import('./expeditionConstants.js').ExpeditionRecord[]} */
  const nextExpeditions = []

  const dryLandMask = buildDryLandTraversableMask(currentDoc)
  const sailMask = resolveSailTraversableMask(currentDoc)
  const expeditions = resolveExpeditions(slice.expeditions)
  const expeditionItemCount = expeditions.length

  for (let expeditionIndex = 0; expeditionIndex < expeditions.length; expeditionIndex += 1) {
    emitNetworkSubstepItem(hooks, 2, 'advance', expeditionIndex + 1, expeditionItemCount)
    await yieldToUi?.()

    const expedition = expeditions[expeditionIndex]
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
