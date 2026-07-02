/**
 * @typedef {Object} ScalarFields
 * @property {Float32Array} elevation
 * @property {Float32Array} temperature
 * @property {Float32Array} rainfall
 * @property {Float32Array} drainage
 * @property {Float32Array} salinity
 */

/**
 * @typedef {'source' | 'junction' | 'mouth' | 'lake'} RiverNodeKind
 */

/**
 * @typedef {Object} RiverGraphNode
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {RiverNodeKind} kind
 */

/**
 * @typedef {Object} RiverGraphEdge
 * @property {string} fromNodeId
 * @property {string} toNodeId
 * @property {boolean} navigable
 * @property {number[]=} cellPath
 */

/**
 * @typedef {Object} RiverGraph
 * @property {RiverGraphNode[]} nodes
 * @property {RiverGraphEdge[]} edges
 */

/**
 * @typedef {import('./hydrology/riverNetwork.js').RiverNetworkFlow} RiverNetworkFlow
 */

/**
 * Explicit hydrology river-network contract (centerline, corridor, flow, graph).
 * @typedef {import('./hydrology/riverNetwork.js').RiverNetwork} RiverNetwork
 */

/**
 * @typedef {Object} LakeRecord
 * @property {number} id
 * @property {number} area
 * @property {boolean} endorheic
 * @property {number=} spillX
 * @property {number=} spillY
 */

/**
 * @typedef {Object} LakeMetaRecord
 * @property {boolean} endorheic
 * @property {number} surfaceElevation
 * @property {number=} floorElevation
 * @property {number=} spillElevation
 * @property {number=} waterLevel
 * @property {number=} snowPack
 * @property {boolean=} hasOverflowed
 * @property {number=} overflowOutletIdx
 * @property {number[]=} bankCrumbleOutletIdxs
 * @property {number=} outletX
 * @property {number=} outletY
 */

/**
 * @typedef {Object} HydrologyPipelineStats
 * @property {number} breachCount
 * @property {number} endorheicCount
 * @property {number} endorheicFraction
 * @property {number} lakeCount
 * @property {number=} overflowLakeCount
 * @property {number=} seasonalYearCount
 * @property {number=} meanLakeLevelDelta
 * @property {number=} bankCrumbleCount
 */

/**
 * @typedef {Object} HydrologyReportStats
 * @property {number} breachCount
 * @property {number} endorheicCount
 * @property {number} endorheicFraction
 * @property {number} lakeCount
 * @property {number} riverCellCount
 * @property {number} navigableEdgeCount
 * @property {number} navigableKmEstimate
 * @property {number} mouthCount
 * @property {number | null} hacksLawExponent
 * @property {number[]} slopeAreaConcavitySamples
 * @property {number} parallelStrandRatio
 * @property {number} coastConnectedNavigablePathLength
 * @property {number} largestSailComponentCellCount
 * @property {boolean} coastalRiverAccess
 * @property {number} coastToInteriorSailPathLength
 * @property {number=} overflowLakeCount
 * @property {number=} seasonalYearCount
 * @property {number=} meanLakeLevelDelta
 * @property {number=} bankCrumbleCount
 */

/**
 * @typedef {'mouth' | 'strait' | 'anchorage' | 'extraction'} CoastalNodeKind
 */

/**
 * @typedef {Object} CoastalNode
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {CoastalNodeKind} kind
 */

/**
 * @typedef {Object} SaltNode
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} score
 */

/**
 * @typedef {Object} MetalNode
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {number} score
 */

/**
 * @typedef {Object} MapFocusPoint
 * @property {number} x
 * @property {number} y
 * @property {number=} zoom
 */

/**
 * @typedef {Object} MapFocusBounds
 * @property {number} minX
 * @property {number} minY
 * @property {number} maxX
 * @property {number} maxY
 */

/** @typedef {MapFocusPoint | MapFocusBounds} MapFocus */

/**
 * @typedef {'hydrology' | 'coast' | 'climate' | 'resources' | 'landmassPlausibility'} ValidationSignalCategory
 */

/**
 * @typedef {Object} ValidationRow
 * @property {string} checkId
 * @property {'pass' | 'warn' | 'fail'} status
 * @property {string} summary
 * @property {ValidationSignalCategory} category
 * @property {boolean} rejectable
 * @property {MapFocus=} mapFocus
 */

/**
 * @typedef {Object} StructuredRejectionReason
 * @property {string} checkId
 * @property {ValidationSignalCategory} category
 */

