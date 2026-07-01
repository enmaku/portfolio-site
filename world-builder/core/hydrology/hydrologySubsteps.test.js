import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HYDROLOGY_SUBSTEPS,
  runHydrologySubsteps,
} from './hydrologySubsteps.js'
import {
  riverMasksEqual,
  RIVER_MASK_SKIP_REFINE_TRANSITION,
} from './riverMaskLifecycle.js'
import {
  createInitialPipelineState,
  runPipelineStep,
} from '../derivedGeographyPipeline.js'
import { LandmassPipelineCancelledError } from '../landmassPipelineTypes.js'
import { refreshFieldsAfterErosion } from '../fields/refreshFieldsAfterErosion.js'
import { fillLakes } from './fillLakes.js'
import { computeFlowAccumulation, downstreamIndex } from './computeFlowAccumulation.js'
import { deriveOceanMask, FLOW_RECOMPUTE_REASONS, FLOW_RECOMPUTE_STAGES } from './flowField.js'
import { computeRiverNetworkMaxChannelWidth } from './riverCorridorDisplay.js'
import { readRiverNetworkFromWorldDocument } from './riverNetwork.js'
import { DEFAULT_GEOGRAPHY_SEED } from '../../core/worldGenerationOptions.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../worldGenerationOptions.js'
import { generateDerivedGeography } from '../generateDerivedGeography.js'
import {
  ELEVATION_PRIOR_VALIDATION_SEED_BATCH,
} from '../validation/elevationPriorPassRates.js'
import { assertLakeMaskSurfacesMatchMeta } from './lakeDisplayCoherence.js'

const params = {
  geographySeed: 12345,
  prevailingWindDegrees: 90,
  width: 64,
  height: 64,
}

test('HYDROLOGY_SUBSTEPS lists nine substeps in canonical order', () => {
  assert.deepStrictEqual(
    HYDROLOGY_SUBSTEPS.map((substep) => substep.id),
    [
      'hydrologyFill',
      'hydrologyClimate',
      'hydrologySeasonal',
      'hydrologyRoute',
      'hydrologyIncise',
      'hydrologyExtract',
      'hydrologyRefine',
      'hydrologySettle',
      'hydrologyPaint',
    ],
  )
})

// Default hydrology: three uncached full flow solves logged on FlowFieldSession —
// 1. hydrologyRoute (route-filled-dem), 2. hydrologyExtract (extract-post-incision,
// delegated inside extract module), 3. hydrologySettle (settle-post-lake-equilibrium).
test('runHydrologySubsteps performs three full flow solves per world', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const { flowField } = runHydrologySubsteps(state)

  assert.strictEqual(
    flowField.fullFlowSolveCount,
    3,
    'expected route, extract, and settle full flow solves only',
  )
  const uncachedLog = flowField.solveLog.filter((entry) => !entry.cached)
  assert.deepStrictEqual(
    uncachedLog.map((entry) => entry.stage),
    [
      FLOW_RECOMPUTE_STAGES.hydrologyRoute,
      FLOW_RECOMPUTE_STAGES.hydrologyExtract,
      FLOW_RECOMPUTE_STAGES.hydrologySettle,
    ],
  )
  assert.deepStrictEqual(
    uncachedLog.map((entry) => entry.reason),
    [
      FLOW_RECOMPUTE_REASONS.hydrologyRoute,
      FLOW_RECOMPUTE_REASONS.hydrologyExtract,
      FLOW_RECOMPUTE_REASONS.hydrologySettle,
    ],
  )
  for (const entry of uncachedLog) {
    assert.strictEqual(entry.reason, FLOW_RECOMPUTE_REASONS[entry.stage])
  }
})

test('runHydrologySubsteps routes every full flow solve through the flowField session', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const { flowField } = runHydrologySubsteps(state)

  assert.strictEqual(
    flowField.fullFlowSolveCount,
    flowField.solveLog.filter((entry) => !entry.cached).length,
  )
  assert.ok(flowField.solveLog.length > 0)
})

