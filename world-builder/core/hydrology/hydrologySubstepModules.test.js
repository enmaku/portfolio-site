import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HYDROLOGY_SUBSTEP_MODULES,
  HYDROLOGY_SUBSTEP_MODULE_BY_ID,
  selectHydrologySubstepInput,
} from './hydrologySubstepModules.js'
import {
  createRiverMaskPipeline,
  getRiverMaskStage,
} from './riverMaskLifecycle.js'
import { createFlowFieldSession } from './flowField.js'
import {
  createInitialPipelineState,
  runPipelineStep,
} from '../derivedGeographyPipeline.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../worldGenerationOptions.js'

const params = {
  geographySeed: 12345,
  prevailingWindDegrees: 90,
  width: 48,
  height: 48,
}

/** @param {Record<string, unknown>} [options] */
function erodedState(options) {
  let state = createInitialPipelineState(options ? { ...params, options } : params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  return runPipelineStep(state, 'erosion')
}

/**
 * Thread the substep modules forward by composition, mirroring the runner without hooks.
 * @param {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState} state
 * @param {import('./hydrologySubsteps.js').HydrologySubstepId} [stopAfter]
 */
function composeSubsteps(state, stopAfter) {
  const flowFieldSession = createFlowFieldSession()
  const riverMaskPipeline = createRiverMaskPipeline()
  const noop = () => {}
  /** @type {import('./hydrologySubstepModules.js').HydrologyWorld} */
  let world = { state, width: state.width, height: state.height, riverMaskPipeline }
  /** @type {string[]} */
  const ran = []

  for (const module of HYDROLOGY_SUBSTEP_MODULES) {
    const input = selectHydrologySubstepInput(module, world)
    const skipped = module.shouldSkip?.(world) ?? false
    const shared = { flowFieldSession, riverMaskPipeline, onProgress: noop }
    let output = {}
    if (!skipped) {
      output = module.run(input, shared)
    } else if (module.runSkipped) {
      output = module.runSkipped(input, shared)
    }
    world = { ...world, ...output }
    ran.push(`${module.id}${skipped ? ':skipped' : ''}`)
    if (module.id === stopAfter) break
  }

  return { world, flowFieldSession, riverMaskPipeline, ran }
}

test('hydrologyFill module derives an ocean mask and fills lakes from its narrow input', () => {
  const { world } = composeSubsteps(erodedState(), 'hydrologyFill')

  assert.ok(Array.isArray(world.ocean))
  assert.strictEqual(world.ocean.length, params.width * params.height)
  assert.ok(world.lakeMask instanceof Uint8Array)
  assert.ok(world.filledElevation instanceof Float32Array)
  assert.strictEqual(typeof world.hydrologyStats.lakeCount, 'number')
})

test('composition does not seed a nullable context: produced keys appear only after their substep', () => {
  const state = erodedState()
  const flowFieldSession = createFlowFieldSession()
  const riverMaskPipeline = createRiverMaskPipeline()
  const world = { state, width: state.width, height: state.height, riverMaskPipeline }

  assert.ok(!('ocean' in world))
  assert.ok(!('flowDirection' in world))
  assert.ok(!('riverNetwork' in world))

  const fill = HYDROLOGY_SUBSTEP_MODULE_BY_ID.hydrologyFill
  const output = fill.run(selectHydrologySubstepInput(fill, world), {
    flowFieldSession,
    riverMaskPipeline,
    onProgress: () => {},
  })
  assert.ok('ocean' in output)
  assert.ok(!('flowDirection' in output))
})

test('hydrologyClimate module recomputes rainfall and temperature on eroded elevation', () => {
  const state = erodedState()
  const { world } = composeSubsteps(state, 'hydrologyClimate')

  assert.ok(world.temperature instanceof Float32Array)
  assert.ok(world.rainfall instanceof Float32Array)

  const baseline = state.baselineDoc.fields
  const temperatureChanged = world.temperature.some(
    (value, idx) => value !== baseline.temperature[idx],
  )
  assert.ok(temperatureChanged)
})

test('hydrologyRoute module performs exactly one full flow solve and sets the sketch mask', () => {
  const { world, flowFieldSession, riverMaskPipeline } = composeSubsteps(
    erodedState(),
    'hydrologyRoute',
  )

  assert.strictEqual(flowFieldSession.fullFlowSolveCount, 1)
  assert.ok(world.flowDirection instanceof Int16Array)
  assert.ok(getRiverMaskStage(riverMaskPipeline, 'sketch')?.some((value) => value === 1))
})

test('hydrologyIncise module carves elevation and sets the incised mask', () => {
  const { world, riverMaskPipeline } = composeSubsteps(erodedState(), 'hydrologyIncise')

  assert.ok(world.settledElevation instanceof Float32Array)
  assert.ok(getRiverMaskStage(riverMaskPipeline, 'incised')?.some((value) => value === 1))
})

test('hydrologyExtract module performs the post-incision flow solve and builds a river graph', () => {
  const { world, flowFieldSession, riverMaskPipeline } = composeSubsteps(
    erodedState(),
    'hydrologyExtract',
  )

  assert.strictEqual(flowFieldSession.fullFlowSolveCount, 2)
  assert.ok(world.settledRiverGraph)
  assert.ok(getRiverMaskStage(riverMaskPipeline, 'settled')?.some((value) => value === 1))
})

test('hydrologyRefine module is skipped when meander refine is disabled, copying settled to presentation', () => {
  const options = { ...DEFAULT_WORLD_GENERATION_OPTIONS, enableMeanderRefine: false }
  const { ran, riverMaskPipeline } = composeSubsteps(erodedState(options), 'hydrologyRefine')

  assert.ok(ran.includes('hydrologyRefine:skipped'))
  assert.equal(
    getRiverMaskStage(riverMaskPipeline, 'presentation'),
    getRiverMaskStage(riverMaskPipeline, 'settled'),
  )
})

test('hydrologyRefine module runs and produces a presentation mask when meander refine is enabled', () => {
  const options = {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    enableMeanderRefine: true,
    riverMeanderStrength: 1,
  }
  const { ran, riverMaskPipeline } = composeSubsteps(erodedState(options), 'hydrologyRefine')

  assert.ok(ran.includes('hydrologyRefine'))
  assert.ok(!ran.includes('hydrologyRefine:skipped'))
  assert.ok(getRiverMaskStage(riverMaskPipeline, 'presentation')?.some((value) => value === 1))
})

test('hydrologySettle module performs the post-equilibrium flow solve and derives drainage', () => {
  const { world, flowFieldSession } = composeSubsteps(erodedState(), 'hydrologySettle')

  assert.strictEqual(flowFieldSession.fullFlowSolveCount, 3)
  assert.ok(world.settledDrainage instanceof Float32Array)
})

test('hydrologyPaint module assembles the river network and paints the corridor mask', () => {
  const { world, riverMaskPipeline } = composeSubsteps(erodedState(), 'hydrologyPaint')

  assert.ok(world.riverNetwork)
  assert.ok(world.riverNetwork.centerline.some((value) => value === 1))
  assert.ok(world.riverNetwork.corridor.some((value) => value === 1))
  assert.ok(getRiverMaskStage(riverMaskPipeline, 'painted')?.some((value) => value === 1))
})

test('hydrologyPaint module reports inner progress through the shared onProgress callback', () => {
  const { world: settledWorld, riverMaskPipeline } = composeSubsteps(
    erodedState(),
    'hydrologySettle',
  )

  const paint = HYDROLOGY_SUBSTEP_MODULE_BY_ID.hydrologyPaint
  /** @type {number[]} */
  const progress = []
  paint.run(selectHydrologySubstepInput(paint, settledWorld), {
    flowFieldSession: createFlowFieldSession(),
    riverMaskPipeline,
    onProgress: (value) => progress.push(value),
  })

  assert.ok(progress.length >= 2)
  assert.ok(progress.some((value) => value > 0 && value < 1))
  assert.strictEqual(progress[progress.length - 1], 1)
})
