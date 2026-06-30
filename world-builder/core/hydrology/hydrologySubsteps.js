import { classifyBiomesWithHydrology } from '../classifyBiomesFromFields.js'
import { refreshClimateScalarsAfterElevationMutation } from '../fields/refreshClimateScalarsAfterElevationMutation.js'
import { LandmassPipelineCancelledError } from '../landmassPipelineTypes.js'
import { createFlowFieldSession } from './flowField.js'
import { applyLakeSurfacesFromMeta } from './lakeDisplayCoherence.js'
import {
  createRiverMaskPipeline,
  getRiverMaskStage,
  snapshotRiverMaskPipeline,
} from './riverMaskLifecycle.js'
import {
  HYDROLOGY_SUBSTEP_MODULES,
  selectHydrologySubstepInput,
} from './hydrologySubstepModules.js'

/** @typedef {'hydrologyFill' | 'hydrologyClimate' | 'hydrologySeasonal' | 'hydrologyRoute' | 'hydrologyIncise' | 'hydrologyExtract' | 'hydrologyRefine' | 'hydrologySettle' | 'hydrologyPaint'} HydrologySubstepId */

/** @type {ReadonlyArray<{ id: HydrologySubstepId, label: string }>} */
export const HYDROLOGY_SUBSTEPS = HYDROLOGY_SUBSTEP_MODULES.map((module) => ({
  id: /** @type {HydrologySubstepId} */ (module.id),
  label: module.label,
}))

/**
 * @typedef {import('./hydrologySubstepModules.js').HydrologyWorld} HydrologyWorld
 */

/**
 * @typedef {Object} HydrologySubstepTiming
 * @property {HydrologySubstepId} substepId
 * @property {string} label
 * @property {number} durationMs
 * @property {boolean=} skipped
 */

/**
 * @typedef {Object} HydrologySubstepHooks
 * @property {(payload: { substepId: HydrologySubstepId, substepIndex: number, substepCount: number, label: string }) => void} [onSubstepStart]
 * @property {(payload: { substepId: HydrologySubstepId, substepIndex: number, substepCount: number, label: string, progress: number }) => void} [onSubstepProgress]
 * @property {(payload: { substepId: HydrologySubstepId, substepIndex: number, substepCount: number, label: string, progress: number, skipped?: boolean, transition?: string, maskLifecycle?: ReturnType<typeof snapshotRiverMaskPipeline> }) => void} [onSubstepComplete]
 * @property {(payload: { substepId: HydrologySubstepId, substepIndex: number, substepCount: number, label: string, input: Record<string, unknown> }) => void} [onSubstepPrepare]
 * @property {() => boolean} [shouldCancel]
 */

/**
 * @param {HydrologyWorld} world
 * @returns {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState}
 */
function buildPipelineStateFromHydrologyWorld(world) {
  const { state, width, height } = world
  const settledElevation = /** @type {Float32Array} */ (world.settledElevation)
  const lakeIdByCell = /** @type {Int32Array | null} */ (world.lakeIdByCell)
  const lakeMeta = /** @type {import('../types.js').LakeMetaRecord[] | null} */ (world.lakeMeta)
  const lakeMask = /** @type {Uint8Array | null} */ (world.lakeMask)
  if (lakeIdByCell && lakeMeta && lakeMask) {
    applyLakeSurfacesFromMeta(settledElevation, lakeIdByCell, lakeMeta, lakeMask, width, height)
  }

  const previewFields = refreshClimateScalarsAfterElevationMutation({
    geographySeed: state.geographySeed,
    prevailingWindDegrees: state.prevailingWindDegrees,
    elevation: settledElevation,
    drainage: /** @type {Float32Array} */ (world.settledDrainage),
    width,
    height,
    options: state.options,
  })

  const riverNetwork = /** @type {import('../types.js').RiverNetwork} */ (world.riverNetwork)

  return {
    ...state,
    lakeMask,
    lakes: /** @type {import('../types.js').LakeRecord[] | null} */ (world.lakes),
    lakeMeta,
    lakeIdByCell,
    hydrologyStats: /** @type {import('../types.js').HydrologyPipelineStats | null} */ (
      world.hydrologyStats
    ),
    workingElevation: settledElevation,
    riverGraph: riverNetwork.graph,
    simulationRiverMask: riverNetwork.simulationCenterline,
    riverNetworkMask: riverNetwork.centerline,
    riverCorridorMask: riverNetwork.corridor,
    channelWidth: /** @type {Float32Array} */ (world.channelWidth),
    flowDirection: /** @type {Int16Array} */ (world.settledFlowDirection),
    fields: previewFields,
    biomes: classifyBiomesWithHydrology(
      previewFields,
      width,
      height,
      {
        lakeMask,
        riverCorridorMask: getRiverMaskStage(world.riverMaskPipeline, 'painted'),
        flowDirection: /** @type {Int16Array} */ (world.settledFlowDirection),
      },
      state.options.seaLevel,
      state.geographySeed,
      state.options.biomeEdgeNoiseStrength,
    ),
    lastCompletedStep: 'hydrology',
  }
}

