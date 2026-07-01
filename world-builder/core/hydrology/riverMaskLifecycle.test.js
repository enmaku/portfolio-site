import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createInitialPipelineState,
  runPipelineStep,
} from '../derivedGeographyPipeline.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../worldGenerationOptions.js'
import { createSeededRandom, deriveFieldSeed } from '../noise/seededRandom.js'
import { runHydrologySubsteps } from './hydrologySubsteps.js'
import {
  corridorPathDescends,
  findLeastResistancePath,
  routeFractalCorridorPath,
} from './riverPathfinding.js'
import {
  applySkipRefineTransition,
  applySkipRefineToPipeline,
  createRiverMaskPipeline,
  getRiverMaskStageFromContext,
  requireRiverMaskStage,
  requireRiverMaskStageFromContext,
  resolveDisplayRiverNetworkMask,
  resolveDisplayRiverNetworkMaskFromPipeline,
  resolveSimulationRiverNetworkMaskFromPipeline,
  RIVER_MASK_LIFECYCLE_ORDER,
  RIVER_MASK_SKIP_REFINE_TRANSITION,
  riverMaskContractKey,
  riverMasksEqual,
  snapshotRiverMaskLifecycle,
  snapshotRiverMaskPipeline,
} from './riverMaskLifecycle.js'

/**
 * @param {number} width
 * @param {number} height
 * @param {number} [fill]
 */
function flatLand(width, height, fill = 0.6) {
  return new Float32Array(width * height).fill(fill)
}

/**
 * @param {number} width
 * @param {number} height
 */
function noOcean(width, height) {
  return new Array(width * height).fill(false)
}

test('routeFractalCorridorPath connects endpoints on a low saddle', () => {
  const width = 20
  const height = 12
  const elevation = flatLand(width, height, 0.72)
  const ocean = noOcean(width, height)
  const fromIdx = 5 * width + 2
  const toIdx = 5 * width + 17
  for (let x = 8; x <= 11; x += 1) {
    elevation[5 * width + x] = 0.45
    elevation[6 * width + x] = 0.44
  }

  const random = createSeededRandom(deriveFieldSeed(42, 'route-test'))
  const path = routeFractalCorridorPath({
    fromIdx,
    toIdx,
    elevation,
    ocean,
    width,
    height,
    random,
    profile: 'legacyAttraction',
    requireDescent: true,
  })

  assert.ok(path)
  assert.strictEqual(path[0], fromIdx)
  assert.strictEqual(path.at(-1), toIdx)
})

test('routeFractalCorridorPath returns null when descent is required but path climbs', () => {
  const width = 12
  const height = 8
  const elevation = flatLand(width, height, 0.5)
  const ocean = noOcean(width, height)
  const fromIdx = 3 * width + 2
  const toIdx = 3 * width + 9
  elevation[fromIdx] = 0.4
  elevation[toIdx] = 0.8

  const random = createSeededRandom(deriveFieldSeed(7, 'climb-test'))
  const path = routeFractalCorridorPath({
    fromIdx,
    toIdx,
    elevation,
    ocean,
    width,
    height,
    random,
    profile: 'legacyAttraction',
    requireDescent: true,
  })

  assert.strictEqual(path, null)
  assert.equal(corridorPathDescends([fromIdx, toIdx], elevation), false)
})

test('routeFractalCorridorPath meander refine profile stays near sketch mask', () => {
  const width = 16
  const height = 16
  const elevation = flatLand(width, height, 0.65)
  const ocean = noOcean(width, height)
  const sketchMask = new Uint8Array(width * height)
  for (let x = 4; x <= 11; x += 1) {
    sketchMask[8 * width + x] = 1
  }
  const fromIdx = 8 * width + 4
  const toIdx = 8 * width + 11

  const random = createSeededRandom(deriveFieldSeed(99, 'refine-test'))
  const path = routeFractalCorridorPath({
    fromIdx,
    toIdx,
    elevation,
    ocean,
    width,
    height,
    random,
    profile: 'meanderRefine',
    wiggleScale: 0.5,
    sketchMask,
    allowSegmentGaps: true,
    useFallbackLine: true,
  })

  assert.ok(path)
  assert.ok(path.every((idx) => sketchMask[idx] === 1 || Math.abs((idx % width) - 8) <= 2))
})

