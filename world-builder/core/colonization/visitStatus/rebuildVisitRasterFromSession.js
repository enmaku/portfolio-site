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

  for (const settlement of slice.settlements ?? []) {
    if (!Number.isFinite(settlement.x) || !Number.isFinite(settlement.y)) {
      continue
    }
    seedHaulShedVisited(raster, {
      origin: { x: settlement.x, y: settlement.y },
      budget: haulBudget,
      gridWidth,
      gridHeight,
      movementCost: doc.movementCost,
      roadCellMask,
    })
  }

  for (const expedition of resolveExpeditions(slice.expeditions)) {
    const traveled = routeCellsUpToProgress(expedition.route, expedition.progressIndex)
    markCellsVisited(raster, traveled, gridWidth)
    for (const cell of traveled) {
      const node = (slice.logisticsNodeSurvey ?? []).find(
        (entry) => entry.x === cell.x && entry.y === cell.y,
      )
      if (node) {
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
  }

  for (const segment of resolveRoadSegments(slice.roads)) {
    if (!Array.isArray(segment.cells) || segment.cells.length === 0) continue
    markCellsVisited(
      raster,
      buildCorridorCells(segment.cells, gridWidth, gridHeight),
      gridWidth,
    )
  }

  return raster
}
