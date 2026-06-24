import { SEA_LEVEL } from './biomeIds.js'
import { EROSION_STEP_COUNT } from './types.js'

/** @typedef {import('./types.js').WorldGenerationOptions} WorldGenerationOptions */

/** @type {WorldGenerationOptions} */
export const DEFAULT_WORLD_GENERATION_OPTIONS = {
  seaLevel: SEA_LEVEL,
  elevationScale: 1.2,
  elevationFrequencyScale: 1.3,
  elevationOctaves: 6,
  elevationPersistence: 0.6,
  /** Domain warp amplitude in cells at REFERENCE_GRID_SIZE; 0 disables. */
  elevationDomainWarpStrength: 16,
  /** Pulls coastal land down and lifts inland plateaus for drainage headroom. */
  elevationCoastBiasStrength: 0.125,
  /** Smooths mid elevations while preserving peaks above ~0.78. */
  elevationMidSmoothingStrength: 0.5,
  /** Adds high-frequency detail on steep slopes only. */
  elevationSlopeRoughnessStrength: 0.08,
  /** Scales fine FBM octaves on gentle terrain; lower = smoother lowlands. */
  elevationGentleSlopePersistenceScale: 0.38,
  erosionStepCount: EROSION_STEP_COUNT,
  erosionChannelWear: 0.01,
  erosionPeakWear: 0.001,
  inciseIterations: 8,
  streamPowerK: 0.0045,
  streamPowerM: 0.35,
  streamPowerN: 1.5,
  channelInitiationThreshold: 0.005,
  rainShadowStrength: 1,
  moistureAdvectionStrength: 0.65,
  rainfallAmountScale: 1.4,
  /** 0–1 strength of seeded fractal noise on inland biome boundaries. */
  biomeEdgeNoiseStrength: 1,
  temperatureLapseRate: 0.5,
  rainfallFrequencyScale: 1.35,
  navigableFlowCutoffScale: 0.6,
  /** Legacy: opt-in corridor bridging via A* paths; 0 disables connectNearbyRiverCorridors. */
  riverAttractionRadiusScale: 6,
  /** Optional hydrologyRefine substep (A* meander); presentation geometry only. */
  enableMeanderRefine: true,
  /** Legacy: meander strength when enableMeanderRefine is true. */
  riverMeanderStrength: 1.4,
  /** Legacy: valley settling when enableMeanderRefine is true (presentation carve disabled). */
  riverSettlementSteps: 8,
  /** Legacy: tributary merge bias when enableMeanderRefine is true. */
  riverMergeStrength: 1.4,
  minLakeAreaScale: 1,
  soilDrainageScale: 1.6,
  maxSaltNodes: 12,
  /**
   * Breach a closed basin when spill depth divided by basin depth is at or below
   * this ratio (Lindsay-style hybrid breach-and-fill). Higher values breach more
   * often; 0 forces fill-only endorheic basins.
   */
  breachThreshold: 0.3,
  enableSeasonalHydrology: true,
  /** 0–1 blend of season-weighted climate onto land biome classification. */
  seasonalBiomeInfluenceScale: 0.2,
  seasonalYearCount: 5,
  dryRainMult: 0.15,
  wetRainMult: 1,
  yearlyClimateNoiseScale: 0.15,
  lakeEvaporationScale: 1,
  snowAccumRate: 1,
  meltReleaseScale: 1,
  /** Largest lakes that lose a bank segment each simulation year (0 disables). */
  lakeBankCrumblePerYear: 0,
  enforceNavigableRiverQuota: false,
  enforceCoastMouth: false,
  enforceHacksLawExponent: false,
  enforceSlopeAreaConcavity: false,
  enforceParallelStrandRatio: false,
  enforceCoastConnectedNavigablePath: false,
  enforceEndorheicFractionCap: false,
  /**
   * Maximum validation retries when enforce* checks reject a candidate.
   * Each retry regenerates with geographySeed + attempt offset.
   */
  maxValidationRetries: 3,
  minHacksLawExponent: 0.4,
  maxHacksLawExponent: 0.75,
  minSlopeAreaConcavity: 0.05,
  maxSlopeAreaConcavity: 0.45,
  maxParallelStrandRatio: 0.35,
  minCoastConnectedNavigablePathCells: 8,
  maxEndorheicFraction: Number.NaN,
}

/** Default breachThreshold; see DEFAULT_WORLD_GENERATION_OPTIONS.breachThreshold. */
export const DEFAULT_BREACH_THRESHOLD = DEFAULT_WORLD_GENERATION_OPTIONS.breachThreshold

/** Elevation settings before river-friendly priors (issue #306 baseline). */
export const PRE_PRIORS_ELEVATION_OPTIONS = {
  ...DEFAULT_WORLD_GENERATION_OPTIONS,
  elevationDomainWarpStrength: 0,
  elevationCoastBiasStrength: 0,
  elevationMidSmoothingStrength: 0,
  elevationSlopeRoughnessStrength: 0,
  elevationGentleSlopePersistenceScale: 1,
}

/**
 * @param {Partial<WorldGenerationOptions> | undefined | null} partial
 * @returns {WorldGenerationOptions}
 */
export function resolveWorldGenerationOptions(partial) {
  if (!partial) {
    return { ...DEFAULT_WORLD_GENERATION_OPTIONS }
  }
  return {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    ...partial,
  }
}