test('findLeastResistancePath returns null when downhill-only routing is blocked', () => {
  const width = 10
  const height = 10
  const elevation = flatLand(width, height, 0.5)
  const ocean = noOcean(width, height)
  const fromIdx = 2 * width + 2
  const toIdx = 2 * width + 7

  for (let y = 0; y < height; y += 1) {
    elevation[y * width + 5] = 0.99
  }

  const path = findLeastResistancePath({
    fromIdx,
    toIdx,
    elevation,
    ocean,
    width,
    height,
    downhillOnly: true,
  })

  assert.strictEqual(path, null)
})

test('RIVER_MASK_LIFECYCLE_ORDER documents sketch through painted stages', () => {
  assert.deepStrictEqual(RIVER_MASK_LIFECYCLE_ORDER, [
    'sketch',
    'incised',
    'settled',
    'presentation',
    'painted',
  ])
  assert.strictEqual(RIVER_MASK_SKIP_REFINE_TRANSITION, 'skipRefine')
  assert.strictEqual(riverMaskContractKey('presentation'), 'riverMask.presentation')
})

/** @typedef {Partial<Record<import('./riverMaskLifecycle.js').RiverMaskLifecycleStage, Uint8Array | null>>} MaskLifecycleSnapshot */

/**
 * @param {MaskLifecycleSnapshot | undefined} snapshot
 * @param {import('./riverMaskLifecycle.js').RiverMaskLifecycleStage} stage
 */
function assertStagePopulated(snapshot, stage) {
  assert.ok(snapshot?.[stage], `${stage} mask should be populated`)
  assert.ok(
    snapshot?.[stage]?.some((value) => value === 1),
    `${stage} mask should contain centerline cells`,
  )
}

/**
 * @param {MaskLifecycleSnapshot | undefined} snapshot
 * @param {import('./riverMaskLifecycle.js').RiverMaskLifecycleStage} stage
 */
function assertStageAbsent(snapshot, stage) {
  assert.strictEqual(snapshot?.[stage] ?? null, null, `${stage} mask should be absent`)
}

/**
 * @param {MaskLifecycleSnapshot | undefined} after
 * @param {MaskLifecycleSnapshot | undefined} before
 * @param {import('./riverMaskLifecycle.js').RiverMaskLifecycleStage} stage
 */
function assertStageUnchanged(after, before, stage) {
  assert.ok(
    riverMasksEqual(after?.[stage], before?.[stage]),
    `${stage} mask should remain unchanged across substeps`,
  )
}

test('mask lifecycle snapshots follow sketch→incised→settled→presentation→painted order', () => {
  let state = createInitialPipelineState({
    geographySeed: 12345,
    prevailingWindDegrees: 90,
    width: 64,
    height: 64,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enableMeanderRefine: false,
    },
  })
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  /** @type {Map<string, MaskLifecycleSnapshot>} */
  const snapshotsBySubstep = new Map()

  runHydrologySubsteps(state, {
    onSubstepComplete({ substepId, maskLifecycle }) {
      if (maskLifecycle) {
        snapshotsBySubstep.set(substepId, maskLifecycle)
      }
    },
  })

  const route = snapshotsBySubstep.get('hydrologyRoute')
  assertStagePopulated(route, 'sketch')
  for (const stage of RIVER_MASK_LIFECYCLE_ORDER.slice(1)) {
    assertStageAbsent(route, stage)
  }

  const incise = snapshotsBySubstep.get('hydrologyIncise')
  assertStagePopulated(incise, 'sketch')
  assertStagePopulated(incise, 'incised')
  assertStageUnchanged(incise, route, 'sketch')
  for (const stage of RIVER_MASK_LIFECYCLE_ORDER.slice(2)) {
    assertStageAbsent(incise, stage)
  }

  const extract = snapshotsBySubstep.get('hydrologyExtract')
  assertStagePopulated(extract, 'sketch')
  assertStagePopulated(extract, 'incised')
  assertStagePopulated(extract, 'settled')
  assertStageUnchanged(extract, incise, 'sketch')
  assertStageUnchanged(extract, incise, 'incised')
  for (const stage of RIVER_MASK_LIFECYCLE_ORDER.slice(3)) {
    assertStageAbsent(extract, stage)
  }

  const refine = snapshotsBySubstep.get('hydrologyRefine')
  assertStagePopulated(refine, 'sketch')
  assertStagePopulated(refine, 'incised')
  assertStagePopulated(refine, 'settled')
  assertStagePopulated(refine, 'presentation')
  assertStageUnchanged(refine, extract, 'sketch')
  assertStageUnchanged(refine, extract, 'incised')
  assertStageUnchanged(refine, extract, 'settled')
  assertStageAbsent(refine, 'painted')

  const paint = snapshotsBySubstep.get('hydrologyPaint')
  assertStagePopulated(paint, 'sketch')
  assertStagePopulated(paint, 'incised')
  assertStagePopulated(paint, 'settled')
  assertStagePopulated(paint, 'presentation')
  assertStagePopulated(paint, 'painted')
  assertStageUnchanged(paint, refine, 'sketch')
  assertStageUnchanged(paint, refine, 'incised')
  assertStageUnchanged(paint, refine, 'settled')
  assertStageUnchanged(paint, refine, 'presentation')

  for (const stage of RIVER_MASK_LIFECYCLE_ORDER) {
    assertStagePopulated(paint, stage)
  }
})