/**
 * @typedef {Object} ValidationSignals
 * @property {Object} hydrology
 * @property {number} hydrology.navigableRiverEdgeCount
 * @property {number} hydrology.riverCellCount
 * @property {number} hydrology.mouthCount
 * @property {number | null} hydrology.hacksLawExponent
 * @property {number} hydrology.parallelStrandRatio
 * @property {number} hydrology.coastConnectedNavigablePathLength
 * @property {'pass' | 'warn' | 'fail'} hydrology.endorheicCheckStatus
 * @property {Object} coast
 * @property {number} coast.coastalNodeCount
 * @property {number} coast.mouthCount
 * @property {'pass' | 'warn' | 'fail'} coast.coastMouthCheckStatus
 * @property {number} coast.coastConnectedNavigablePathLength
 * @property {boolean} coast.coastalRiverAccess
 * @property {number} coast.coastToInteriorSailPathLength
 * @property {Object} climate
 * @property {boolean} climate.windRainfallAsymmetryActive
 * @property {'pass' | 'warn' | 'fail'} climate.windRainfallCheckStatus
 * @property {Object} resources
 * @property {boolean} resources.resourceMismatchDetected
 * @property {'pass' | 'warn' | 'fail'} resources.resourceMismatchCheckStatus
 * @property {number} resources.meanInlandSalinity
 * @property {number} resources.oceanSalinityMean
 * @property {'pass' | 'warn' | 'fail'} resources.salinityGradientCheckStatus
 * @property {number} resources.arableLandFraction
 * @property {'pass' | 'warn' | 'fail'} resources.arableEnvelopeCheckStatus
 * @property {number} resources.saltNodeProximityViolationCount
 * @property {'pass' | 'warn' | 'fail'} resources.saltNodeLandProximityCheckStatus
 * @property {number} resources.strategicResourceSpacingViolationCount
 * @property {'pass' | 'warn' | 'fail'} resources.strategicResourceSpacingCheckStatus
 * @property {Object} landmassPlausibility
 * @property {number} landmassPlausibility.highlandFraction
 * @property {number} landmassPlausibility.biomeDiversityCount
 * @property {'pass' | 'warn' | 'fail'} landmassPlausibility.highlandCheckStatus
 * @property {'pass' | 'warn' | 'fail'} landmassPlausibility.biomeDiversityCheckStatus
 * @property {Object} movement
 * @property {number} movement.largestSailComponentCellCount
 * @property {number} movement.coastToInteriorSailPathLength
 * @property {'pass' | 'warn' | 'fail'} movement.navigableRiverCheckStatus
 * @property {'pass' | 'warn' | 'fail'} movement.coastConnectedNavigablePathCheckStatus
 */

/**
 * @typedef {Object} HydrologySubstepTiming
 * @property {string} substepId
 * @property {string} label
 * @property {number} durationMs
 * @property {boolean=} skipped
 */

/**
 * @typedef {Object} GenerationReport
 * @property {number} erosionStepCount
 * @property {number} largestSailComponentCellCount
 * @property {number} coastalNodeCount
 * @property {ValidationRow[]} validationRows
 * @property {boolean} shouldReject
 * @property {string[]} rejectionReasons
 * @property {StructuredRejectionReason[]} structuredRejectionReasons
 * @property {boolean} rejectionSamplingEnforced
 * @property {ValidationSignals} validationSignals
 * @property {HydrologySubstepTiming[]} hydrologySubstepTimings
 * @property {HydrologyReportStats} hydrology
 */

/**
 * @typedef {Object} WorldDocument
 * @property {number} geographySeed
 * @property {number} prevailingWindDegrees
 * @property {number} gridWidth
 * @property {number} gridHeight
 * @property {ScalarFields} fields
 * @property {Uint8Array} biomes
 * @property {Uint8Array} displayBiomes palette-ready biome indices (river corridors resolved to land cover)
 * @property {ReadonlyArray<{ id: number, label: string }>} biomeCatalog
 * @property {string} generatedAt
 * @property {'physicalTerrainBaseline' | 'derivedGeography'} pipelineStage
 * @property {RiverGraph=} riverGraph
 * @property {LakeRecord[]=} lakes
 * @property {LakeMetaRecord[]=} lakeMeta
 * @property {Uint8Array=} lakeMask
 * @property {Uint8Array=} simulationRiverMask Stable SIMULATION hydrology centerline (settled RiverMaskPipeline stage). Logistics-facing; never widened by presentation-only refinements (legacy meander/pathfinding). Validation and future movement-cost work consume this.
 * @property {Uint8Array=} riverNetworkMask PRESENTATION display centerline (settled when refine is off; presentation meander geometry when opted in). Map display only; not logistics-facing.
 * @property {Uint8Array=} riverCorridorMask PRESENTATION painted corridor from hydrologyPaint; map display only.
 * @property {Float32Array=} channelWidth
 * @property {Int16Array=} flowDirection
 * @property {Float32Array=} coastNavigability
 * @property {CoastalNode[]=} coastalNodes
 * @property {SaltNode[]=} saltNodes
 * @property {Float32Array=} arableRaster
 * @property {Float32Array=} timberRaster
 * @property {Float32Array=} metalsRaster
 * @property {MetalNode[]=} metalNodes
 * @property {GenerationReport=} generationReport
 * @property {Float32Array[]=} erosionSnapshots
 */

