import { LandmassPipelineCancelledError } from '../landmassPipelineTypes.js'
import { isThenable } from '../asyncValue.js'
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

/** @typedef {'hydrologyFill' | 'hydrologyClimate' | 'hydrologySeasonal' | 'hydrologyRoute' | 'hydrologyIncise' | 'hydrologyExtract' | 'hydrologyRefine' | 'hydrologySettle' | 'hydrologyPaint' | 'hydrologyFinalize'} HydrologySubstepId */

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
 * @property {(payload: { substepId: HydrologySubstepId, substepIndex: number, substepCount: number, label: string, parentStepId?: string }) => void} [onSubstepStart]
 * @property {(payload: { substepId: HydrologySubstepId, substepIndex: number, substepCount: number, label: string, progress: number, parentStepId?: string, worldDocument?: import('../types.js').WorldDocument | null }) => void} [onSubstepProgress]
 * @property {(payload: { substepId: HydrologySubstepId, substepIndex: number, substepCount: number, label: string, progress: number, skipped?: boolean, transition?: string, maskLifecycle?: ReturnType<typeof snapshotRiverMaskPipeline>, parentStepId?: string, worldDocument?: import('../types.js').WorldDocument | null }) => void} [onSubstepComplete]
 * @property {(payload: { substepId: HydrologySubstepId, substepIndex: number, substepCount: number, label: string, input: Object, parentStepId?: string }) => void} [onSubstepPrepare]
 * @property {() => boolean | Promise<boolean>} [shouldCancel]
 * @property {() => void | Promise<void>} [yield]
 * @property {(payload: { substepId: HydrologySubstepId, world: Object, riverMaskPipeline: ReturnType<typeof createRiverMaskPipeline> }) => import('../types.js').WorldDocument | null | undefined | Promise<import('../types.js').WorldDocument | null | undefined>} [buildSubstepPreview]
 */

/**
 * @type {ReadonlySet<string>}
 */
export const HYDROLOGY_MAP_REDRAW_SUBSTEP_IDS = new Set([
  'hydrologyFill',
  'hydrologySeasonal',
  'hydrologyRoute',
  'hydrologyExtract',
  'hydrologyRefine',
  'hydrologyPaint',
])

/**
 * @param {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState} state
 * @param {HydrologySubstepHooks} [hooks]
 * @returns {{
 *   state: import('../landmassPipelineTypes.js').DerivedGeographyPipelineState,
 *   timings: HydrologySubstepTiming[],
 *   flowField: { fullFlowSolveCount: number, solveLog: import('./flowField.js').FlowRecomputeLogEntry[] },
 * } | Promise<{
 *   state: import('../landmassPipelineTypes.js').DerivedGeographyPipelineState,
 *   timings: HydrologySubstepTiming[],
 *   flowField: { fullFlowSolveCount: number, solveLog: import('./flowField.js').FlowRecomputeLogEntry[] },
 * }>}
 */
export function runHydrologySubsteps(state, hooks = {}) {
  if (typeof hooks.yield === 'function') {
    return runHydrologySubstepsAsync(state, hooks)
  }
  return runHydrologySubstepsSync(state, hooks)
}

/**
 * @param {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState} state
 * @param {HydrologySubstepHooks} hooks
 */
function runHydrologySubstepsSync(state, hooks) {
  const flowFieldSession = createFlowFieldSession()
  const riverMaskPipeline = createRiverMaskPipeline()
  let world = createInitialHydrologyWorld(state)
  const substepCount = HYDROLOGY_SUBSTEP_MODULES.length
  /** @type {HydrologySubstepTiming[]} */
  const timings = []
  const parentStepId = 'hydrology'

  for (let substepIndex = 0; substepIndex < substepCount; substepIndex += 1) {
    if (hooks.shouldCancel?.()) {
      throw new LandmassPipelineCancelledError(world.state)
    }
    const result = runOneHydrologySubstep({
      world,
      substepIndex,
      substepCount,
      parentStepId,
      hooks,
      flowFieldSession,
      riverMaskPipeline,
      allowAsyncRun: false,
    })
    if (isThenable(result)) {
      throw new TypeError('hydrology substep returned a Promise without a yield hook')
    }
    world = result.world
    timings.push(result.timing)
  }

  return {
    state: buildPipelineStateFromHydrologyWorld(
      /** @type {import('./hydrologyWorldTypes.js').HydrologyAfterFinalize} */ (world),
      riverMaskPipeline,
    ),
    timings,
    flowField: {
      fullFlowSolveCount: flowFieldSession.fullFlowSolveCount,
      solveLog: flowFieldSession.solveLog,
    },
  }
}

/**
 * @param {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState} state
 * @param {HydrologySubstepHooks} hooks
 */
