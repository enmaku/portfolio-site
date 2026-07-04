import { applyPopulationCollapse } from './applyPopulationCollapse.js'
import {
  hasPersistedPrimaryClaim,
  rehydratePrimaryClaimForSlice,
} from './computePrimaryClaimMap.js'
import { COLONIZATION_PHASE_RUNNING } from './createDefaultColonizationSlice.js'
import {
  hasFullLogisticsNodeSurvey,
  mergeLogisticsNodeSurveyFromStorage,
} from './logisticsNodes/scoreLogisticsNodes.js'
import { rebuildVisitRasterFromSession } from './visitStatus/rebuildVisitRasterFromSession.js'

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../types.js').WorldDocument} doc
 * @returns {import('./createDefaultColonizationSlice.js').ColonizationSlice}
 */
export function rehydrateColonizationDerivedOverlays(slice, doc) {
  if (slice.colonizationPhase !== COLONIZATION_PHASE_RUNNING) {
    return slice
  }

  let next = slice

  if (!hasFullLogisticsNodeSurvey(next.logisticsNodeSurvey)) {
    next = {
      ...next,
      logisticsNodeSurvey: mergeLogisticsNodeSurveyFromStorage(doc, next.logisticsNodeSurvey),
    }
  }

  if (!hasPersistedPrimaryClaim(next.primaryClaim, next.settlements)) {
    next = {
      ...next,
      primaryClaim: rehydratePrimaryClaimForSlice(next, doc),
    }
  }

  const cellCount = doc.gridWidth * doc.gridHeight
  const hasVisitRaster =
    next.visitedCells instanceof Uint8Array && next.visitedCells.length === cellCount
  const hasCollapseRaster =
    next.populationCollapseRaster instanceof Float32Array &&
    next.populationCollapseRaster.length === cellCount

  if (hasVisitRaster && hasCollapseRaster) {
    return next
  }

  const withVisit = hasVisitRaster
    ? next
    : {
        ...next,
        visitedCells: rebuildVisitRasterFromSession(next, doc),
      }

  if (hasCollapseRaster) {
    return withVisit
  }

  return applyPopulationCollapse(withVisit, doc).slice
}
