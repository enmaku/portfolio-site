import { isThenable } from './asyncValue.js'
import { BASELINE_NESTED_PHASES } from './landmassNestedPhases.js'
import { BIOMES_CATALOG } from './biomeCatalog.js'
import { buildBaselineInterimWorldDocument } from './buildBaselineInterimWorldDocument.js'
import { buildDisplayBiomes } from './buildDisplayBiomes.js'
import { classifyBiomesFromFields } from './classifyBiomesFromFields.js'
import { generateDrainage } from './fields/generateDrainage.js'
import { generateElevation } from './fields/generateElevation.js'
import { generateRainfall } from './fields/generateRainfall.js'
import { generateTemperature } from './fields/generateTemperature.js'
import { deriveSalinityFromOcean } from './fields/deriveSalinityFromOcean.js'
import {
  normalizeWindDegrees,
  resolveSecondaryMaximumDegrees,
} from './fields/prevailingWindField.js'
import {
  DEFAULT_GRID_SIZE,
  PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE,
} from './types.js'
import { resolveWorldGenerationOptions } from './worldGenerationOptions.js'

/**
 * @param {import('./types.js').PhysicalTerrainBaselineParams} params
 * @param {import('./landmassPipelineTypes.js').PipelineStepOptions} [stepOptions]
 * @returns {import('./types.js').WorldDocument | Promise<import('./types.js').WorldDocument>}
 */
export function generatePhysicalTerrainBaseline(params, stepOptions = {}) {
  if (typeof stepOptions.yield === 'function') {
    return generatePhysicalTerrainBaselineAsync(params, stepOptions)
  }
  return generatePhysicalTerrainBaselineSync(params, stepOptions)
}

/**
 * @param {import('./types.js').PhysicalTerrainBaselineParams} params
 * @param {import('./landmassPipelineTypes.js').PipelineStepOptions} stepOptions
 */
function generatePhysicalTerrainBaselineSync(params, stepOptions) {
  const ctx = createBaselineContext(params)
  emitPhase(stepOptions, 0, 0)
  const elevation = generateElevation({
    geographySeed: ctx.geographySeed,
    width: ctx.width,
    height: ctx.height,
    options: ctx.options,
  })
  emitPhase(stepOptions, 0, 1)
  emitPhase(stepOptions, 1, 0)
  const rainfall = generateRainfall({
    geographySeed: ctx.geographySeed,
    width: ctx.width,
    height: ctx.height,
    elevation,
    prevailingWindDegrees: ctx.prevailingWindDegrees,
    secondaryMaximumDegrees: ctx.secondaryMaximumDegrees,
    options: ctx.options,
    onProgress: (progress) => emitPhaseProgress(stepOptions, 1, progress),
  })
  emitPhase(stepOptions, 1, 1)
  emitPhase(stepOptions, 2, 0)
  const doc = finishBaseline(ctx, elevation, rainfall)
  emitPhase(stepOptions, 2, 1)
  return doc
}

/**
 * @param {import('./types.js').PhysicalTerrainBaselineParams} params
 * @param {import('./landmassPipelineTypes.js').PipelineStepOptions} stepOptions
 */
async function generatePhysicalTerrainBaselineAsync(params, stepOptions) {
  const ctx = createBaselineContext(params)
  /** @type {import('./buildBaselineInterimWorldDocument.js').BaselineInterimClimateCache | undefined} */
  let climateCache

  emitPhase(stepOptions, 0, 0)
  const elevation = generateElevation({
    geographySeed: ctx.geographySeed,
    width: ctx.width,
    height: ctx.height,
    options: ctx.options,
  })
  const elevationPreview = buildBaselineInterimWorldDocument({
    ...ctx,
    elevation,
    rainfall: new Float32Array(ctx.width * ctx.height),
    climateCache,
  })
  climateCache = elevationPreview.climateCache
  emitPhase(stepOptions, 0, 1, elevationPreview.worldDocument)
  await stepOptions.yield?.()

  emitPhase(stepOptions, 1, 0)
  const rainfallResult = generateRainfall({
    geographySeed: ctx.geographySeed,
    width: ctx.width,
    height: ctx.height,
    elevation,
    prevailingWindDegrees: ctx.prevailingWindDegrees,
    secondaryMaximumDegrees: ctx.secondaryMaximumDegrees,
    options: ctx.options,
    onProgress: (progress) => emitPhaseProgress(stepOptions, 1, progress),
    onLobe: async ({ rainfall, lobeIndex, lobeCount }) => {
      const lobePreview = buildBaselineInterimWorldDocument({
        ...ctx,
        elevation,
        rainfall,
        climateCache,
      })
      climateCache = lobePreview.climateCache
      emitPhaseProgress(stepOptions, 1, (lobeIndex + 1) / lobeCount, lobePreview.worldDocument)
    },
    yield: stepOptions.yield,
  })
  const rainfall = isThenable(rainfallResult) ? await rainfallResult : rainfallResult
  emitPhase(stepOptions, 1, 1)
  await stepOptions.yield?.()

  emitPhase(stepOptions, 2, 0)
  const doc = finishBaseline(ctx, elevation, rainfall)
  emitPhase(stepOptions, 2, 1)
  await stepOptions.yield?.()
  return doc
}

