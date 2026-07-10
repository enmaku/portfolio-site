import { resolveExpeditions } from '../expeditions/expeditionConstants.js'
import { LOGISTICS_NODE_VISIT_DISC_RADIUS } from '../expeditions/expeditionConstants.js'
import { buildCorridorCells, routeCellsUpToProgress } from '../expeditions/expeditionRouting.js'
import { buildLandRouteCellMask, resolveRoadSegments } from '../roads/roadNetwork.js'
import {
  createEmptyVisitRaster,
  markCellsVisited,
  markVisitDisc,
  seedHaulShedVisited,
} from './visitRaster.js'

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @returns {Array<{ x: number, y: number }>}
 */
function listSettlementsForVisitRaster(slice) {
  /** @type {Array<{ x: number, y: number }>} */
  const settlements = []
  for (const settlement of slice.settlements ?? []) {
    if (!Number.isFinite(settlement.x) || !Number.isFinite(settlement.y)) {
      continue
    }
    settlements.push({ x: settlement.x, y: settlement.y })
  }
  return settlements
}

/**
 * @param {unknown} survey
 * @returns {Map<string, { x: number, y: number }>}
 */
function buildLogisticsSurveyCellIndex(survey) {
  /** @type {Map<string, { x: number, y: number }>} */
  const index = new Map()
  if (!Array.isArray(survey)) {
    return index
  }
  for (const entry of survey) {
    if (!entry || !Number.isFinite(entry.x) || !Number.isFinite(entry.y)) {
      continue
    }
    index.set(`${entry.x},${entry.y}`, entry)
  }
  return index
}

/**
 * @param {Uint8Array} raster
 * @param {import('../expeditions/expeditionConstants.js').ExpeditionRecord} expedition
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {Map<string, { x: number, y: number }>} surveyByCell
 */
function markExpeditionVisitsOnRaster(raster, expedition, gridWidth, gridHeight, surveyByCell) {
  const traveled = routeCellsUpToProgress(expedition.route, expedition.progressIndex)
  markCellsVisited(raster, traveled, gridWidth)
  for (const cell of traveled) {
    if (!surveyByCell.has(`${cell.x},${cell.y}`)) {
      continue
    }
    markVisitDisc(
      raster,
      cell.x,
      cell.y,
      gridWidth,
      gridHeight,
      LOGISTICS_NODE_VISIT_DISC_RADIUS,
    )
  }
}

/**
 * @param {Uint8Array} raster
 * @param {{ cells?: Array<{ x: number, y: number }> }} segment
 * @param {number} gridWidth
 * @param {number} gridHeight
 */
function markRoadSegmentVisitsOnRaster(raster, segment, gridWidth, gridHeight) {
  if (!Array.isArray(segment.cells) || segment.cells.length === 0) {
    return
  }
  markCellsVisited(
    raster,
    buildCorridorCells(segment.cells, gridWidth, gridHeight),
    gridWidth,
  )
}

/**
 * @param {Uint8Array} raster
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} doc
 */
function applyExpeditionAndRoadVisitsToRaster(raster, slice, doc) {
  const { gridWidth, gridHeight } = doc
  const surveyByCell = buildLogisticsSurveyCellIndex(slice.logisticsNodeSurvey)

  for (const expedition of resolveExpeditions(slice.expeditions)) {
    markExpeditionVisitsOnRaster(raster, expedition, gridWidth, gridHeight, surveyByCell)
  }

  for (const segment of resolveRoadSegments(slice.roads)) {
    markRoadSegmentVisitsOnRaster(raster, segment, gridWidth, gridHeight)
  }
}

/**
 * @param {Uint8Array} raster
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} doc
 * @param {Uint8Array} roadCellMask
 * @param {number} haulBudget
 */
function seedSettlementHaulShedsOnVisitRaster(raster, slice, doc, roadCellMask, haulBudget) {
  const { gridWidth, gridHeight } = doc
  for (const settlement of listSettlementsForVisitRaster(slice)) {
    seedHaulShedVisited(raster, {
      origin: settlement,
      budget: haulBudget,
      gridWidth,
      gridHeight,
      movementCost: doc.movementCost,
      roadCellMask,
    })
  }
}