test('runHydrologySubsteps with seasonal hydrology enabled keeps three full flow solves', () => {
  let baselineState = createInitialPipelineState({
    ...params,
    options: { ...DEFAULT_WORLD_GENERATION_OPTIONS, enableSeasonalHydrology: false },
  })
  baselineState = runPipelineStep(baselineState, 'physicalTerrainBaseline')
  baselineState = runPipelineStep(baselineState, 'erosion')

  let seasonalState = createInitialPipelineState({
    ...params,
    options: { ...DEFAULT_WORLD_GENERATION_OPTIONS, enableSeasonalHydrology: true },
  })
  seasonalState = runPipelineStep(seasonalState, 'physicalTerrainBaseline')
  seasonalState = runPipelineStep(seasonalState, 'erosion')

  const baseline = runHydrologySubsteps(baselineState)
  const seasonal = runHydrologySubsteps(seasonalState)

  assert.strictEqual(seasonal.flowField.fullFlowSolveCount, 3)
  assert.strictEqual(
    seasonal.flowField.fullFlowSolveCount,
    baseline.flowField.fullFlowSolveCount,
  )
  const seasonalUncached = seasonal.flowField.solveLog.filter((entry) => !entry.cached)
  assert.deepStrictEqual(
    seasonalUncached.map((entry) => entry.stage),
    [
      FLOW_RECOMPUTE_STAGES.hydrologyRoute,
      FLOW_RECOMPUTE_STAGES.hydrologyExtract,
      FLOW_RECOMPUTE_STAGES.hydrologySettle,
    ],
  )
  assert.deepStrictEqual(
    seasonalUncached.map((entry) => entry.reason),
    [
      FLOW_RECOMPUTE_REASONS.hydrologyRoute,
      FLOW_RECOMPUTE_REASONS.hydrologyExtract,
      FLOW_RECOMPUTE_REASONS.hydrologySettle,
    ],
  )
})

test('runHydrologySubsteps invokes seasonal between climate and route', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const order = []
  runHydrologySubsteps(state, {
    onSubstepStart({ substepId }) {
      order.push(substepId)
    },
  })

  const climateIndex = order.indexOf('hydrologyClimate')
  const seasonalIndex = order.indexOf('hydrologySeasonal')
  const routeIndex = order.indexOf('hydrologyRoute')
  assert.ok(climateIndex >= 0)
  assert.ok(seasonalIndex >= 0)
  assert.ok(routeIndex >= 0)
  assert.ok(climateIndex < seasonalIndex)
  assert.ok(seasonalIndex < routeIndex)
})

test('runHydrologySubsteps invokes climate before route', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const order = []
  runHydrologySubsteps(state, {
    onSubstepStart({ substepId }) {
      order.push(substepId)
    },
  })

  const climateIndex = order.indexOf('hydrologyClimate')
  const routeIndex = order.indexOf('hydrologyRoute')
  assert.ok(climateIndex >= 0)
  assert.ok(routeIndex >= 0)
  assert.ok(climateIndex < routeIndex)
})

test('runHydrologySubsteps matches runPipelineStep hydrology output', () => {
  let baselineState = createInitialPipelineState(params)
  baselineState = runPipelineStep(baselineState, 'physicalTerrainBaseline')
  baselineState = runPipelineStep(baselineState, 'erosion')
  const fromPipelineStep = runPipelineStep(baselineState, 'hydrology')

  let substepState = createInitialPipelineState(params)
  substepState = runPipelineStep(substepState, 'physicalTerrainBaseline')
  substepState = runPipelineStep(substepState, 'erosion')
  const { state: fromSubsteps } = runHydrologySubsteps(substepState)

  assert.deepStrictEqual(fromSubsteps.lakeMask, fromPipelineStep.lakeMask)
  assert.deepStrictEqual(fromSubsteps.lakes, fromPipelineStep.lakes)
  assert.deepStrictEqual(fromSubsteps.lakeMeta, fromPipelineStep.lakeMeta)
  assert.deepStrictEqual(fromSubsteps.hydrologyStats, fromPipelineStep.hydrologyStats)
  assert.deepStrictEqual(fromSubsteps.riverGraph, fromPipelineStep.riverGraph)
  assert.deepStrictEqual(fromSubsteps.riverNetworkMask, fromPipelineStep.riverNetworkMask)
  assert.deepStrictEqual(fromSubsteps.channelWidth, fromPipelineStep.channelWidth)
  assert.deepStrictEqual(fromSubsteps.fields.elevation, fromPipelineStep.fields.elevation)
  assert.deepStrictEqual(fromSubsteps.fields.drainage, fromPipelineStep.fields.drainage)
  assert.deepStrictEqual(fromSubsteps.biomes, fromPipelineStep.biomes)
})

