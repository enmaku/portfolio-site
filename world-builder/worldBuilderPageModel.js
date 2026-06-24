import { derivePrevailingWindFromSeed } from './core/derivePrevailingWindFromSeed.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from './core/worldGenerationOptions.js'

/** Default geography seed for generation controls and reset. */
export const DEFAULT_GEOGRAPHY_SEED = 0

/** Validation checks omitted from the generation-report sidebar list. */
const HIDDEN_SIDEBAR_VALIDATION_CHECK_IDS = new Set([
  'hacksLawExponent',
  'slopeAreaConcavity',
  'parallelStrandRatio',
])

/**
 * @returns {import('./core/types.js').WorldGenerationOptions}
 */
export function createDefaultGenerationOptions() {
  return { ...DEFAULT_WORLD_GENERATION_OPTIONS }
}

/**
 * @returns {{
 *   geographySeed: number,
 *   prevailingWindDegrees: number,
 *   generationOptions: import('./core/types.js').WorldGenerationOptions,
 * }}
 */
export function createDefaultControlsState() {
  const { geographySeed, prevailingWindDegrees } = createControlsStateForSeed(DEFAULT_GEOGRAPHY_SEED)
  return {
    geographySeed,
    prevailingWindDegrees,
    generationOptions: createDefaultGenerationOptions(),
  }
}

/**
 * Default generation sliders and seed-derived prevailing wind; geography seed unchanged.
 * @param {number} geographySeed
 * @returns {{
 *   prevailingWindDegrees: number,
 *   generationOptions: import('./core/types.js').WorldGenerationOptions,
 * }}
 */
export function createDefaultGenerationSettings(geographySeed) {
  const { prevailingWindDegrees } = createControlsStateForSeed(geographySeed)
  return {
    prevailingWindDegrees,
    generationOptions: createDefaultGenerationOptions(),
  }
}

/**
 * @param {number} geographySeed
 * @param {number} prevailingWindDegrees
 * @param {import('./core/types.js').WorldGenerationOptions} options
 * @returns {import('./core/types.js').DerivedGeographyParams}
 */
export function buildDerivedGeographyParams(geographySeed, prevailingWindDegrees, options) {
  return {
    geographySeed,
    prevailingWindDegrees: normalizeWindDegrees(prevailingWindDegrees),
    options: { ...options },
  }
}

/**
 * @returns {number}
 */
export function createRandomGeographySeed() {
  return normalizeGeographySeed((Math.random() * 4294967296) | 0)
}

/**
 * @param {number} geographySeed
 * @returns {number}
 */
export function normalizeGeographySeed(geographySeed) {
  const normalizedSeed = geographySeed | 0
  return normalizedSeed >= 0 ? normalizedSeed : normalizedSeed + 4294967296
}

/**
 * @param {number} geographySeed
 * @returns {{ geographySeed: number, prevailingWindDegrees: number }}
 */
export function createControlsStateForSeed(geographySeed) {
  const signedSeed = geographySeed | 0
  return {
    geographySeed: normalizeGeographySeed(geographySeed),
    prevailingWindDegrees: derivePrevailingWindFromSeed(signedSeed),
  }
}

/**
 * @param {number | string} rawSeed
 * @returns {number | null}
 */
export function parseGeographySeedInput(rawSeed) {
  const parsed = Number.parseInt(String(rawSeed), 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }
  return parsed | 0
}

/**
 * @param {number} degrees
 * @returns {number}
 */
export function normalizeWindDegrees(degrees) {
  const rounded = Math.round(degrees)
  return ((rounded % 360) + 360) % 360
}

/**
 * @param {'pass' | 'warn' | 'fail'} status
 * @returns {string}
 */
export function validationStatusColor(status) {
  if (status === 'pass') return 'positive'
  if (status === 'fail') return 'negative'
  return 'warning'
}

/**
 * @param {'pass' | 'warn' | 'fail'} status
 * @returns {string}
 */
export function validationStatusIcon(status) {
  if (status === 'pass') return 'check_circle'
  if (status === 'fail') return 'cancel'
  return 'warning'
}

/**
 * @param {import('./core/types.js').GenerationReport | undefined} report
 * @returns {Array<{ checkId: string, status: 'pass' | 'warn' | 'fail', summary: string, mapFocus?: import('./core/types.js').MapFocus }>}
 */
export function createValidationRowsForDisplay(report) {
  if (!report) return []
  return report.validationRows.filter(
    (row) => !HIDDEN_SIDEBAR_VALIDATION_CHECK_IDS.has(row.checkId),
  )
}

/**
 * @param {import('./core/types.js').GenerationReport | undefined} report
 * @returns {{ erosionStepCount: number, navigableRiverEdgeCount: number, coastalNodeCount: number }}
 */
export function createStageSummaryForDisplay(report) {
  return {
    erosionStepCount: report?.erosionStepCount ?? 0,
    navigableRiverEdgeCount: report?.navigableRiverEdgeCount ?? 0,
    coastalNodeCount: report?.coastalNodeCount ?? 0,
  }
}

/**
 * @param {import('./core/types.js').GenerationReport | undefined} report
 */
