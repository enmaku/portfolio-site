import assert from 'node:assert/strict'
import test from 'node:test'
import { generateDerivedGeography } from './generateDerivedGeography.js'
import {
  buildWorldDocumentFromPipelineState,
  cloneWorldDocument,
  createInitialPipelineState,
  DERIVED_GEOGRAPHY_STEPS,
  runFullDerivedGeographyPipeline,
  runLandmassPipelineRun,
  runPipelineStep,
} from './derivedGeographyPipeline.js'
import { LANDMASS_PIPELINE_STEP_IDS } from './landmassPipelineStageContracts.js'
import { LandmassPipelineCancelledError } from './landmassPipelineTypes.js'
import { countMarkedCells } from './hydrology/riverNetwork.js'

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
  assert.deepStrictEqual(fromPipeline.displayBiomes, direct.displayBiomes)
  assert.deepStrictEqual(fromPipeline.fields.elevation, direct.fields.elevation)
  assert.deepStrictEqual(fromPipeline.fields.drainage, direct.fields.drainage)
  assert.deepStrictEqual(fromPipeline.fields.salinity, direct.fields.salinity)
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
    assert.strictEqual(doc.displayBiomes.length, params.width * params.height)
  }

  assert.strictEqual(state.lastCompletedStep, 'validation')
  assert.ok(state.generationReport)
})

test('world document exposes a populated simulation river mask after hydrology', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  state = runPipelineStep(state, 'hydrology')

  const doc = buildWorldDocumentFromPipelineState(state)
  assert.ok(doc.simulationRiverMask)
  assert.strictEqual(doc.simulationRiverMask.length, params.width * params.height)
  assert.ok(doc.simulationRiverMask.some((value) => value === 1))
})

test('default generation simulation river mask equals the settled display centerline', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  state = runPipelineStep(state, 'hydrology')

  const doc = buildWorldDocumentFromPipelineState(state)
  assert.deepStrictEqual(doc.simulationRiverMask, doc.riverNetworkMask)
})

test('world document simulation river mask is invariant to corridor attraction', () => {
  const baseParams = {
    geographySeed: 5000,
    prevailingWindDegrees: 90,
    width: 256,
    height: 256,
  }
  const buildDoc = (options) => {
    let state = createInitialPipelineState({ ...baseParams, options })
    state = runPipelineStep(state, 'physicalTerrainBaseline')
    state = runPipelineStep(state, 'erosion')
    state = runPipelineStep(state, 'hydrology')
    return buildWorldDocumentFromPipelineState(state)
  }

  const withoutAttraction = buildDoc(DEFAULT_WORLD_GENERATION_OPTIONS)
  const withAttraction = buildDoc({
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    riverAttractionRadiusScale: 6,
  })

  assert.ok(countMarkedCells(withoutAttraction.simulationRiverMask) > 0)
  assert.deepStrictEqual(
    withAttraction.simulationRiverMask,
    withoutAttraction.simulationRiverMask,
  )
  assert.notDeepStrictEqual(
    withAttraction.riverNetworkMask,
    withoutAttraction.riverNetworkMask,
  )
})

test('validation hydrology metrics read the simulation centerline, not presentation refinements', () => {
  const refineParams = {
    geographySeed: 5000,
    prevailingWindDegrees: 90,
    width: 256,
    height: 256,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enableMeanderRefine: true,
      riverMeanderStrength: 2,
    },
  }
  let state = createInitialPipelineState(refineParams)
  for (const step of DERIVED_GEOGRAPHY_STEPS) {
    state = runPipelineStep(state, step.id)
  }
  const doc = buildWorldDocumentFromPipelineState(state)

  const simulationCellCount = countMarkedCells(doc.simulationRiverMask)
  const presentationCellCount = countMarkedCells(doc.riverNetworkMask)

  assert.ok(simulationCellCount > 0)
  assert.notStrictEqual(
    presentationCellCount,
    simulationCellCount,
    'meander refine should change the presentation centerline cell count',
  )
  assert.strictEqual(doc.generationReport?.hydrology.riverCellCount, simulationCellCount)
})