test('runHydrologySubsteps flattens hydrologyPaint riverNetwork contract onto state', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const { state: hydrologyState } = runHydrologySubsteps(state)
  const network = readRiverNetworkFromWorldDocument({
    gridWidth: hydrologyState.width,
    gridHeight: hydrologyState.height,
    fields: hydrologyState.fields,
    riverNetworkMask: hydrologyState.riverNetworkMask,
    riverCorridorMask: hydrologyState.riverCorridorMask,
    flowDirection: hydrologyState.flowDirection,
    channelWidth: hydrologyState.channelWidth,
    riverGraph: hydrologyState.riverGraph,
  })

  assert.ok(network)
  assert.equal(network.centerline, hydrologyState.riverNetworkMask)
  assert.equal(network.corridor, hydrologyState.riverCorridorMask)
  assert.equal(network.graph, hydrologyState.riverGraph)
  assert.equal(network.flow.direction, hydrologyState.flowDirection)
  assert.equal(network.flow.accumulation, hydrologyState.fields.drainage)
  assert.equal(network.flow.channelWidth, hydrologyState.channelWidth)
})

test('readRiverNetworkFromWorldDocument exposes the simulation centerline distinct from presentation', () => {
  let state = createInitialPipelineState({
    geographySeed: 5000,
    prevailingWindDegrees: 90,
    width: 256,
    height: 256,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enableMeanderRefine: true,
      riverMeanderStrength: 2,
    },
  })
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const { state: hydrologyState } = runHydrologySubsteps(state)
  const network = readRiverNetworkFromWorldDocument({
    gridWidth: hydrologyState.width,
    gridHeight: hydrologyState.height,
    fields: hydrologyState.fields,
    simulationRiverMask: hydrologyState.simulationRiverMask,
    riverNetworkMask: hydrologyState.riverNetworkMask,
    riverCorridorMask: hydrologyState.riverCorridorMask,
    flowDirection: hydrologyState.flowDirection,
    channelWidth: hydrologyState.channelWidth,
    riverGraph: hydrologyState.riverGraph,
  })

  assert.ok(network)
  assert.equal(network.simulationCenterline, hydrologyState.simulationRiverMask)
  assert.equal(network.centerline, hydrologyState.riverNetworkMask)
  assert.ok(
    !riverMasksEqual(network.simulationCenterline, network.centerline),
    'meander refine should separate the simulation interface from the presentation centerline',
  )
})

test('runHydrologySubsteps does not populate coast navigability on pipeline state', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const { state: hydrologyState } = runHydrologySubsteps(state)

  assert.strictEqual(hydrologyState.coastNavigability, null)
  assert.ok(hydrologyState.riverGraph)
})

test('runHydrologySubsteps exposes lakeMeta and hydrology stats on state', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  const { state: hydrologyState } = runHydrologySubsteps(state)

  assert.ok(Array.isArray(hydrologyState.lakeMeta))
  assert.ok(hydrologyState.hydrologyStats)
  assert.strictEqual(typeof hydrologyState.hydrologyStats.breachCount, 'number')
  assert.strictEqual(typeof hydrologyState.hydrologyStats.endorheicCount, 'number')
  assert.strictEqual(typeof hydrologyState.hydrologyStats.endorheicFraction, 'number')
  assert.strictEqual(typeof hydrologyState.hydrologyStats.lakeCount, 'number')
  if (hydrologyState.lakes && hydrologyState.lakes.length > 0) {
    assert.strictEqual(hydrologyState.lakeMeta.length, hydrologyState.lakes.length)
  }
})