export function createHydrologyStatsForDisplay(report) {
  if (!report?.hydrology) {
    return {
      riverCellCount: null,
      navigableEdgeCount: null,
      hacksLawExponent: null,
      slopeAreaConcavityMedian: null,
      slopeAreaConcavitySampleCount: 0,
      parallelStrandRatio: null,
      navigableKmEstimate: null,
      mouthCount: null,
      breachCount: null,
      lakeCount: null,
      endorheicFraction: null,
      coastConnectedNavigablePathLength: null,
      shouldReject: false,
      rejectionReasons: [],
    }
  }
  const slopeAreaConcavityMedian = medianHydrologySamples(
    report.hydrology.slopeAreaConcavitySamples,
  )
  return {
    riverCellCount: report.hydrology.riverCellCount,
    navigableEdgeCount: report.hydrology.navigableEdgeCount,
    hacksLawExponent: report.hydrology.hacksLawExponent,
    slopeAreaConcavityMedian,
    slopeAreaConcavitySampleCount: report.hydrology.slopeAreaConcavitySamples.length,
    parallelStrandRatio: report.hydrology.parallelStrandRatio,
    navigableKmEstimate: report.hydrology.navigableKmEstimate,
    mouthCount: report.hydrology.mouthCount,
    breachCount: report.hydrology.breachCount,
    lakeCount: report.hydrology.lakeCount,
    endorheicFraction: report.hydrology.endorheicFraction,
    coastConnectedNavigablePathLength: report.hydrology.coastConnectedNavigablePathLength,
    shouldReject: report.shouldReject,
    rejectionReasons: [...report.rejectionReasons],
  }
}

/**
 * @param {number | null | undefined} value
 * @param {number} [digits]
 * @returns {string}
 */
export function formatHydrologyMetricValue(value, digits = 3) {
  if (value === null || value === undefined) {
    return 'n/a'
  }
  return value.toFixed(digits)
}

/**
 * @param {number | null | undefined} median
 * @param {number} sampleCount
 * @returns {string}
 */
export function formatSlopeAreaConcavityForDisplay(median, sampleCount) {
  if (median === null || median === undefined || sampleCount <= 0) {
    return 'n/a'
  }
  return `${median.toFixed(2)} (${sampleCount} samples)`
}

/**
 * @param {number[]} samples
 * @returns {number | null}
 */
function medianHydrologySamples(samples) {
  if (!samples || samples.length === 0) return null
  const sorted = [...samples].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

/**
 * @param {number} stepIndex
 * @param {number} stepCount
 * @returns {number}
 */
export function generationProgressValue(stepIndex, stepCount) {
  if (stepCount <= 0) return 0
  return Math.round(((stepIndex + 1) / stepCount) * 100)
}

/**
 * @returns {Array<{ id: string, kind: 'nodes' | 'raster' | 'rasterAndNodes', label: string }>}
 */
export function createResourceOverlayDefinitions() {
  return [
    { id: 'arable', kind: 'raster', label: 'Arable' },
    { id: 'timber', kind: 'raster', label: 'Timber' },
    { id: 'metals', kind: 'rasterAndNodes', label: 'Metals' },
    { id: 'salt', kind: 'nodes', label: 'Salt' },
  ]
}

/**
 * @returns {string[]}
 */
export function createResourceOverlayIds() {
  return createResourceOverlayDefinitions().map((definition) => definition.id)
}

/**
 * @returns {Record<string, boolean>}
 */
export function createDefaultResourceOverlayVisibility() {
  return Object.fromEntries(
    createResourceOverlayDefinitions().map((definition) => [definition.id, false]),
  )
}

/**
 * @param {boolean} isGenerating
 * @returns {boolean}
 */
export function shouldShowGenerationProgress(isGenerating) {
  return isGenerating
}

/**
 * @param {boolean} isGenerating
 * @param {boolean} pipelineSucceeded
 * @returns {boolean}
 */
export function shouldShowResourceOverlayBar(isGenerating, pipelineSucceeded) {
  return !isGenerating && pipelineSucceeded
}

/**
 * @param {ReadonlyArray<{ id: string, label: string }>} steps
 * @param {number} activeStepIndex
 * @param {number} completedStepIndex
 * @returns {Array<{ id: string, label: string, status: 'pending' | 'active' | 'complete' }>}
 */
export function createGenerationStepStatuses(steps, activeStepIndex, completedStepIndex) {
  return steps.map((step, index) => {
    if (index <= completedStepIndex) {
      return { ...step, status: 'complete' }
    }
    if (index === activeStepIndex) {
      return { ...step, status: 'active' }
    }
    return { ...step, status: 'pending' }
  })
}

/**
 * @param {ReadonlyArray<{ id: string, label: string }>} substeps
 * @param {number} activeSubstepIndex
 * @param {number} completedSubstepIndex
 * @param {ReadonlySet<string>} [skippedSubstepIds]
 * @returns {Array<{ id: string, label: string, status: 'pending' | 'active' | 'complete' | 'skipped' }>}
 */
export function createHydrologySubstepStatuses(
  substeps,
  activeSubstepIndex,
  completedSubstepIndex,
  skippedSubstepIds = new Set(),
) {
  return substeps.map((substep, index) => {
    if (skippedSubstepIds.has(substep.id)) {
      return { ...substep, status: 'skipped' }
    }
    if (index <= completedSubstepIndex) {
      return { ...substep, status: 'complete' }
    }
    if (index === activeSubstepIndex) {
      return { ...substep, status: 'active' }
    }
    return { ...substep, status: 'pending' }
  })
}

/**
 * @param {import('./core/types.js').HydrologySubstepTiming} row
 * @returns {string}
 */
export function formatHydrologySubstepTimingForDisplay(row) {
  if (row.skipped) {
    return 'Skipped'
  }
  return `${row.durationMs.toFixed(1)} ms`
}

/**
 * @param {import('./core/types.js').GenerationReport | undefined} report
 * @returns {import('./core/types.js').HydrologySubstepTiming[]}
 */
export function createHydrologySubstepTimingsForDisplay(report) {
  return report?.hydrologySubstepTimings ?? []
}