/**
 * @param {number} geographySeed
 * @param {import('../worldGenerationOptions.js').WorldGenerationOptions} [options]
 */
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

/**
 * @param {MaskLifecycleSnapshot} snapshot
 */
function pipelineFromMaskLifecycle(snapshot) {
  return createRiverMaskPipeline({
    sketch: snapshot.sketch ?? null,
    incised: snapshot.incised ?? null,
    settled: snapshot.settled ?? null,
    presentation: snapshot.presentation ?? null,
    painted: snapshot.painted ?? null,
  })
}

test('skipRefine transition copies settled mask to presentation when refine is skipped', () => {
  let state = createInitialPipelineState({
    geographySeed: 4242,
    prevailingWindDegrees: 90,
    width: 64,
    height: 64,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enableMeanderRefine: false,
    },
  })
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  /** @type {Map<string, MaskLifecycleSnapshot>} */
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

  const afterSkipRefine = snapshotsBySubstep.get('hydrologyRefine')
  assert.ok(afterSkipRefine?.presentation?.some((value) => value === 1))
  assert.equal(afterSkipRefine?.presentation, afterSkipRefine?.settled)
  assert.ok(snapshotsBySubstep.get('hydrologyPaint')?.painted?.some((value) => value === 1))
  assert.deepStrictEqual(transitions, [RIVER_MASK_SKIP_REFINE_TRANSITION])
})