test('runHydrologySubsteps aborts when shouldCancel returns true', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  let completedSubsteps = 0
  assert.throws(
    () => {
      runHydrologySubsteps(state, {
        onSubstepComplete() {
          completedSubsteps += 1
        },
        shouldCancel() {
          return completedSubsteps >= 2
        },
      })
    },
    (error) => error instanceof LandmassPipelineCancelledError,
  )
  assert.strictEqual(completedSubsteps, 2)
})

test('runHydrologySubsteps records per-substep timings', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const { timings } = runHydrologySubsteps(state)

  assert.strictEqual(timings.length, HYDROLOGY_SUBSTEPS.length)
  for (const row of timings) {
    assert.ok(HYDROLOGY_SUBSTEPS.some((substep) => substep.id === row.substepId))
    assert.strictEqual(typeof row.label, 'string')
    assert.strictEqual(typeof row.durationMs, 'number')
    assert.ok(row.durationMs >= 0)
  }
})

test('runHydrologySubsteps climate refresh recomputes rainfall and temperature on eroded elevation', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const refreshed = refreshFieldsAfterErosion({
    geographySeed: state.geographySeed,
    prevailingWindDegrees: state.prevailingWindDegrees,
    elevation: state.erodedElevation,
    drainage: state.baselineDoc.fields.drainage,
    width: state.width,
    height: state.height,
    options: state.options,
  })

  const baseline = state.baselineDoc.fields
  let temperatureChanged = false
  let rainfallChanged = false
  for (let i = 0; i < baseline.temperature.length; i += 1) {
    if (baseline.temperature[i] !== refreshed.temperature[i]) {
      temperatureChanged = true
    }
    if (baseline.rainfall[i] !== refreshed.rainfall[i]) {
      rainfallChanged = true
    }
  }

  assert.ok(temperatureChanged)
  assert.ok(rainfallChanged)
})

test('runHydrologySubsteps emits substep lifecycle hooks in order', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  /** @type {string[]} */
  const events = []
  runHydrologySubsteps(state, {
    onSubstepStart({ substepId }) {
      events.push(`start:${substepId}`)
    },
    onSubstepProgress({ substepId, progress }) {
      events.push(`progress:${substepId}:${progress}`)
    },
    onSubstepComplete({ substepId }) {
      events.push(`complete:${substepId}`)
    },
  })

  for (const substep of HYDROLOGY_SUBSTEPS) {
    assert.ok(events.includes(`start:${substep.id}`))
    assert.ok(events.includes(`progress:${substep.id}:0`))
    assert.ok(events.includes(`progress:${substep.id}:1`))
    assert.ok(events.includes(`complete:${substep.id}`))
  }

  const climateStart = events.indexOf('start:hydrologyClimate')
  const routeStart = events.indexOf('start:hydrologyRoute')
  assert.ok(climateStart >= 0)
  assert.ok(routeStart > climateStart)
})

test('runHydrologySubsteps emits inner progress during hydrologyIncise carve', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  /** @type {number[]} */
  const inciseProgress = []
  runHydrologySubsteps(state, {
    onSubstepProgress({ substepId, progress }) {
      if (substepId === 'hydrologyIncise') {
        inciseProgress.push(progress)
      }
    },
  })

  assert.ok(inciseProgress.length >= 2)
  assert.ok(inciseProgress.some((value) => value > 0 && value < 1))
  assert.strictEqual(inciseProgress[inciseProgress.length - 1], 1)
})