/**
 * @param {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState} state
 * @param {HydrologySubstepHooks} [hooks]
 * @returns {{
 *   state: import('../landmassPipelineTypes.js').DerivedGeographyPipelineState,
 *   timings: HydrologySubstepTiming[],
 *   flowField: { fullFlowSolveCount: number, solveLog: import('./flowField.js').FlowRecomputeLogEntry[] },
 * }}
 */
export function runHydrologySubsteps(state, hooks = {}) {
  const flowFieldSession = createFlowFieldSession()
  const riverMaskPipeline = createRiverMaskPipeline()

  /** @type {HydrologyWorld} */
  let world = {
    state,
    width: state.width,
    height: state.height,
    riverMaskPipeline,
  }

  const substepCount = HYDROLOGY_SUBSTEP_MODULES.length
  /** @type {HydrologySubstepTiming[]} */
  const timings = []

  for (let substepIndex = 0; substepIndex < substepCount; substepIndex += 1) {
    if (hooks.shouldCancel?.()) {
      throw new LandmassPipelineCancelledError(world.state)
    }

    const module = HYDROLOGY_SUBSTEP_MODULES[substepIndex]
    const substepId = /** @type {HydrologySubstepId} */ (module.id)
    const skipped = module.shouldSkip?.(world) ?? false

    hooks.onSubstepStart?.({ substepId, substepIndex, substepCount, label: module.label })
    hooks.onSubstepProgress?.({ substepId, substepIndex, substepCount, label: module.label, progress: 0 })

    const input = selectHydrologySubstepInput(module, world)
    hooks.onSubstepPrepare?.({ substepId, substepIndex, substepCount, label: module.label, input })

    const onProgress = (/** @type {number} */ progress) => {
      hooks.onSubstepProgress?.({ substepId, substepIndex, substepCount, label: module.label, progress })
    }

    let durationMs = 0
    /** @type {Record<string, unknown>} */
    let output = {}
    if (!skipped) {
      const startedAt = performance.now()
      output = module.run(input, { flowFieldSession, riverMaskPipeline, onProgress })
      durationMs = performance.now() - startedAt
    } else if (module.runSkipped) {
      output = module.runSkipped(input, { flowFieldSession, riverMaskPipeline, onProgress })
    }

    world = { ...world, ...output }

    hooks.onSubstepProgress?.({ substepId, substepIndex, substepCount, label: module.label, progress: 1 })
    hooks.onSubstepComplete?.({
      substepId,
      substepIndex,
      substepCount,
      label: module.label,
      progress: 1,
      skipped,
      transition: skipped ? module.skipTransition : undefined,
      maskLifecycle: snapshotRiverMaskPipeline(riverMaskPipeline),
    })
    timings.push({ substepId, label: module.label, durationMs, skipped })
  }

  return {
    state: buildPipelineStateFromHydrologyWorld(world),
    timings,
    flowField: {
      fullFlowSolveCount: flowFieldSession.fullFlowSolveCount,
      solveLog: flowFieldSession.solveLog,
    },
  }
}