test('enableMeanderRefine changes presentation mask but leaves simulationRiverMask byte-equal', () => {
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

test('riverAttractionRadiusScale changes presentation only and leaves simulationRiverMask byte-equal', () => {
  const seed = 5000
  const { state: withoutAttraction } = runHydrologyForSeed(seed)
  const { state: withAttraction } = runHydrologyForSeed(seed, {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
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

test('simulationRiverMask resolves from settled stage via public pipeline API', () => {
  const seed = 5000
  const meanderOptions = {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    enableMeanderRefine: true,
    riverMeanderStrength: 2,
  }

  /** @type {Map<string, MaskLifecycleSnapshot>} */
  const snapshotsBySubstep = new Map()
  let state = createInitialPipelineState({
    geographySeed: seed,
    prevailingWindDegrees: 90,
    width: 256,
    height: 256,
    options: meanderOptions,
  })
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  const { state: hydrologyState } = runHydrologySubsteps(state, {
    onSubstepComplete({ substepId, maskLifecycle }) {
      if (maskLifecycle) {
        snapshotsBySubstep.set(substepId, maskLifecycle)
      }
    },
  })

  const paintSnapshot = snapshotsBySubstep.get('hydrologyPaint')
  assert.ok(paintSnapshot?.settled)
  assert.ok(paintSnapshot?.presentation)

  const pipeline = pipelineFromMaskLifecycle(paintSnapshot)
  const simulationFromPipeline = resolveSimulationRiverNetworkMaskFromPipeline(pipeline)

  assert.ok(
    riverMasksEqual(hydrologyState.simulationRiverMask, simulationFromPipeline),
    'pipeline state simulationRiverMask must match resolveSimulationRiverNetworkMaskFromPipeline',
  )
  assert.ok(
    !riverMasksEqual(simulationFromPipeline, paintSnapshot.presentation),
    'simulation export must not follow presentation refine',
  )
  assert.ok(
    riverMasksEqual(simulationFromPipeline, paintSnapshot.settled),
    'simulation export must follow settled stage bytes',
  )

  const { state: defaultState } = runHydrologyForSeed(seed)
  assert.ok(
    riverMasksEqual(defaultState.simulationRiverMask, hydrologyState.simulationRiverMask),
    'simulationRiverMask must stay settled-stage bytes when presentation diverges',
  )
})

test('resolveDisplayRiverNetworkMask prefers presentation over settled', () => {
  const settled = new Uint8Array([1, 0, 1])
  const presentation = new Uint8Array([0, 1, 0])
  assert.equal(resolveDisplayRiverNetworkMask(presentation, settled), presentation)
  assert.equal(resolveDisplayRiverNetworkMask(null, settled), settled)
})

test('applySkipRefineTransition copies settled mask to presentation', () => {
  const settled = new Uint8Array([1, 0, 1, 0])
  const pipeline = createRiverMaskPipeline({ settled })
  applySkipRefineTransition({ riverMaskPipeline: pipeline })
  assert.ok(riverMasksEqual(pipeline.presentation, settled))
  assert.equal(pipeline.presentation, settled)
})

test('applySkipRefineToPipeline copies settled mask to presentation', () => {
  const settled = new Uint8Array([1, 0, 1, 0])
  const pipeline = createRiverMaskPipeline({ settled })
  applySkipRefineToPipeline(pipeline)
  assert.equal(pipeline.presentation, settled)
})

test('resolveDisplayRiverNetworkMaskFromPipeline prefers presentation over settled', () => {
  const settled = new Uint8Array([1, 0, 1])
  const presentation = new Uint8Array([0, 1, 0])
  const pipeline = createRiverMaskPipeline({ settled, presentation })
  assert.equal(resolveDisplayRiverNetworkMaskFromPipeline(pipeline), presentation)
})

test('resolveSimulationRiverNetworkMaskFromPipeline returns settled regardless of presentation', () => {
  const settled = new Uint8Array([1, 0, 1])
  const presentation = new Uint8Array([1, 1, 1])
  const pipeline = createRiverMaskPipeline({ settled, presentation })
  assert.equal(resolveSimulationRiverNetworkMaskFromPipeline(pipeline), settled)
})

test('resolveSimulationRiverNetworkMaskFromPipeline throws when settled stage is missing', () => {
  assert.throws(
    () => resolveSimulationRiverNetworkMaskFromPipeline(createRiverMaskPipeline()),
    /river mask stage settled required/,
  )
})

test('snapshotRiverMaskPipeline captures mask fields by stage', () => {
  const sketch = new Uint8Array([1])
  const settled = new Uint8Array([0])
  const snapshot = snapshotRiverMaskPipeline(
    createRiverMaskPipeline({ sketch, settled }),
  )
  assert.equal(snapshot.sketch, sketch)
  assert.strictEqual(snapshot.incised, null)
  assert.equal(snapshot.settled, settled)
})

test('snapshotRiverMaskLifecycle captures mask fields by stage', () => {
  const sketch = new Uint8Array([1])
  const settled = new Uint8Array([0])
  const snapshot = snapshotRiverMaskLifecycle({
    riverMaskPipeline: createRiverMaskPipeline({ sketch, settled }),
  })
  assert.equal(snapshot.sketch, sketch)
  assert.strictEqual(snapshot.incised, null)
  assert.equal(snapshot.settled, settled)
})

test('getRiverMaskStageFromContext reads pipeline stage from hydrology context', () => {
  const sketch = new Uint8Array([1, 0])
  const ctx = { riverMaskPipeline: createRiverMaskPipeline({ sketch }) }
  assert.equal(getRiverMaskStageFromContext(ctx, 'sketch'), sketch)
  assert.strictEqual(getRiverMaskStageFromContext(ctx, 'incised'), null)
})

test('requireRiverMaskStageFromContext throws when stage is missing', () => {
  const ctx = { riverMaskPipeline: createRiverMaskPipeline() }
  assert.throws(
    () => requireRiverMaskStageFromContext(ctx, 'sketch'),
    /river mask stage sketch required/,
  )
})

test('requireRiverMaskStage returns a present stage from the pipeline', () => {
  const sketch = new Uint8Array([1, 0])
  const pipeline = createRiverMaskPipeline({ sketch })
  assert.equal(requireRiverMaskStage(pipeline, 'sketch'), sketch)
})

test('requireRiverMaskStage throws when stage is missing', () => {
  assert.throws(
    () => requireRiverMaskStage(createRiverMaskPipeline(), 'incised'),
    /river mask stage incised required/,
  )
})

test('riverMaskContractKey names pipeline stages for substep contracts', () => {
  assert.strictEqual(riverMaskContractKey('sketch'), 'riverMask.sketch')
  assert.strictEqual(riverMaskContractKey('painted'), 'riverMask.painted')
})