test('runHydrologySubsteps emits inner progress during hydrologyPaint', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  /** @type {number[]} */
  const paintProgress = []
  const { state: hydrologyState } = runHydrologySubsteps(state, {
    onSubstepProgress({ substepId, progress }) {
      if (substepId === 'hydrologyPaint') {
        paintProgress.push(progress)
      }
    },
  })

  assert.ok(paintProgress.length >= 2)
  assert.ok(paintProgress.some((value) => value > 0 && value < 1))
  assert.strictEqual(paintProgress[paintProgress.length - 1], 1)
  assert.ok(hydrologyState.riverCorridorMask)
  assert.ok(hydrologyState.riverCorridorMask.some((value) => value === 1))
})

test('runHydrologySubsteps passes post-carve elevation downstream', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const { state: hydrologyState } = runHydrologySubsteps(state)
  const filledOnly = fillLakes({
    elevation: state.erodedElevation,
    width: state.width,
    height: state.height,
    ocean: deriveOceanMask({
      elevation: state.erodedElevation,
      width: state.width,
      height: state.height,
      seaLevel: state.options.seaLevel,
    }),
    seaLevel: state.options.seaLevel,
    minLakeAreaScale: state.options.minLakeAreaScale,
    breachThreshold: state.options.breachThreshold,
  }).filledElevation

  let carvedSomewhere = false
  for (let i = 0; i < filledOnly.length; i += 1) {
    if (hydrologyState.fields.elevation[i] < filledOnly[i] - 1e-5) {
      carvedSomewhere = true
      break
    }
  }

  assert.ok(carvedSomewhere, 'expected post-carve elevation below filled DEM somewhere')
})

test('runHydrologySubsteps keeps channelWidth aligned with settled drainage', () => {
  let state = createInitialPipelineState({
    geographySeed: 12345,
    prevailingWindDegrees: 90,
    width: 256,
    height: 256,
    options: { enableSeasonalHydrology: false, enableMeanderRefine: false },
  })
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const { state: hydrologyState } = runHydrologySubsteps(state)
  const maxChannelWidth = computeRiverNetworkMaxChannelWidth(
    hydrologyState.channelWidth,
    hydrologyState.riverNetworkMask,
  )
  assert.ok(maxChannelWidth > 0)

  for (let idx = 0; idx < hydrologyState.channelWidth.length; idx += 1) {
    if (!hydrologyState.riverNetworkMask[idx]) {
      assert.strictEqual(hydrologyState.channelWidth[idx], 0)
      continue
    }
    const expected =
      Math.sqrt(Math.max(0, hydrologyState.fields.drainage[idx])) * maxChannelWidth
    assert.ok(
      Math.abs(hydrologyState.channelWidth[idx] - expected) < 1e-3,
      `channelWidth mismatch at ${idx}: ${hydrologyState.channelWidth[idx]} vs ${expected}`,
    )
  }
})

test('runHydrologySubsteps places settled mouth nodes at ocean drainage cells', () => {
  let state = createInitialPipelineState({
    geographySeed: 5000,
    prevailingWindDegrees: 90,
    width: 256,
    height: 256,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enableMeanderRefine: false,
      riverAttractionRadiusScale: 0,
    },
  })
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const { state: hydrologyState } = runHydrologySubsteps(state)
  const mouths = hydrologyState.riverGraph.nodes.filter((node) => node.kind === 'mouth')
  assert.ok(mouths.length > 0)

  const refreshed = refreshFieldsAfterErosion({
    geographySeed: state.geographySeed,
    prevailingWindDegrees: state.prevailingWindDegrees,
    elevation: state.erodedElevation,
    drainage: state.baselineDoc.fields.drainage,
    width: hydrologyState.width,
    height: hydrologyState.height,
    options: state.options,
  })
  const { flowDirection, ocean } = computeFlowAccumulation({
    elevation: hydrologyState.fields.elevation,
    width: hydrologyState.width,
    height: hydrologyState.height,
    seaLevel: hydrologyState.options.seaLevel,
    rainfall: refreshed.rainfall,
    soilDrainage: state.baselineDoc.fields.drainage,
    soilDrainageScale: hydrologyState.options.soilDrainageScale,
  })
  for (const mouth of mouths) {
    const idx = mouth.y * hydrologyState.width + mouth.x
    const downstreamIdx = downstreamIndex(idx, hydrologyState.width, flowDirection)
    assert.ok(downstreamIdx >= 0)
    assert.ok(ocean[downstreamIdx])
  }
})

