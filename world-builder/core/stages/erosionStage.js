import {
  classifyBiomesFromFields,
} from '../classifyBiomesFromFields.js'
import { applyErosion } from '../erosion/applyErosion.js'
import { refreshClimateScalarsAfterElevationMutation } from '../fields/refreshClimateScalarsAfterElevationMutation.js'
import { isThenable } from '../asyncValue.js'
import { EROSION_NESTED_PHASES } from '../landmassNestedPhases.js'

/** @typedef {import('./moduleTypes.js').LandmassStageModule} LandmassStageModule */

/** @type {LandmassStageModule} */
export const erosionStage = {
  id: 'erosion',
  label: 'Erosion',
  inputs: {
    geographySeed: (state) => state.geographySeed,
    prevailingWindDegrees: (state) => state.prevailingWindDegrees,
    secondaryMaximumDegrees: (state) => state.secondaryMaximumDegrees,
    options: (state) => state.options,
    width: (state) => state.width,
    height: (state) => state.height,
    baselineDoc: (state) => {
      if (state.lastCompletedStep !== 'physicalTerrainBaseline') {
        throw new Error('physicalTerrainBaseline required before erosion')
      }
      if (!state.baselineDoc) {
        throw new Error('physicalTerrainBaseline baselineDoc required before erosion')
      }
      return state.baselineDoc
    },
  },
  outputKeys: [
    'erodedElevation',
    'erosionSnapshots',
    'erosionStepCount',
    'workingElevation',
    'fields',
    'biomes',
    'lastCompletedStep',
  ],
  run(input, stepOptions = {}) {
    if (typeof stepOptions.yield === 'function') {
      return runErosionStageAsync(input, stepOptions)
    }
    return runErosionStageSync(input, stepOptions)
  },
}

/**
 * @param {Object} input
 * @param {import('../landmassPipelineTypes.js').PipelineStepOptions} stepOptions
 */
function runErosionStageSync(input, stepOptions) {
  const {
    geographySeed,
    prevailingWindDegrees,
    secondaryMaximumDegrees,
    options,
    width,
    height,
    baselineDoc,
  } = input

  emitErosionPhase(stepOptions, 0, 0)
  const { elevation: erodedElevation, snapshots, stepCount } = applyErosion({
    elevation: baselineDoc.fields.elevation,
    width,
    height,
    geographySeed,
    options,
    onProgress: (progress) => emitErosionPhaseProgress(stepOptions, 0, progress),
  })
  emitErosionPhase(stepOptions, 0, 1)

  emitErosionPhase(stepOptions, 1, 0)
  const previewFields = refreshClimateScalarsAfterElevationMutation({
    geographySeed,
    prevailingWindDegrees,
    secondaryMaximumDegrees,
    elevation: erodedElevation,
    drainage: baselineDoc.fields.drainage,
    width,
    height,
    options,
    onProgress: (progress) => emitErosionPhaseProgress(stepOptions, 1, progress),
  })
  const biomes = options.enableIntermediateStepPreviews
    ? classifyBiomesFromFields(
        previewFields,
        width,
        height,
        options.seaLevel,
        geographySeed,
        options.biomeEdgeNoiseStrength,
      )
    : baselineDoc.biomes
  emitErosionPhase(stepOptions, 1, 1)

  return {
    erodedElevation,
    erosionSnapshots: snapshots,
    erosionStepCount: stepCount,
    workingElevation: erodedElevation,
    fields: previewFields,
    biomes,
    lastCompletedStep: /** @type {const} */ ('erosion'),
  }
}

/**
 * @param {Object} input
 * @param {import('../landmassPipelineTypes.js').PipelineStepOptions} stepOptions
 */
async function runErosionStageAsync(input, stepOptions) {
  const {
    geographySeed,
    prevailingWindDegrees,
    secondaryMaximumDegrees,
    options,
    width,
    height,
    baselineDoc,
  } = input

  emitErosionPhase(stepOptions, 0, 0)
  const carveResult = applyErosion({
    elevation: baselineDoc.fields.elevation,
    width,
    height,
    geographySeed,
    options,
    onProgress: (progress) => emitErosionPhaseProgress(stepOptions, 0, progress),
    yield: stepOptions.yield,
  })
  const { elevation: erodedElevation, snapshots, stepCount } = isThenable(carveResult)
    ? await carveResult
    : carveResult
  emitErosionPhase(stepOptions, 0, 1)
  await stepOptions.yield?.()

  emitErosionPhase(stepOptions, 1, 0)
  const fieldsResult = refreshClimateScalarsAfterElevationMutation({
    geographySeed,
    prevailingWindDegrees,
    secondaryMaximumDegrees,
    elevation: erodedElevation,
    drainage: baselineDoc.fields.drainage,
    width,
    height,
    options,
    onProgress: (progress) => emitErosionPhaseProgress(stepOptions, 1, progress),
    yield: stepOptions.yield,
  })
  const previewFields = isThenable(fieldsResult) ? await fieldsResult : fieldsResult
  const biomes = options.enableIntermediateStepPreviews
    ? classifyBiomesFromFields(
        previewFields,
        width,
        height,
        options.seaLevel,
        geographySeed,
        options.biomeEdgeNoiseStrength,
      )
    : baselineDoc.biomes
  emitErosionPhase(stepOptions, 1, 1)
  await stepOptions.yield?.()

  return {
    erodedElevation,
    erosionSnapshots: snapshots,
    erosionStepCount: stepCount,
    workingElevation: erodedElevation,
    fields: previewFields,
    biomes,
    lastCompletedStep: /** @type {const} */ ('erosion'),
  }
}

/**
 * @param {import('../landmassPipelineTypes.js').PipelineStepOptions} stepOptions
 * @param {number} phaseIndex
 * @param {0 | 1} edge
 */
function emitErosionPhase(stepOptions, phaseIndex, edge) {
  const phase = EROSION_NESTED_PHASES[phaseIndex]
  const payload = {
    substepId: phase.id,
    substepIndex: phaseIndex,
    substepCount: EROSION_NESTED_PHASES.length,
    label: phase.label,
    parentStepId: 'erosion',
    progress: edge,
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
 * @param {import('../landmassPipelineTypes.js').PipelineStepOptions} stepOptions
 * @param {number} phaseIndex
 * @param {number} progress
 */
function emitErosionPhaseProgress(stepOptions, phaseIndex, progress) {
  const phase = EROSION_NESTED_PHASES[phaseIndex]
  stepOptions.onSubstepProgress?.({
    substepId: phase.id,
    substepIndex: phaseIndex,
    substepCount: EROSION_NESTED_PHASES.length,
    label: phase.label,
    parentStepId: 'erosion',
    progress,
  })
}
