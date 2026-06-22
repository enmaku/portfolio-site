import { computeHydrologyMetrics } from './validation/computeHydrologyMetrics.js'
import { runGeographyValidationChecks } from './validation/runGeographyValidationChecks.js'
import {
  collectRejectionReasons,
  shouldRejectGeographyCandidate,
} from './validation/shouldRejectGeographyCandidate.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from './worldGenerationOptions.js'

/**
 * @param {Object} params
 * @param {number} params.erosionStepCount
 * @param {import('./types.js').RiverGraph} params.riverGraph
 * @param {import('./types.js').CoastalNode[]} params.coastalNodes
 * @param {import('./types.js').ScalarFields} params.fields
 * @param {Uint8Array} params.biomes
 * @param {number} params.gridWidth
 * @param {number} params.gridHeight
 * @param {import('./types.js').HydrologySubstepTiming[]} params.hydrologySubstepTimings
 * @param {import('./types.js').HydrologyPipelineStats} params.hydrologyStats
 * @param {Uint8Array} [params.riverNetworkMask]
 * @param {import('./types.js').WorldGenerationOptions} [params.validationOptions]
 * @returns {import('./types.js').GenerationReport}
 */
export function buildGenerationReport({
  erosionStepCount,
  riverGraph,
  coastalNodes,
  fields,
  biomes,
  gridWidth,
  gridHeight,
  hydrologySubstepTimings,
  hydrologyStats,
  riverNetworkMask,
  validationOptions = DEFAULT_WORLD_GENERATION_OPTIONS,
}) {
  const metrics = computeHydrologyMetrics({
    elevation: fields.elevation,
    drainage: fields.drainage,
    riverGraph,
    riverNetworkMask,
    gridWidth,
    gridHeight,
  })
  const navigableRiverEdgeCount = metrics.navigableEdgeCount
  const validationRows = runGeographyValidationChecks({
    fields,
    biomes,
    riverGraph,
    coastalNodes,
    gridWidth,
    gridHeight,
    hydrologyStats,
    hydrologyMetrics: metrics,
    validationOptions,
  })
  const lakeCount = hydrologyStats.lakeCount
  const endorheicFraction = lakeCount > 0 ? hydrologyStats.endorheicCount / lakeCount : 0

  return {
    erosionStepCount,
    navigableRiverEdgeCount,
    coastalNodeCount: coastalNodes.length,
    validationRows,
    shouldReject: shouldRejectGeographyCandidate(validationRows),
    rejectionReasons: collectRejectionReasons(validationRows),
    hydrologySubstepTimings,
    hydrology: {
      breachCount: hydrologyStats.breachCount,
      endorheicCount: hydrologyStats.endorheicCount,
      endorheicFraction,
      lakeCount,
      riverCellCount: metrics.riverCellCount,
      navigableEdgeCount: metrics.navigableEdgeCount,
      navigableKmEstimate: metrics.navigableKmEstimate,
      mouthCount: metrics.mouthCount,
      hacksLawExponent: metrics.hacksLawExponent,
      slopeAreaConcavitySamples: metrics.slopeAreaConcavitySamples,
      parallelStrandRatio: metrics.parallelStrandRatio,
      coastConnectedNavigablePathLength: metrics.coastConnectedNavigablePathLength,
    },
  }
}
