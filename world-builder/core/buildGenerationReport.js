import { readRiverNetworkFromWorldDocument } from './hydrology/riverNetwork.js'
import { MIN_HIGHLAND_ELEVATION } from './types.js'
import { computeHydrologyMetrics } from './validation/computeHydrologyMetrics.js'
import { buildValidationSignals } from './validation/landmassValidationContracts.js'
import {
  computeSalinityGradientMetrics,
  runGeographyValidationChecks,
} from './validation/runGeographyValidationChecks.js'
import {
  computeArableEnvelopeMetrics,
  findSaltNodeLandProximityViolations,
  findStrategicResourceSpacingViolations,
} from './validation/computeResourceValidationMetrics.js'
import {
  collectRejectionReasons,
  collectStructuredRejectionReasons,
  isRejectionSamplingEnforced,
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
 * @param {import('./types.js').RiverNetwork} [params.riverNetwork]
 * @param {import('./types.js').WorldDocument} [params.worldDocument]
 * @param {number} [params.prevailingWindDegrees]
 * @param {import('./types.js').WorldGenerationOptions} [params.validationOptions]
 * @param {Float32Array | null | undefined} [params.arableRaster]
 * @param {import('./types.js').SaltNode[] | null | undefined} [params.saltNodes]
 * @param {import('./types.js').MetalNode[] | null | undefined} [params.metalNodes]
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
  riverNetwork,
  worldDocument,
  prevailingWindDegrees = 0,
  validationOptions = DEFAULT_WORLD_GENERATION_OPTIONS,
  arableRaster: arableRasterParam,
  saltNodes: saltNodesParam,
  metalNodes: metalNodesParam,
}) {
  const arableRaster = arableRasterParam ?? worldDocument?.arableRaster
  const saltNodes = saltNodesParam ?? worldDocument?.saltNodes
  const metalNodes = metalNodesParam ?? worldDocument?.metalNodes
  const resolvedNetwork =
    riverNetwork ??
    (worldDocument ? readRiverNetworkFromWorldDocument(worldDocument) : null)
  if (!resolvedNetwork) {
    throw new Error('riverNetwork required for generation report hydrology metrics')
  }
  const metrics = computeHydrologyMetrics({
    elevation: fields.elevation,
    drainage: fields.drainage,
    riverGraph: resolvedNetwork.graph ?? riverGraph,
    riverNetwork: resolvedNetwork,
    gridWidth,
    gridHeight,
  })
  const navigableRiverEdgeCount = metrics.navigableEdgeCount
  const validationRows = runGeographyValidationChecks({
    fields,
    biomes,
    riverGraph: resolvedNetwork?.graph ?? riverGraph,
    riverNetwork: resolvedNetwork ?? undefined,
    coastalNodes,
    gridWidth,
    gridHeight,
    hydrologyStats,
    hydrologyMetrics: metrics,
    prevailingWindDegrees,
    validationOptions,
    arableRaster,
    saltNodes,
    metalNodes,
  })
  const lakeCount = hydrologyStats.lakeCount
  const endorheicFraction = lakeCount > 0 ? hydrologyStats.endorheicCount / lakeCount : 0
  const cellCount = gridWidth * gridHeight
  let highlandCells = 0
  for (let i = 0; i < cellCount; i += 1) {
    if (fields.elevation[i] >= MIN_HIGHLAND_ELEVATION) highlandCells += 1
  }
  const salinityMetrics = computeSalinityGradientMetrics(
    fields.salinity,
    fields.elevation,
    validationOptions.seaLevel,
  )
  const resourceMismatchRow = validationRows.find((row) => row.checkId === 'resourceMismatch')
  const windRow = validationRows.find((row) => row.checkId === 'windRainfallAsymmetry')
  const arableMetrics = computeArableEnvelopeMetrics(
    arableRaster,
    fields.elevation,
    validationOptions.seaLevel,
  )
  const saltProximityViolations = findSaltNodeLandProximityViolations(
    saltNodes,
    biomes,
    gridWidth,
    gridHeight,
  )
  const spacingViolations = findStrategicResourceSpacingViolations(
    saltNodes,
    metalNodes,
    gridWidth,
  )

  return {
    erosionStepCount,
    navigableRiverEdgeCount,
    coastalNodeCount: coastalNodes.length,
    validationRows,
    shouldReject: shouldRejectGeographyCandidate(validationRows),
    rejectionReasons: collectRejectionReasons(validationRows),
    structuredRejectionReasons: collectStructuredRejectionReasons(validationRows),
    rejectionSamplingEnforced: isRejectionSamplingEnforced(validationOptions),
    validationSignals: buildValidationSignals(validationRows, metrics, {
      coastalNodeCount: coastalNodes.length,
      highlandFraction: highlandCells / cellCount,
      biomeDiversityCount: new Set(biomes).size,
      windRainfallAsymmetryActive: windRow?.status === 'pass',
      resourceMismatchDetected: resourceMismatchRow?.status === 'warn',
      meanInlandSalinity: salinityMetrics.meanInlandSalinity,
      oceanSalinityMean: salinityMetrics.oceanSalinityMean,
      arableLandFraction: arableMetrics.arableLandFraction,
      saltNodeProximityViolationCount: saltProximityViolations.length,
      strategicResourceSpacingViolationCount: spacingViolations.length,
    }),
    hydrologySubstepTimings,
    hydrology: {
      breachCount: hydrologyStats.breachCount,
      endorheicCount: hydrologyStats.endorheicCount,
      endorheicFraction,
      lakeCount,
      overflowLakeCount: hydrologyStats.overflowLakeCount ?? 0,
      seasonalYearCount: hydrologyStats.seasonalYearCount ?? 0,
      meanLakeLevelDelta: hydrologyStats.meanLakeLevelDelta ?? 0,
      bankCrumbleCount: hydrologyStats.bankCrumbleCount ?? 0,
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
