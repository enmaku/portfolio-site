import assert from 'node:assert/strict'
import test from 'node:test'
import {
  COLONIZATION_PHASE_SETUP,
  COLONIZATION_PHASE_TERRAIN,
  createDefaultColonizationSlice,
} from './createDefaultColonizationSlice.js'
import {
  applyColonizationSliceToWorldDocument,
  backToTerrain,
  enterColonizationSetup,
  extractColonizationSliceFromWorldDocument,
} from './colonizationPhaseTransitions.js'

test('enterColonizationSetup moves terrain to setup without requiring validation pass', () => {
  const slice = createDefaultColonizationSlice()
  const next = enterColonizationSetup(slice)

  assert.strictEqual(next.colonizationPhase, COLONIZATION_PHASE_SETUP)
  assert.deepStrictEqual(next.colonistSettings, slice.colonistSettings)
  assert.strictEqual(next.foundingLanding, null)
})

test('enterColonizationSetup is a no-op when not in terrain', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 1, y: 2 }

  const next = enterColonizationSetup(slice)
  assert.strictEqual(next.colonizationPhase, COLONIZATION_PHASE_SETUP)
  assert.deepStrictEqual(next.foundingLanding, { x: 1, y: 2 })
})

test('backToTerrain discards setup progress and returns defaults in terrain', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 5, y: 6 }
  slice.colonistSettings.threeDayHaulDistance = 20

  const next = backToTerrain(slice)

  assert.strictEqual(next.colonizationPhase, COLONIZATION_PHASE_TERRAIN)
  assert.strictEqual(next.foundingLanding, null)
  assert.deepStrictEqual(next.colonistSettings, createDefaultColonizationSlice().colonistSettings)
  assert.deepStrictEqual(next.settlements, [])
  assert.deepStrictEqual(next.historyLog, [])
})

test('apply and extract colonization slice round-trip on a world document', () => {
  const geography = {
    geographySeed: 1,
    prevailingWindDegrees: 0,
    gridWidth: 2,
    gridHeight: 2,
    fields: {
      elevation: new Float32Array(4),
      temperature: new Float32Array(4),
      rainfall: new Float32Array(4),
      drainage: new Float32Array(4),
      salinity: new Float32Array(4),
    },
    biomes: new Uint8Array(4),
    displayBiomes: new Uint8Array(4),
    biomeCatalog: [],
    generatedAt: 'test',
    pipelineStage: 'derivedGeography',
  }
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 0, y: 1 }

  const doc = applyColonizationSliceToWorldDocument(geography, slice)
  const extracted = extractColonizationSliceFromWorldDocument(doc)

  assert.strictEqual(extracted.colonizationPhase, COLONIZATION_PHASE_SETUP)
  assert.deepStrictEqual(extracted.foundingLanding, { x: 0, y: 1 })
  assert.strictEqual(doc.geographySeed, 1)
})