async function runHydrologySubstepsAsync(state, hooks) {
  const flowFieldSession = createFlowFieldSession()
  const riverMaskPipeline = createRiverMaskPipeline()
  let world = createInitialHydrologyWorld(state)
  const substepCount = HYDROLOGY_SUBSTEP_MODULES.length
  /** @type {HydrologySubstepTiming[]} */
  const timings = []
  const parentStepId = 'hydrology'

  for (let substepIndex = 0; substepIndex < substepCount; substepIndex += 1) {
    if (await hooks.shouldCancel?.()) {
      throw new LandmassPipelineCancelledError(world.state)
    }
    const result = await runOneHydrologySubstep({
      world,
      substepIndex,
      substepCount,
      parentStepId,
      hooks,
      flowFieldSession,
      riverMaskPipeline,
      allowAsyncRun: true,
    })
    world = result.world
    timings.push(result.timing)
    await hooks.yield?.()
  }

  return {
    state: buildPipelineStateFromHydrologyWorld(
      /** @type {import('./hydrologyWorldTypes.js').HydrologyAfterFinalize} */ (world),
      riverMaskPipeline,
    ),
    timings,
    flowField: {
      fullFlowSolveCount: flowFieldSession.fullFlowSolveCount,
      solveLog: flowFieldSession.solveLog,
    },
  }
}

/**
 * @param {Object} params
 */
function runOneHydrologySubstep({
  world,
  substepIndex,
  substepCount,
  parentStepId,
  hooks,
  flowFieldSession,
  riverMaskPipeline,
  allowAsyncRun,
}) {
  const module = HYDROLOGY_SUBSTEP_MODULES[substepIndex]
  const substepId = /** @type {HydrologySubstepId} */ (module.id)
  const skipped = module.shouldSkip?.(world) ?? false

  hooks.onSubstepStart?.({
    substepId,
    substepIndex,
    substepCount,
    label: module.label,
    parentStepId,
  })
  hooks.onSubstepProgress?.({
    substepId,
    substepIndex,
    substepCount,
    label: module.label,
    progress: 0,
    parentStepId,
  })

  const input = selectHydrologySubstepInput(module, world)
  hooks.onSubstepPrepare?.({
    substepId,
    substepIndex,
    substepCount,
    label: module.label,
    input,
    parentStepId,
  })

  const onProgress = (/** @type {number} */ progress) => {
    hooks.onSubstepProgress?.({
      substepId,
      substepIndex,
      substepCount,
      label: module.label,
      progress,
      parentStepId,
    })
  }

  const shared = {
    flowFieldSession,
    riverMaskPipeline,
    onProgress,
    yield: allowAsyncRun ? hooks.yield : undefined,
  }

  const startedAt = performance.now()
  /** @type {Object | Promise<Object>} */
  let outputOrPromise = {}
  if (!skipped) {
    outputOrPromise = module.run(input, shared)
  } else if (module.runSkipped) {
    outputOrPromise = module.runSkipped(input, shared)
  }

  const finish = (output, previewDocument) => {
    const nextWorld = mergeHydrologyWorld(world, output)
    hooks.onSubstepProgress?.({
      substepId,
      substepIndex,
      substepCount,
      label: module.label,
      progress: 1,
      parentStepId,
    })
    hooks.onSubstepComplete?.({
      substepId,
      substepIndex,
      substepCount,
      label: module.label,
      progress: 1,
      skipped,
      transition: skipped ? module.skipTransition : undefined,
      maskLifecycle: snapshotRiverMaskPipeline(riverMaskPipeline),
      parentStepId,
      worldDocument: previewDocument ?? undefined,
    })
    return {
      world: nextWorld,
      timing: {
        substepId,
        label: module.label,
        durationMs: skipped ? 0 : performance.now() - startedAt,
        skipped,
      },
    }
  }

  const maybePreview = (nextWorld) => {
    if (skipped || !HYDROLOGY_MAP_REDRAW_SUBSTEP_IDS.has(substepId) || !hooks.buildSubstepPreview) {
      return undefined
    }
    return hooks.buildSubstepPreview({
      substepId,
      world: nextWorld,
      riverMaskPipeline,
    })
  }

  if (isThenable(outputOrPromise)) {
    if (!allowAsyncRun) {
      throw new TypeError('hydrology substep returned a Promise without a yield hook')
    }
    return outputOrPromise.then(async (output) => {
      const nextWorld = mergeHydrologyWorld(world, output)
      let previewDocument = maybePreview(nextWorld)
      if (isThenable(previewDocument)) {
        previewDocument = await previewDocument
      }
      return finish(output, previewDocument)
    })
  }

  const nextWorld = mergeHydrologyWorld(world, outputOrPromise)
  const previewDocument = maybePreview(nextWorld)
  if (isThenable(previewDocument)) {
    if (!allowAsyncRun) {
      throw new TypeError('hydrology preview returned a Promise without a yield hook')
    }
    return previewDocument.then((doc) => finish(outputOrPromise, doc))
  }
  return finish(outputOrPromise, previewDocument)
}