test('runHydrologySubsteps settle keeps lake surfaces aligned with lakeMeta', () => {
  let state = createInitialPipelineState({
    geographySeed: DEFAULT_GEOGRAPHY_SEED,
    prevailingWindDegrees: 90,
    width: 128,
    height: 128,
  })
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  const { state: hydrologyState } = runHydrologySubsteps(state)

  assert.ok(hydrologyState.lakeMask)
  assert.ok(hydrologyState.lakeMeta)
  assert.ok(hydrologyState.fields?.elevation)
  assert.ok(
    hydrologyState.lakeMeta.length > 0,
    'expected lakes on default geography seed for lake settle integration test',
  )

  assertLakeMaskSurfacesMatchMeta({
    lakeMask: hydrologyState.lakeMask,
    lakes: hydrologyState.lakes,
    lakeMeta: hydrologyState.lakeMeta,
    elevation: hydrologyState.fields.elevation,
    width: hydrologyState.width,
    height: hydrologyState.height,
    lakeIdByCell: hydrologyState.lakeIdByCell ?? undefined,
  })
})

test('fillLakes returns priority-flood spill outlets after breach evaluation', () => {
  const width = 5
  const height = 5
  const elevation = new Float32Array(width * height).fill(1)
  for (let y = 1; y <= 3; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      elevation[y * width + x] = 0.6
    }
  }
  elevation[2 * width + 2] = 0.2
  const ocean = Array.from({ length: width * height }, () => false)

  const { filledElevation, spillOutlet, lakeMeta } = fillLakes({
    elevation,
    width,
    height,
    ocean,
    minLakeAreaScale: 0.01,
  })

  assert.ok(spillOutlet[2 * width + 2] >= 0)
  assert.ok(lakeMeta.length >= 1)
  assert.ok(filledElevation[2 * width + 2] <= elevation[2 * width + 2] + 1e-4)
})

function runHydrologyForSeed(geographySeed, options = DEFAULT_WORLD_GENERATION_OPTIONS) {
  let state = createInitialPipelineState({
    geographySeed,
    prevailingWindDegrees: 90,
    width: 256,
    height: 256,
    options,
  })
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  return runHydrologySubsteps(state)
}

test('runHydrologySubsteps skips hydrologyRefine when enableMeanderRefine is false', () => {
  let state = createInitialPipelineState({
    ...params,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enableMeanderRefine: false,
    },
  })
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  /** @type {{ substepId: string, skipped: boolean }[]} */
  const completions = []
  const { state: hydrologyState, timings } = runHydrologySubsteps(state, {
    onSubstepComplete({ substepId, skipped }) {
      completions.push({ substepId, skipped: Boolean(skipped) })
    },
  })

  const refineCompletion = completions.find((row) => row.substepId === 'hydrologyRefine')
  assert.ok(refineCompletion)
  assert.strictEqual(refineCompletion.skipped, true)

  const refineTiming = timings.find((row) => row.substepId === 'hydrologyRefine')
  assert.ok(refineTiming)
  assert.strictEqual(refineTiming.skipped, true)
  assert.strictEqual(refineTiming.durationMs, 0)
  assert.ok(hydrologyState.riverNetworkMask.some((value) => value === 1))
})

