import { estimateRouteTravelTime } from './expeditionRouting.js'
import { isVisitRasterCellVisited } from './bearingStepUtils.js'
import {
  landStepTravelCost,
  listLegalLandExpeditionSteps,
  selectLandExpeditionStep,
} from './selectLandExpeditionStep.js'
import { selectSailExpeditionStep, listLegalSailExpeditionSteps, sailStepTravelCost } from './selectSailExpeditionStep.js'

/** @typedef {import('./bearingStepUtils.js').ExpeditionEndReason} ExpeditionEndReason */

/**
 * @typedef {Object} AdvanceBearingExpeditionResult
 * @property {import('./expeditionConstants.js').ExpeditionRecord} expedition
 * @property {Array<{ x: number, y: number }>} traveledCells
 * @property {ExpeditionEndReason | null} endReason
 */

/**
 * @param {import('./expeditionConstants.js').ExpeditionRecord} expedition
 * @param {import('../createDefaultColonizationSlice.js').ColonistSettings} colonistSettings
 * @returns {number}
 */
function expeditionRangeBudget(expedition, colonistSettings) {
  const multiplier =
    expedition.mode === 'sail'
      ? colonistSettings.sailExpeditionRange
      : colonistSettings.landExpeditionRange
  return multiplier * colonistSettings.threeDayHaulDistance
}

/**
 * @param {{
 *   expedition: import('./expeditionConstants.js').ExpeditionRecord,
 *   doc: import('../../types.js').WorldDocument,
 *   colonistSettings: import('../createDefaultColonizationSlice.js').ColonistSettings,
 *   dryLandMask: Uint8Array,
 *   sailMask: Uint8Array | null,
 *   visitRaster: Uint8Array,
 *   roadCellMask: Uint8Array | null,
 * }} params
 * @returns {AdvanceBearingExpeditionResult}
 */
export function advanceBearingExpedition(params) {
  const { expedition, doc, colonistSettings, dryLandMask, sailMask, visitRaster, roadCellMask } =
    params

  let route = [...expedition.route]
  let progressIndex = expedition.progressIndex
  /** @type {Array<{ x: number, y: number }>} */
  const traveledCells = []
  /** @type {Array<{ x: number, y: number }>} */
  const newlyDiscoveredCells = []
  let endReason = /** @type {ExpeditionEndReason | null} */ (null)

  const epochBudget =
    expedition.mode === 'sail'
      ? colonistSettings.threeDayHaulDistance * 3
      : colonistSettings.threeDayHaulDistance
  const rangeBudget = expeditionRangeBudget(expedition, colonistSettings)
  let remainingEpochBudget = epochBudget

  while (remainingEpochBudget > 0) {
    const current = route[progressIndex]
    const distanceSoFar = estimateRouteTravelTime(
      doc,
      route.slice(0, progressIndex + 1),
      expedition.mode,
      roadCellMask,
    )
    if (distanceSoFar >= rangeBudget) {
      endReason = 'range_cap'
      break
    }

    const legalSteps =
      expedition.mode === 'sail' && sailMask
        ? listLegalSailExpeditionSteps(current, sailMask, dryLandMask, doc.gridWidth, doc.gridHeight)
        : listLegalLandExpeditionSteps(current, {
            doc,
            dryLandMask,
            visitRaster,
            roadCellMask,
          })

    if (legalSteps.length === 0) {
      endReason = 'blocked'
      break
    }

    const next =
      expedition.mode === 'sail' && sailMask
        ? selectSailExpeditionStep(current, expedition.bearing, sailMask, dryLandMask, doc)
        : selectLandExpeditionStep(current, expedition.bearing, {
            doc,
            dryLandMask,
            visitRaster,
            roadCellMask,
          })

    if (!next) {
      endReason = 'blocked'
      break
    }

    const stepCost =
      expedition.mode === 'sail'
        ? sailStepTravelCost(current, next)
        : landStepTravelCost(doc, current, next, roadCellMask)

    if (stepCost > remainingEpochBudget) {
      break
    }

    const projectedDistance = distanceSoFar + stepCost
    if (projectedDistance > rangeBudget) {
      endReason = 'range_cap'
      break
    }

    remainingEpochBudget -= stepCost
    if (progressIndex === route.length - 1) {
      route.push(next)
    } else {
      route = [...route.slice(0, progressIndex + 1), next]
    }
    progressIndex += 1
    traveledCells.push(next)
    if (!isVisitRasterCellVisited(visitRaster, next.x, next.y, doc.gridWidth)) {
      newlyDiscoveredCells.push(next)
    }
  }

  if (
    (endReason === 'range_cap' || endReason === 'blocked') &&
    newlyDiscoveredCells.length === 0 &&
    traveledCells.length > 0
  ) {
    endReason = 'survey_complete'
  }

  const status = endReason ? 'completed' : 'active'
  return {
    expedition: {
      ...expedition,
      route,
      progressIndex,
      status,
      endReason: endReason ?? expedition.endReason,
    },
    traveledCells,
    endReason,
  }
}

/**
 * @param {{ x: number, y: number }} current
 * @param {number} bearing
 * @param {import('./selectLandExpeditionStep.js').LandStepContext} landContext
 * @param {Uint8Array | null} sailMask
 * @param {Uint8Array} dryLandMask
 * @param {import('../../types.js').WorldDocument} doc
 * @returns {boolean}
 */
export function hasLegalFirstExpeditionStep(current, bearing, landContext, sailMask, dryLandMask, doc, mode) {
  if (mode === 'sail' && sailMask) {
    return selectSailExpeditionStep(current, bearing, sailMask, dryLandMask, doc) !== null
  }
  return selectLandExpeditionStep(current, bearing, landContext) !== null
}