/**
 * @param {Uint8Array} raster
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} doc
 * @param {Uint8Array} roadCellMask
 * @param {number} haulBudget
 */
function applyExpeditionsAndRoadsToVisitRaster(raster, slice, doc, roadCellMask, haulBudget) {
  seedSettlementHaulShedsOnVisitRaster(raster, slice, doc, roadCellMask, haulBudget)
  applyExpeditionAndRoadVisitsToRaster(raster, slice, doc)
}

/**
 * Reconstruct the exploration fog raster from persisted colonization history.
 * Never loaded from storage — derived from settlements, expedition routes, and roads.
 *
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} doc
 * @returns {Uint8Array}
 */
export function rebuildVisitRasterFromSession(slice, doc) {
  const { gridWidth, gridHeight } = doc
  const raster = createEmptyVisitRaster(gridWidth, gridHeight)
  const roadCellMask = buildLandRouteCellMask(slice.roads ?? [], gridWidth, gridHeight)
  const haulBudget = slice.colonistSettings.threeDayHaulDistance

  applyExpeditionsAndRoadsToVisitRaster(raster, slice, doc, roadCellMask, haulBudget)
  return raster
}

/**
 * @typedef {{
 *   type: 'substep-start' | 'substep-complete',
 *   substepIndex: number,
 * } | {
 *   type: 'item-progress',
 *   substepIndex: number,
 *   itemIndex: number,
 *   itemCount: number,
 * }} VisitedRebuildSubstepPayload
 */

/**
 * @typedef {Object} RebuildVisitRasterFromSessionAsyncOptions
 * @property {() => Promise<void>} [yieldToUi]
 * @property {(payload: VisitedRebuildSubstepPayload) => void} [onVisitedSubstep]
 */

/**
 * Async visit-raster rebuild that yields between settlements, expeditions, and roads.
 *
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} doc
 * @param {RebuildVisitRasterFromSessionAsyncOptions} [options]
 * @returns {Promise<Uint8Array>}
 */
export async function rebuildVisitRasterFromSessionAsync(slice, doc, options = {}) {
  const yieldToUi = options.yieldToUi ?? (async () => {})
  const onVisitedSubstep = options.onVisitedSubstep
  const { gridWidth, gridHeight } = doc
  const raster = createEmptyVisitRaster(gridWidth, gridHeight)
  const roadCellMask = buildLandRouteCellMask(slice.roads ?? [], gridWidth, gridHeight)
  const haulBudget = slice.colonistSettings.threeDayHaulDistance
  const settlements = listSettlementsForVisitRaster(slice)
  const expeditions = resolveExpeditions(slice.expeditions)
  const roadSegments = resolveRoadSegments(slice.roads)
  const surveyByCell = buildLogisticsSurveyCellIndex(slice.logisticsNodeSurvey)

  const runSubstep = async (substepIndex, itemCount, processItem) => {
    onVisitedSubstep?.({ type: 'substep-start', substepIndex })
    onVisitedSubstep?.({
      type: 'item-progress',
      substepIndex,
      itemIndex: 0,
      itemCount,
    })
    await yieldToUi()

    for (let index = 0; index < itemCount; index += 1) {
      processItem(index)
      onVisitedSubstep?.({
        type: 'item-progress',
        substepIndex,
        itemIndex: index + 1,
        itemCount,
      })
      await yieldToUi()
    }

    onVisitedSubstep?.({ type: 'substep-complete', substepIndex })
    await yieldToUi()
  }

  await runSubstep(0, settlements.length, (index) => {
    const settlement = settlements[index]
    seedHaulShedVisited(raster, {
      origin: settlement,
      budget: haulBudget,
      gridWidth,
      gridHeight,
      movementCost: doc.movementCost,
      roadCellMask,
    })
  })

  await runSubstep(1, expeditions.length, (index) => {
    markExpeditionVisitsOnRaster(
      raster,
      expeditions[index],
      gridWidth,
      gridHeight,
      surveyByCell,
    )
  })

  await runSubstep(2, roadSegments.length, (index) => {
    markRoadSegmentVisitsOnRaster(raster, roadSegments[index], gridWidth, gridHeight)
  })

  return raster
}