test('runPipelineStep hydrology records substep timings on state', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  state = runPipelineStep(state, 'hydrology')

  assert.ok(state.hydrologySubstepTimings)
  assert.strictEqual(state.hydrologySubstepTimings.length, 9)
})

test('runPipelineStep hydrology skips hydrologyRefine when enableMeanderRefine is false by default', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  state = runPipelineStep(state, 'hydrology')

  const refineTiming = state.hydrologySubstepTimings?.find(
    (row) => row.substepId === 'hydrologyRefine',
  )
  assert.ok(refineTiming)
  assert.strictEqual(refineTiming.skipped, true)
  assert.strictEqual(refineTiming.durationMs, 0)
})

test('full pipeline generation report includes hydrology substep timings', () => {
  const doc = runFullDerivedGeographyPipeline(params)
  assert.ok(doc.generationReport?.hydrologySubstepTimings)
  assert.strictEqual(doc.generationReport.hydrologySubstepTimings.length, 9)
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

test('cloneWorldDocument copies displayBiomes independently', () => {
  const doc = generateDerivedGeography(params)
  const cloned = cloneWorldDocument(doc)

  assert.notStrictEqual(cloned.displayBiomes, doc.displayBiomes)
  assert.deepStrictEqual(cloned.displayBiomes, doc.displayBiomes)
  cloned.displayBiomes[0] = 255
  assert.notStrictEqual(doc.displayBiomes[0], 255)
})

test('cloneWorldDocument copies salinity field independently', () => {
  const doc = runFullDerivedGeographyPipeline(params)
  const cloned = cloneWorldDocument(doc)

  assert.ok(doc.fields.salinity)
  assert.ok(cloned.fields.salinity)
  assert.notStrictEqual(cloned.fields.salinity, doc.fields.salinity)
  assert.deepStrictEqual(cloned.fields.salinity, doc.fields.salinity)
  cloned.fields.salinity[0] = -1
  assert.notStrictEqual(cloned.fields.salinity[0], doc.fields.salinity[0])
})

test('cloneWorldDocument copies arableRaster independently', () => {
  const doc = runFullDerivedGeographyPipeline(params)
  const cloned = cloneWorldDocument(doc)
  assert.ok(doc.arableRaster)
  assert.ok(cloned.arableRaster)
  assert.notStrictEqual(cloned.arableRaster, doc.arableRaster)
  assert.deepStrictEqual(cloned.arableRaster, doc.arableRaster)
  cloned.arableRaster[0] = -1
  assert.notStrictEqual(cloned.arableRaster[0], doc.arableRaster[0])
})

test('cloneWorldDocument copies metalsRaster and metalNodes independently', () => {
  const doc = runFullDerivedGeographyPipeline({
    geographySeed: 42,
    prevailingWindDegrees: 90,
    width: 256,
    height: 256,
  })
  const cloned = cloneWorldDocument(doc)

  assert.ok(doc.metalsRaster)
  assert.ok(cloned.metalsRaster)
  assert.notStrictEqual(cloned.metalsRaster, doc.metalsRaster)
  assert.deepStrictEqual(cloned.metalsRaster, doc.metalsRaster)
  cloned.metalsRaster[0] = -1
  assert.notStrictEqual(cloned.metalsRaster[0], doc.metalsRaster[0])

  assert.ok(doc.metalNodes?.length)
  assert.ok(cloned.metalNodes?.length)
  assert.notStrictEqual(cloned.metalNodes, doc.metalNodes)
  assert.deepStrictEqual(cloned.metalNodes, doc.metalNodes)
  if (cloned.metalNodes && doc.metalNodes) {
    cloned.metalNodes[0].x += 1
    assert.notStrictEqual(cloned.metalNodes[0].x, doc.metalNodes[0].x)
  }
})

test('worker step-complete clone round trip preserves metals raster and nodes', () => {
  let state = createInitialPipelineState(params)
  for (const stepId of [
    'physicalTerrainBaseline',
    'erosion',
    'hydrology',
    'fieldRefresh',
    'coastAndResources',
  ]) {
    state = runPipelineStep(state, stepId)
  }

  const preview = cloneWorldDocument(buildWorldDocumentFromPipelineState(state))
  assert.ok(preview.metalsRaster)
  assert.strictEqual(preview.metalsRaster.length, params.width * params.height)
  assert.ok(Array.isArray(preview.metalNodes))
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

test('cloneWorldDocument copies the simulation river mask independently', () => {
  const doc = runFullDerivedGeographyPipeline(params)
  const cloned = cloneWorldDocument(doc)

  assert.ok(doc.simulationRiverMask)
  assert.ok(cloned.simulationRiverMask)
  assert.notStrictEqual(cloned.simulationRiverMask, doc.simulationRiverMask)
  assert.deepStrictEqual(cloned.simulationRiverMask, doc.simulationRiverMask)
  cloned.simulationRiverMask[0] = doc.simulationRiverMask[0] === 0 ? 1 : 0
  assert.notStrictEqual(cloned.simulationRiverMask[0], doc.simulationRiverMask[0])
})

test('worker step-complete clone round trip preserves the simulation river mask', () => {
  const refineParams = {
    geographySeed: 5000,
    prevailingWindDegrees: 90,
    width: 256,
    height: 256,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enableMeanderRefine: true,
      riverMeanderStrength: 2,
    },
  }
  let state = createInitialPipelineState(refineParams)
  for (const step of DERIVED_GEOGRAPHY_STEPS) {
    state = runPipelineStep(state, step.id)
  }

  const preview = cloneWorldDocument(buildWorldDocumentFromPipelineState(state))
  assert.ok(preview.simulationRiverMask)
  assert.ok(preview.riverNetworkMask)
  assert.strictEqual(countMarkedCells(preview.simulationRiverMask) > 0, true)
  assert.strictEqual(
    countMarkedCells(preview.simulationRiverMask) === countMarkedCells(preview.riverNetworkMask),
    false,
    'serialized simulation mask must stay distinct from the presentation centerline',
  )
})

test('runFullDerivedGeographyPipeline throws when validation retries are exhausted', () => {
  assert.throws(
    () =>
      runFullDerivedGeographyPipeline({
        geographySeed: 999999,
        prevailingWindDegrees: 270,
        width: 16,
        height: 16,
        options: {
          ...DEFAULT_WORLD_GENERATION_OPTIONS,
          enforceCoastConnectedNavigablePath: true,
          minCoastConnectedNavigablePathCells: 99_999,
          maxValidationRetries: 0,
        },
      }),
    /validation retries exhausted/,
  )
})

test('runLandmassPipelineRun exhausts validation retries with incremented seed', () => {
  const baseSeed = 999999
  const result = runLandmassPipelineRun({
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

  assert.ok(result.worldDocument)
  if (result.worldDocument.generationReport?.shouldReject) {
    assert.strictEqual(result.status, 'exhausted')
    assert.strictEqual(result.worldDocument.geographySeed, baseSeed + 2)
  } else {
    assert.strictEqual(result.status, 'success')
    assert.ok(result.worldDocument.geographySeed >= baseSeed && result.worldDocument.geographySeed <= baseSeed + 2)
  }
})

test('runPipelineStep validation emits contract-backed generation report', () => {
  let state = createInitialPipelineState(params)
  for (const stepId of LANDMASS_PIPELINE_STEP_IDS) {
    state = runPipelineStep(state, stepId)
  }

  const report = state.generationReport
  assert.ok(report)
  assert.strictEqual(typeof report.shouldReject, 'boolean')
  assert.strictEqual(typeof report.rejectionSamplingEnforced, 'boolean')
  assert.ok(Array.isArray(report.structuredRejectionReasons))
  assert.strictEqual(typeof report.validationSignals.movement.navigableRiverEdgeCount, 'number')
  assert.strictEqual(
    typeof report.validationSignals.movement.coastConnectedNavigablePathLength,
    'number',
  )
  assert.ok(report.validationRows.every((row) => typeof row.rejectable === 'boolean'))
  assert.ok(report.validationRows.every((row) => typeof row.category === 'string'))
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
    (error) => error instanceof LandmassPipelineCancelledError,
  )

  assert.strictEqual(completedSubsteps, 2)
  assert.ok(events.includes('start:hydrologyFill'))
  assert.ok(events.includes('start:hydrologyClimate'))
  assert.ok(!events.includes('start:hydrologyRoute'))
})
