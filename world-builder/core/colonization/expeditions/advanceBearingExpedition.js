import { estimateRouteTravelTime } from './expeditionRouting.js'
import { isVisitRasterCellVisited } from './bearingStepUtils.js'
import { isMaritimeExpeditionMode } from './expeditionConstants.js'
import {
  landStepTravelCost,
  listLegalLandExpeditionSteps,
  selectLandExpeditionStep,
} from './selectLandExpeditionStep.js'
import {
  listLegalSailExpeditionSteps,
  sailStepTravelCost,
  selectSailExpeditionStep,
} from './selectSailExpeditionStep.js'
import {
  listLegalOpenSeaExpeditionSteps,
  openSeaStepTravelCost,
  selectOpenSeaExpeditionStep,
} from './selectOpenSeaExpeditionStep.js'

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
  if (expedition.mode === 'open_sea') {
    return colonistSettings.openSeaExpeditionRange * colonistSettings.threeDayHaulDistance
  }
  if (expedition.mode === 'inland_sail') {
    return colonistSettings.inlandSailExpeditionRange * colonistSettings.threeDayHaulDistance
  }
  return colonistSettings.landExpeditionRange * colonistSettings.threeDayHaulDistance
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
  /** @type {ExpeditionEndReason | null} */
  let endReason = null

  const epochBudget = isMaritimeExpeditionMode(expedition.mode)
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

    const legalSteps = listLegalStepsForMode(
      expedition.mode,
      current,
      { doc, dryLandMask, visitRaster, roadCellMask },
      sailMask,
      dryLandMask,
    )

    if (legalSteps.length === 0) {
      endReason = 'blocked'
      break
    }

    const next = selectStepForMode(
      expedition.mode,
      current,
      expedition.bearing,
      { doc, dryLandMask, visitRaster, roadCellMask },
      sailMask,
      dryLandMask,
    )

    if (!next) {
      endReason = 'blocked'
      break
    }

    const stepCost = stepCostForMode(expedition.mode, current, next, doc, roadCellMask)

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
 * @param {import('./expeditionConstants.js').ExpeditionMode} mode
 * @param {{ x: number, y: number }} current
 * @param {import('./selectLandExpeditionStep.js').LandStepContext} landContext
 * @param {Uint8Array | null} sailMask
 * @param {Uint8Array} dryLandMask
 * @returns {Array<{ x: number, y: number }>}
 */
function listLegalStepsForMode(mode, current, landContext, sailMask, dryLandMask) {
  const { doc } = landContext
  if (mode === 'open_sea' && sailMask) {
    return listLegalOpenSeaExpeditionSteps(current, sailMask, doc.gridWidth, doc.gridHeight)
  }
  if (mode === 'inland_sail' && sailMask) {
    return listLegalSailExpeditionSteps(current, sailMask, dryLandMask, doc.gridWidth, doc.gridHeight)
  }
  return listLegalLandExpeditionSteps(current, landContext)
}

/**
 * @param {import('./expeditionConstants.js').ExpeditionMode} mode
 * @param {{ x: number, y: number }} current
 * @param {number} bearing
 * @param {import('./selectLandExpeditionStep.js').LandStepContext} landContext
 * @param {Uint8Array | null} sailMask
 * @param {Uint8Array} dryLandMask
 * @returns {{ x: number, y: number } | null}
 */
function selectStepForMode(mode, current, bearing, landContext, sailMask, dryLandMask) {
  const { doc } = landContext
  if (mode === 'open_sea' && sailMask) {
    return selectOpenSeaExpeditionStep(current, bearing, sailMask, doc)
  }
  if (mode === 'inland_sail' && sailMask) {
    return selectSailExpeditionStep(current, bearing, sailMask, dryLandMask, doc)
  }
  return selectLandExpeditionStep(current, bearing, landContext)
}

/**
 * @param {import('./expeditionConstants.js').ExpeditionMode} mode
 * @param {{ x: number, y: number }} current
 * @param {{ x: number, y: number }} next
 * @param {import('../../types.js').WorldDocument} doc
 * @param {Uint8Array | null} roadCellMask
 * @returns {number}
 */
function stepCostForMode(mode, current, next, doc, roadCellMask) {
  if (mode === 'open_sea') {
    return openSeaStepTravelCost(current, next)
  }
  if (mode === 'inland_sail') {
    return sailStepTravelCost(current, next)
  }
  return landStepTravelCost(doc, current, next, roadCellMask)
}

/**
 * @param {{ x: number, y: number }} current
 * @param {number} bearing
 * @param {import('./selectLandExpeditionStep.js').LandStepContext} landContext
 * @param {Uint8Array | null} sailMask
 * @param {Uint8Array} dryLandMask
 * @param {import('../../types.js').WorldDocument} doc
 * @param {import('./expeditionConstants.js').ExpeditionMode} mode
 * @returns {boolean}
 */
export function hasLegalFirstExpeditionStep(
  current,
  bearing,
  landContext,
  sailMask,
  dryLandMask,
  doc,
  mode,
) {
  return selectStepForMode(mode, current, bearing, landContext, sailMask, dryLandMask) !== null
}
