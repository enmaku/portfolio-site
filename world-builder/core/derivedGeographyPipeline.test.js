import assert from 'node:assert/strict'
import test from 'node:test'
import { generateDerivedGeography } from './generateDerivedGeography.js'
import {
  buildWorldDocumentFromPipelineState,
  createInitialPipelineState,
  DERIVED_GEOGRAPHY_STEPS,
  runFullDerivedGeographyPipeline,
  runPipelineStep,
} from './derivedGeographyPipeline.js'

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
