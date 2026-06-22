import assert from 'node:assert/strict'
import test from 'node:test'
import { generateDerivedGeography } from './generateDerivedGeography.js'
import {
  buildWorldDocumentFromPipelineState,
  cloneWorldDocument,
  createInitialPipelineState,
  DERIVED_GEOGRAPHY_STEPS,
  runFullDerivedGeographyPipeline,
  runPipelineStep,
} from './derivedGeographyPipeline.js'

import { DEFAULT_WORLD_GENERATION_OPTIONS } from './worldGenerationOptions.js'

const params = {
  geographySeed: 12345,
  prevailingWindDegrees: 90,
  width: 64,
  height: 64,
}

test('runFullDerivedGeographyPipeline matches generateDerivedGeography', () => {
  const fromPipeline = runFullDerivedGeographyPipeline(params)
  const direct = generateDerivedGeography(params)

  assert.deepStrictEqual(fromPipeline.biomes, direct.biomes)
  assert.deepStrictEqual(fromPipeline.fields.elevation, direct.fields.elevation)
  assert.deepStrictEqual(fromPipeline.fields.drainage, direct.fields.drainage)
  assert.strictEqual(
    fromPipeline.generationReport?.navigableRiverEdgeCount,
    direct.generationReport?.navigableRiverEdgeCount,
  )
})

test('runPipelineStep produces preview documents at each stage', () => {
  let state = createInitialPipelineState(params)

  for (const step of DERIVED_GEOGRAPHY_STEPS) {
    state = runPipelineStep(state, step.id)
    const doc = buildWorldDocumentFromPipelineState(state)
    assert.strictEqual(doc.gridWidth, params.width)
    assert.strictEqual(doc.gridHeight, params.height)
    assert.strictEqual(doc.fields.elevation.length, params.width * params.height)
    assert.strictEqual(doc.biomes.length, params.width * params.height)
  }

  assert.strictEqual(state.lastCompletedStep, 'validation')
  assert.ok(state.generationReport)
})

test('runPipelineStep hydrology records substep timings on state', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  state = runPipelineStep(state, 'hydrology')

  assert.ok(state.hydrologySubstepTimings)
  assert.strictEqual(state.hydrologySubstepTimings.length, 7)
})

test('runPipelineStep hydrology runs hydrologyRefine when enabled by default', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  state = runPipelineStep(state, 'hydrology')

  const refineTiming = state.hydrologySubstepTimings?.find(
    (row) => row.substepId === 'hydrologyRefine',
  )
  assert.ok(refineTiming)
  assert.strictEqual(refineTiming.skipped, false)
  assert.ok(refineTiming.durationMs >= 0)
})

test('full pipeline generation report includes hydrology substep timings', () => {
  const doc = runFullDerivedGeographyPipeline(params)
  assert.ok(doc.generationReport?.hydrologySubstepTimings)
  assert.strictEqual(doc.generationReport.hydrologySubstepTimings.length, 7)
})

test('full pipeline includes lakeMeta and hydrology breach stats', () => {
  const doc = runFullDerivedGeographyPipeline(params)
  assert.ok(Array.isArray(doc.lakeMeta))
  assert.ok(doc.generationReport?.hydrology)
  assert.strictEqual(typeof doc.generationReport.hydrology.breachCount, 'number')
  assert.strictEqual(typeof doc.generationReport.hydrology.endorheicCount, 'number')
  assert.strictEqual(typeof doc.generationReport.hydrology.endorheicFraction, 'number')
  if (doc.lakes && doc.lakes.length > 0) {
    assert.strictEqual(doc.lakeMeta.length, doc.lakes.length)
  }
  if (doc.lakeMeta.length > 0) {
    assert.strictEqual(typeof doc.lakeMeta[0].endorheic, 'boolean')
    assert.strictEqual(typeof doc.lakeMeta[0].surfaceElevation, 'number')
  }
})

test('buildWorldDocumentFromPipelineState includes lakeMeta after hydrology', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  state = runPipelineStep(state, 'hydrology')

  const doc = buildWorldDocumentFromPipelineState(state)
  assert.ok(Array.isArray(doc.lakeMeta))
  assert.ok(Array.isArray(doc.lakes))
  if (doc.lakes.length > 0) {
    assert.strictEqual(doc.lakeMeta.length, doc.lakes.length)
  }
})

test('hydrology persists channelWidth on pipeline state and world document', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  state = runPipelineStep(state, 'hydrology')

  assert.ok(state.channelWidth)
  assert.strictEqual(state.channelWidth.length, params.width * params.height)

  const doc = buildWorldDocumentFromPipelineState(state)
  assert.ok(doc.channelWidth)
  assert.strictEqual(doc.channelWidth.length, params.width * params.height)

  let hasPositiveWidth = false
  for (let i = 0; i < doc.channelWidth.length; i += 1) {
    if (doc.riverNetworkMask?.[i] && doc.channelWidth[i] > 0) {
      hasPositiveWidth = true
      break
    }
  }
  assert.ok(hasPositiveWidth)
})

test('cloneWorldDocument copies lakeMeta independently', () => {
  const doc = runFullDerivedGeographyPipeline(params)
  const cloned = cloneWorldDocument(doc)

  assert.deepStrictEqual(cloned.lakeMeta, doc.lakeMeta)
  if (cloned.lakeMeta && doc.lakeMeta && cloned.lakeMeta.length > 0) {
    cloned.lakeMeta[0].surfaceElevation += 1
    assert.notStrictEqual(cloned.lakeMeta[0].surfaceElevation, doc.lakeMeta[0].surfaceElevation)
  }
})

test('runFullDerivedGeographyPipeline exhausts validation retries with incremented seed', () => {
  const baseSeed = 999999
  const doc = runFullDerivedGeographyPipeline({
    geographySeed: baseSeed,
    prevailingWindDegrees: 270,
    width: 16,
    height: 16,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enforceCoastMouth: true,
      maxValidationRetries: 2,
    },
  })

  if (doc.generationReport?.shouldReject) {
    assert.strictEqual(doc.geographySeed, baseSeed + 2)
  } else {
    assert.ok(doc.geographySeed >= baseSeed && doc.geographySeed <= baseSeed + 2)
  }
})

test('DERIVED_GEOGRAPHY_STEPS has stable step ids', () => {
  assert.deepStrictEqual(
    DERIVED_GEOGRAPHY_STEPS.map((step) => step.id),
    [
      'physicalTerrainBaseline',
      'erosion',
      'hydrology',
      'fieldRefresh',
      'coastAndResources',
      'validation',
    ],
  )
})

test('runPipelineStep hydrology forwards substep hooks and cancel', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  /** @type {string[]} */
  const events = []
  let completedSubsteps = 0

  assert.throws(
    () => {
      runPipelineStep(state, 'hydrology', {
        onSubstepStart({ substepId }) {
          events.push(`start:${substepId}`)
        },
        onSubstepComplete() {
          completedSubsteps += 1
        },
        shouldCancel() {
          return completedSubsteps >= 2
        },
      })
    },
    /Hydrology cancelled/,
  )

  assert.strictEqual(completedSubsteps, 2)
  assert.ok(events.includes('start:hydrologyFill'))
  assert.ok(events.includes('start:hydrologyClimate'))
  assert.ok(!events.includes('start:hydrologyRoute'))
})