test('runHydrologySubsteps skips hydrologyRefine when meander is off even with river attraction enabled', () => {
  let state = createInitialPipelineState({
    ...params,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enableMeanderRefine: false,
      riverAttractionRadiusScale: 6,
    },
  })
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const { state: withAttractionEnabled, timings } = runHydrologySubsteps(state)

  let leanState = createInitialPipelineState({
    ...params,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enableMeanderRefine: false,
      riverAttractionRadiusScale: 0,
    },
  })
  leanState = runPipelineStep(leanState, 'physicalTerrainBaseline')
  leanState = runPipelineStep(leanState, 'erosion')
  const { state: withAttractionDisabled } = runHydrologySubsteps(leanState)

  const refineTiming = timings.find((row) => row.substepId === 'hydrologyRefine')
  assert.ok(refineTiming)
  assert.strictEqual(refineTiming.skipped, true)
  assert.strictEqual(refineTiming.durationMs, 0)
  assert.ok(
    riverMasksEqual(withAttractionEnabled.riverNetworkMask, withAttractionDisabled.riverNetworkMask),
    'expected meander-off to ignore river attraction',
  )
})

test('runHydrologySubsteps runs hydrologyRefine when enableMeanderRefine is true', () => {
  let state = createInitialPipelineState({
    ...params,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enableMeanderRefine: true,
      riverMeanderStrength: 1,
    },
  })
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  /** @type {{ substepId: string, skipped: boolean }[]} */
  const completions = []
  const { timings } = runHydrologySubsteps(state, {
    onSubstepComplete({ substepId, skipped }) {
      completions.push({ substepId, skipped: Boolean(skipped) })
    },
  })

  const refineCompletion = completions.find((row) => row.substepId === 'hydrologyRefine')
  assert.ok(refineCompletion)
  assert.strictEqual(refineCompletion.skipped, false)

  const refineTiming = timings.find((row) => row.substepId === 'hydrologyRefine')
  assert.ok(refineTiming)
  assert.strictEqual(refineTiming.skipped, false)
})

test('enableMeanderRefine allows presentation mask changes and valley carving', () => {
  const seed = 5000
  const { state: withoutMeander } = runHydrologyForSeed(seed)
  const { state: withMeander } = runHydrologyForSeed(seed, {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    enableMeanderRefine: true,
    riverMeanderStrength: 2,
  })

  assert.ok(
    withoutMeander.riverGraph.nodes.some((node) => node.kind === 'mouth'),
    'expected mouths without meander refine',
  )
  assert.ok(
    withMeander.riverGraph.nodes.some((node) => node.kind === 'mouth'),
    'expected mouths with meander refine',
  )

  let elevationDiffers = false
  for (let idx = 0; idx < withoutMeander.fields.elevation.length; idx += 1) {
    if (
      Math.abs(withoutMeander.fields.elevation[idx] - withMeander.fields.elevation[idx]) > 1e-6
    ) {
      elevationDiffers = true
      break
    }
  }
  assert.ok(elevationDiffers, 'expected valley settling to carve refined channel elevation')

  let maskDiffers = false
  for (let idx = 0; idx < withoutMeander.riverNetworkMask.length; idx += 1) {
    if (withoutMeander.riverNetworkMask[idx] !== withMeander.riverNetworkMask[idx]) {
      maskDiffers = true
      break
    }
  }
  assert.ok(maskDiffers, 'expected presentation meander refine to change river network mask')
})

test('legacy meander refine leaves the simulation river mask unchanged', () => {
  const seed = 5000
  const { state: withoutMeander } = runHydrologyForSeed(seed)
  const { state: withMeander } = runHydrologyForSeed(seed, {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    enableMeanderRefine: true,
    riverMeanderStrength: 2,
  })

  assert.ok(
    withoutMeander.simulationRiverMask.some((value) => value === 1),
    'default simulation centerline should be populated',
  )
  assert.ok(
    riverMasksEqual(withoutMeander.simulationRiverMask, withMeander.simulationRiverMask),
    'simulation centerline must be invariant to presentation meander refine',
  )
  assert.ok(
    !riverMasksEqual(withoutMeander.riverNetworkMask, withMeander.riverNetworkMask),
    'presentation display centerline should change with meander refine',
  )
})