/**
 * @typedef {Object} WorldGenerationOptions
 * @property {number} seaLevel
 * @property {number} elevationScale
 * @property {number} elevationFrequencyScale
 * @property {number} elevationOctaves
 * @property {number} elevationPersistence
 * @property {number} elevationDomainWarpStrength
 * @property {number} elevationCoastBiasStrength
 * @property {number} elevationMidSmoothingStrength
 * @property {number} elevationSlopeRoughnessStrength
 * @property {number} elevationGentleSlopePersistenceScale
 * @property {number} erosionStepCount
 * @property {number} erosionChannelWear
 * @property {number} erosionPeakWear
 * @property {number} inciseIterations
 * @property {number} streamPowerK
 * @property {number} streamPowerM
 * @property {number} streamPowerN
 * @property {number} channelInitiationThreshold
 * @property {number} rainShadowStrength
 * @property {number} moistureAdvectionStrength
 * @property {number} rainfallAmountScale
 * @property {number} biomeEdgeNoiseStrength
 * @property {number} temperatureLapseRate
 * @property {number} rainfallFrequencyScale
 * @property {number} navigableFlowCutoffScale
 * @property {number} riverAttractionRadiusScale Legacy presentation corridor bridging; 0 = off (Option A default).
 * @property {boolean} enableMeanderRefine Legacy presentation meander refine; default false (Option A).
 * @property {number} riverMeanderStrength
 * @property {number} riverSettlementSteps
 * @property {number} riverMergeStrength
 * @property {number} minLakeAreaScale
 * @property {number} soilDrainageScale
 * @property {number} maxSaltNodes
 * @property {number} maxMetalNodes
 * @property {number} arableMinimumProductivity
 * @property {number} breachThreshold
 * @property {boolean} enforceNavigableRiverQuota
 * @property {boolean} enforceCoastMouth
 * @property {boolean} enforceHacksLawExponent
 * @property {boolean} enforceSlopeAreaConcavity
 * @property {boolean} enforceParallelStrandRatio
 * @property {boolean} enforceCoastConnectedNavigablePath
 * @property {boolean} enforceEndorheicFractionCap
 * @property {boolean} enforceSaltNodeLandProximity
 * @property {boolean} enforceStrategicResourceSpacing
 * @property {number} maxValidationRetries
 * @property {boolean} enableIntermediateStepPreviews
 * @property {number} minHacksLawExponent
 * @property {number} maxHacksLawExponent
 * @property {number} minSlopeAreaConcavity
 * @property {number} maxSlopeAreaConcavity
 * @property {number} maxParallelStrandRatio
 * @property {number} minCoastConnectedNavigablePathCells
 * @property {number} maxEndorheicFraction
 * @property {boolean} enableSeasonalHydrology
 * @property {number} seasonalBiomeInfluenceScale
 * @property {number} seasonalYearCount
 * @property {number} dryRainMult
 * @property {number} wetRainMult
 * @property {number} yearlyClimateNoiseScale
 * @property {number} lakeEvaporationScale
 * @property {number} snowAccumRate
 * @property {number} meltReleaseScale
 * @property {number} lakeBankCrumblePerYear
 */

/**
 * @typedef {Object} PhysicalTerrainBaselineParams
 * @property {number} geographySeed
 * @property {number} prevailingWindDegrees
 * @property {number} [width]
 * @property {number} [height]
 * @property {Partial<WorldGenerationOptions>} [options]
 */

/**
 * @typedef {PhysicalTerrainBaselineParams} DerivedGeographyParams
 */

export const PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE = 'physicalTerrainBaseline'
export const PIPELINE_STAGE_DERIVED_GEOGRAPHY = 'derivedGeography'

export const DEFAULT_GRID_SIZE = 1024

/** Grid size the field tunings were originally authored for. */
export const REFERENCE_GRID_SIZE = 256

/** Total erosion iterations (stable contract for tests). */
export const EROSION_STEP_COUNT = 24

/** Snapshot every N erosion steps (inclusive of final). */
export const EROSION_SNAPSHOT_INTERVAL = 3

/** Minimum flow accumulation for navigable river segments (reference grid). */
export const REFERENCE_NAVIGABLE_FLOW_CUTOFF = 48

