import { LandmassPipelineCancelledError } from '../landmassPipelineTypes.js'
import { buildPipelineStateFromHydrologyWorld } from './buildPipelineStateFromHydrologyWorld.js'
import { createFlowFieldSession } from './flowField.js'
import {
  createRiverMaskPipeline,
  snapshotRiverMaskPipeline,
} from './riverMaskLifecycle.js'
import {
  HYDROLOGY_SUBSTEP_MODULES,
  selectHydrologySubstepInput,
} from './substeps/index.js'
import {
  createInitialHydrologyWorld,
  mergeHydrologyWorld,
} from './hydrologyWorldTypes.js'

/** @typedef {'hydrologyFill' | 'hydrologyClimate' | 'hydrologySeasonal' | 'hydrologyRoute' | 'hydrologyIncise' | 'hydrologyExtract' | 'hydrologyRefine' | 'hydrologySettle' | 'hydrologyPaint'} HydrologySubstepId */

/** @type {ReadonlyArray<{ id: HydrologySubstepId, label: string }>} */
export const HYDROLOGY_SUBSTEPS = HYDROLOGY_SUBSTEP_MODULES.map((module) => ({
  id: /** @type {HydrologySubstepId} */ (module.id),
  label: module.label,
}))

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
 * @property {(payload: { substepId: HydrologySubstepId, substepIndex: number, substepCount: number, label: string, input: Object }) => void} [onSubstepPrepare]
 * @property {() => boolean} [shouldCancel]
 */

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

  let world = createInitialHydrologyWorld(state)

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
    /** @type {Object} */
    let output = {}
    const shared = { flowFieldSession, riverMaskPipeline, onProgress }
    if (!skipped) {
      const startedAt = performance.now()
      output = module.run(input, shared)
      durationMs = performance.now() - startedAt
    } else if (module.runSkipped) {
      output = module.runSkipped(input, shared)
    }

    world = mergeHydrologyWorld(world, output)

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
    state: buildPipelineStateFromHydrologyWorld(
      /** @type {import('./hydrologyWorldTypes.js').HydrologyAfterPaint} */ (world),
      riverMaskPipeline,
    ),
    timings,
    flowField: {
      fullFlowSolveCount: flowFieldSession.fullFlowSolveCount,
      solveLog: flowFieldSession.solveLog,
    },
  }
}