/**
 * @param {import('./types.js').PhysicalTerrainBaselineParams} params
 */
function createBaselineContext(params) {
  const width = params.width ?? DEFAULT_GRID_SIZE
  const height = params.height ?? DEFAULT_GRID_SIZE
  const geographySeed = params.geographySeed | 0
  const prevailingWindDegrees = normalizeWindDegrees(params.prevailingWindDegrees)
  const secondaryMaximumDegrees = resolveSecondaryMaximumDegrees(
    prevailingWindDegrees,
    params.secondaryMaximumDegrees,
  )
  const options = resolveWorldGenerationOptions(params.options)
  return {
    width,
    height,
    geographySeed,
    prevailingWindDegrees,
    secondaryMaximumDegrees,
    options,
  }
}

/**
 * @param {ReturnType<typeof createBaselineContext>} ctx
 * @param {Float32Array} elevation
 * @param {Float32Array} rainfall
 */
function finishBaseline(ctx, elevation, rainfall) {
  const { geographySeed, width, height, options, prevailingWindDegrees, secondaryMaximumDegrees } =
    ctx
  const temperature = generateTemperature({ geographySeed, width, height, elevation, options })
  const drainage = generateDrainage({ geographySeed, width, height, options })
  const salinity = deriveSalinityFromOcean({
    elevation,
    width,
    height,
    seaLevel: options.seaLevel,
  })
  const fields = { elevation, temperature, rainfall, drainage, salinity }
  const biomes = classifyBiomesFromFields(
    fields,
    width,
    height,
    options.seaLevel,
    geographySeed,
    options.biomeEdgeNoiseStrength,
  )
  const displayBiomes = buildDisplayBiomes(biomes, fields, options.seaLevel)
  return {
    geographySeed: geographySeed >= 0 ? geographySeed : geographySeed + 4294967296,
    prevailingWindDegrees,
    secondaryMaximumDegrees,
    gridWidth: width,
    gridHeight: height,
    fields,
    biomes,
    displayBiomes,
    biomeCatalog: BIOMES_CATALOG,
    generatedAt: new Date().toISOString(),
    pipelineStage: PIPELINE_STAGE_PHYSICAL_TERRAIN_BASELINE,
  }
}

/**
 * @param {import('./landmassPipelineTypes.js').PipelineStepOptions} stepOptions
 * @param {number} phaseIndex
 * @param {0 | 1} edge 0 start, 1 complete
 * @param {import('./types.js').WorldDocument} [worldDocument]
 */
function emitPhase(stepOptions, phaseIndex, edge, worldDocument) {
  const phase = BASELINE_NESTED_PHASES[phaseIndex]
  const payload = {
    substepId: phase.id,
    substepIndex: phaseIndex,
    substepCount: BASELINE_NESTED_PHASES.length,
    label: phase.label,
    parentStepId: 'physicalTerrainBaseline',
    progress: edge,
    worldDocument,
  }
  if (edge === 0) {
    stepOptions.onSubstepStart?.(payload)
    stepOptions.onSubstepProgress?.(payload)
  } else {
    stepOptions.onSubstepProgress?.(payload)
    stepOptions.onSubstepComplete?.(payload)
  }
}

/**
 * @param {import('./landmassPipelineTypes.js').PipelineStepOptions} stepOptions
 * @param {number} phaseIndex
 * @param {number} progress
 * @param {import('./types.js').WorldDocument} [worldDocument]
 */
function emitPhaseProgress(stepOptions, phaseIndex, progress, worldDocument) {
  const phase = BASELINE_NESTED_PHASES[phaseIndex]
  stepOptions.onSubstepProgress?.({
    substepId: phase.id,
    substepIndex: phaseIndex,
    substepCount: BASELINE_NESTED_PHASES.length,
    label: phase.label,
    parentStepId: 'physicalTerrainBaseline',
    progress,
    worldDocument,
  })
}
