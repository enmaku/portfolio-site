import { createFoundingDynasty } from '../createFoundingDynasty.js'
import { computeHaulShedIsochrone } from '../computeHaulShedIsochrone.js'
import { seedHaulShedVisited } from '../visitStatus/visitRaster.js'
import { appendRoadSegment, buildLandRouteCellMask } from '../roads/roadNetwork.js'
import { patchLogisticsNodeSurvey } from '../logisticsNodes/scoreLogisticsNodes.js'
import { DAUGHTER_OUTPOST_HEADCOUNT } from './expeditionConstants.js'
import { routeCellsUpToProgress } from './expeditionRouting.js'

/**
 * @param {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: import('../../types.js').WorldDocument,
 *   candidate: { x: number, y: number, node: import('../logisticsNodes/scoreLogisticsNodes.js').LogisticsNodeSurveyEntry },
 *   originSettlementId: string,
 *   epoch: number,
 *   expeditionRoute: Array<{ x: number, y: number }>,
 *   progressIndex: number,
 *   mode: 'land' | 'sail',
 * }} params
 * @returns {{
 *   slice: import('../createDefaultColonizationSlice.js').ColonizationSlice,
 *   worldDocument: import('../../types.js').WorldDocument,
 *   historyEntry: object,
 * }}
 */
export function foundDaughterSettlement(params) {
  const {
    slice,
    worldDocument,
    candidate,
    originSettlementId,
    epoch,
    expeditionRoute,
    progressIndex,
    mode,
  } = params

  const settlementId = `settlement-${candidate.x}-${candidate.y}-${epoch}`
  const daughter = {
    id: settlementId,
    x: candidate.x,
    y: candidate.y,
    tier: 'outpost',
    population: DAUGHTER_OUTPOST_HEADCOUNT,
    status: 'living',
    foundedEpoch: epoch,
    originSettlementId,
    logisticsNodePrimaryType: candidate.node.primaryType,
  }

  const dynasty = createFoundingDynasty({
    settlementId,
    landing: { x: candidate.x, y: candidate.y },
    worldDocument,
  })

  const historyEntry = {
    kind: 'settlement_founded',
    epoch,
    settlementId,
    x: candidate.x,
    y: candidate.y,
    originSettlementId,
    logisticsNodePrimaryType: candidate.node.primaryType,
  }

  const roadCellMask = buildLandRouteCellMask(
    slice.roads,
    worldDocument.gridWidth,
    worldDocument.gridHeight,
  )
  const visitedCells = new Uint8Array(
    slice.visitedCells instanceof Uint8Array &&
    slice.visitedCells.length === worldDocument.gridWidth * worldDocument.gridHeight
      ? slice.visitedCells
      : worldDocument.gridWidth * worldDocument.gridHeight,
  )

  seedHaulShedVisited(visitedCells, {
    origin: { x: candidate.x, y: candidate.y },
    budget: slice.colonistSettings.threeDayHaulDistance,
    gridWidth: worldDocument.gridWidth,
    gridHeight: worldDocument.gridHeight,
    movementCost: worldDocument.movementCost,
    roadCellMask,
  })

  let roads = slice.roads ?? []
  const traveled = routeCellsUpToProgress(expeditionRoute, progressIndex)
  if (traveled.length > 1) {
    roads = appendRoadSegment(roads, traveled, [originSettlementId, settlementId], mode)
  }

  const logisticsNodeSurvey = patchLogisticsNodeSurvey(
    slice.logisticsNodeSurvey ?? [],
    candidate.x,
    candidate.y,
    { founded: true },
  )

  return {
    slice: {
      ...slice,
      settlements: [...slice.settlements, daughter],
      notableFigures: [...slice.notableFigures, dynasty],
      historyLog: [...slice.historyLog, historyEntry],
      visitedCells,
      roads,
      logisticsNodeSurvey,
      realmId: slice.realmId,
    },
    worldDocument: {
      ...worldDocument,
      visitedCells,
      roads,
      logisticsNodeSurvey,
    },
    historyEntry,
  }
}

/**
 * @param {import('../createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../../types.js').WorldDocument} worldDocument
 * @param {{ x: number, y: number }} origin
 */
export function seedSettlementHaulShedVisited(slice, worldDocument, origin) {
  const cellCount = worldDocument.gridWidth * worldDocument.gridHeight
  const visitedCells = new Uint8Array(
    slice.visitedCells instanceof Uint8Array && slice.visitedCells.length === cellCount
      ? slice.visitedCells
      : cellCount,
  )
  const roadCellMask = buildLandRouteCellMask(
    worldDocument.roads,
    worldDocument.gridWidth,
    worldDocument.gridHeight,
  )
  seedHaulShedVisited(visitedCells, {
    origin,
    budget: slice.colonistSettings.threeDayHaulDistance,
    gridWidth: worldDocument.gridWidth,
    gridHeight: worldDocument.gridHeight,
    movementCost: worldDocument.movementCost,
    roadCellMask,
  })
  return visitedCells
}

export { computeHaulShedIsochrone }