/** Maximum segment gradient for navigable rivers (elevation delta per cell). */
export const REFERENCE_NAVIGABLE_GRADIENT_CUTOFF = 0.012

/** Minimum lake area in cells (reference grid). */
export const REFERENCE_MIN_LAKE_AREA = 16

/**
 * Minimum channel-mask cells upstream of a mouth node (reference grid).
 * Filters one-pixel dribbles that are not visible on the map.
 */
export const REFERENCE_MIN_RIVER_MOUTH_CHANNEL_CELLS = 12

/** Minimum navigable river edge count for validation pass (reference grid). */
export const REFERENCE_MIN_NAVIGABLE_RIVER_EDGES = 3

/** Minimum largest sail-overlay component size for validation pass (reference grid). */
export const REFERENCE_MIN_SAILABLE_WATER_CELLS = 48

/** Minimum highland cell fraction for validation pass. */
export const MIN_HIGHLAND_ELEVATION = 0.72

export const MIN_HIGHLAND_FRACTION = 0.002

/** Minimum distinct biome count for diversity check. */
export const MIN_BIOME_DIVERSITY = 6

/**
 * Scale a distance or frequency authored at REFERENCE_GRID_SIZE to another grid width.
 * @param {number} value
 * @param {number} gridSize
 */
export function scaleForGridSize(value, gridSize) {
  return value * (REFERENCE_GRID_SIZE / gridSize)
}

/**
 * Flow cutoffs scale sub-linearly with grid width when runoff is normalized
 * precipitation (0..1 per cell). Linear scaling outpaced mouth discharge growth
 * at 1024² and erased flow-traced river networks.
 * @param {number} gridSize
 */
export function navigableFlowCutoffForGrid(gridSize) {
  const scale = Math.sqrt(gridSize / REFERENCE_GRID_SIZE)
  return Math.max(
    6,
    Math.round(10 * scale),
  )
}

/**
 * Minimum catchment size before a headwater becomes a river-graph source node.
 * @param {number} gridSize
 */
export function sourceFlowCutoffForGrid(gridSize) {
  return Math.max(8, Math.round(navigableFlowCutoffForGrid(gridSize) * 0.35))
}

/**
 * Flow cutoff for visible river-network cells (continuous drainage to the sea).
 * Lower than navigable cutoff so corridors connect headwaters to mouths.
 * @param {number} gridSize
 */
export function riverDisplayFlowCutoffForGrid(gridSize) {
  const scale = Math.sqrt(gridSize / REFERENCE_GRID_SIZE)
  return Math.max(4, Math.round(4 * scale))
}

/**
 * Minimum painted channel cells draining into a mouth before it counts as a river mouth.
 * @param {number} gridSize
 */
export function minRiverMouthChannelCellsForGrid(gridSize) {
  const scale = Math.sqrt(gridSize / REFERENCE_GRID_SIZE)
  return Math.max(6, Math.round(REFERENCE_MIN_RIVER_MOUTH_CHANNEL_CELLS * scale))
}

/**
 * Coastal radius within which only the largest river mouth is kept visible.
 * Suppresses parallel finger outlets that never merged in flow accumulation.
 * @param {number} gridSize
 */
export function coastalMouthMergeRadiusForGrid(gridSize) {
  return Math.max(12, Math.round(scaleForGridSize(96, gridSize)))
}

/**
 * Minimum mouth flow before fanning delta distributaries along the coast.
 * @param {number} gridSize
 */
export function deltaFlowCutoffForGrid(gridSize) {
  return Math.max(
    sourceFlowCutoffForGrid(gridSize),
    Math.round(navigableFlowCutoffForGrid(gridSize) * 0.45),
  )
}

/**
 * @param {number} gridSize
 */
export function minLakeAreaForGrid(gridSize) {
  const scale = gridSize / REFERENCE_GRID_SIZE
  return Math.max(4, Math.round(REFERENCE_MIN_LAKE_AREA * scale * scale))
}

/**
 * @param {number} gridSize
 */
export function minNavigableRiverEdgesForGrid(gridSize) {
  return Math.max(1, Math.round(REFERENCE_MIN_NAVIGABLE_RIVER_EDGES * (gridSize / REFERENCE_GRID_SIZE)))
}

/**
 * Minimum largest connected sail-overlay component for navigableRiverQuota pass.
 * @param {number} gridSize
 */
export function minSailableWaterCellsForGrid(gridSize) {
  return Math.max(
    8,
    Math.round(REFERENCE_MIN_SAILABLE_WATER_CELLS * (gridSize / REFERENCE_GRID_SIZE)),
  )
}