test('legacy corridor attraction leaves the simulation river mask unchanged', () => {
  const seed = 5000
  const leanOptions = {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    riverAttractionRadiusScale: 0,
  }
  const { state: withoutAttraction } = runHydrologyForSeed(seed, leanOptions)
  const { state: withAttraction } = runHydrologyForSeed(seed, {
    ...leanOptions,
    riverAttractionRadiusScale: 6,
  })

  assert.ok(
    withoutAttraction.simulationRiverMask.some((value) => value === 1),
    'default simulation centerline should be populated',
  )
  assert.ok(
    riverMasksEqual(withoutAttraction.simulationRiverMask, withAttraction.simulationRiverMask),
    'simulation centerline must be invariant to presentation corridor attraction',
  )
  assert.ok(
    !riverMasksEqual(withoutAttraction.riverNetworkMask, withAttraction.riverNetworkMask),
    'presentation display centerline should reflect corridor attraction',
  )
})

test('runHydrologySubsteps reports mask lifecycle transitions at substep seams', () => {
  let state = createInitialPipelineState({
    ...params,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enableMeanderRefine: false,
      riverAttractionRadiusScale: 0,
    },
  })
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  /** @type {Map<string, Partial<Record<string, Uint8Array | null>>>} */
  const snapshotsBySubstep = new Map()
  /** @type {string[]} */
  const transitions = []

  runHydrologySubsteps(state, {
    onSubstepComplete({ substepId, maskLifecycle, transition, skipped }) {
      if (maskLifecycle) {
        snapshotsBySubstep.set(substepId, maskLifecycle)
      }
      if (transition) {
        transitions.push(transition)
      }
      if (substepId === 'hydrologyRefine') {
        assert.strictEqual(skipped, true)
      }
    },
  })

  assert.ok(snapshotsBySubstep.get('hydrologyRoute')?.sketch?.some((value) => value === 1))
  assert.ok(snapshotsBySubstep.get('hydrologyIncise')?.incised?.some((value) => value === 1))
  assert.ok(snapshotsBySubstep.get('hydrologyExtract')?.settled?.some((value) => value === 1))

  const afterSkipRefine = snapshotsBySubstep.get('hydrologyRefine')
  assert.ok(afterSkipRefine?.presentation?.some((value) => value === 1))
  assert.equal(afterSkipRefine?.presentation, afterSkipRefine?.settled)

  assert.ok(snapshotsBySubstep.get('hydrologyPaint')?.painted?.some((value) => value === 1))
  assert.deepStrictEqual(transitions, [RIVER_MASK_SKIP_REFINE_TRANSITION])
})

test('runHydrologySubsteps produces painted corridor and centerline masks', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const { state: hydrologyState } = runHydrologySubsteps(state)

  assert.ok(hydrologyState.riverNetworkMask.some((value) => value === 1))
  assert.ok(hydrologyState.riverCorridorMask?.some((value) => value === 1))
})

test('skip refine transition is deterministic for a fixed seed', () => {
  const seed = 4242
  const options = {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    enableMeanderRefine: false,
    riverAttractionRadiusScale: 0,
  }
  const first = runHydrologyForSeed(seed, options)
  const second = runHydrologyForSeed(seed, options)

  assert.ok(
    riverMasksEqual(first.state.riverNetworkMask, second.state.riverNetworkMask),
    'skip refine hydrology output should be seed-deterministic',
  )
})

test('default seed batch completes without rejection when legacy heuristics are off', () => {
  const seeds = [DEFAULT_GEOGRAPHY_SEED, ...ELEVATION_PRIOR_VALIDATION_SEED_BATCH.slice(0, 9)]
  for (const geographySeed of seeds) {
    const doc = generateDerivedGeography({
      geographySeed,
      prevailingWindDegrees: 90,
      width: 64,
      height: 64,
      options: DEFAULT_WORLD_GENERATION_OPTIONS,
    })
    assert.strictEqual(doc.generationReport?.shouldReject, false)
  }
})
