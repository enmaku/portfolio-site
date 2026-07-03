import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneWorldDocument } from '../cloneWorldDocument.js'
import {
  COLONIZATION_PHASE_TERRAIN,
  MAX_THREE_DAY_HAUL_DISTANCE,
  createDefaultColonistSettings,
  createDefaultColonizationSlice,
  resolveColonistSettings,
} from './createDefaultColonizationSlice.js'

test('createDefaultColonizationSlice starts in terrain with empty scaffolding', () => {
  const slice = createDefaultColonizationSlice()

  assert.strictEqual(slice.colonizationPhase, COLONIZATION_PHASE_TERRAIN)
  assert.strictEqual(slice.epoch, 0)
  assert.strictEqual(slice.foundingLanding, null)
  assert.strictEqual(slice.realmId, null)
  assert.deepStrictEqual(slice.settlements, [])
  assert.deepStrictEqual(slice.historyLog, [])
  assert.deepStrictEqual(slice.committedTips, [])
  assert.deepStrictEqual(slice.colonistSettings, createDefaultColonistSettings())
})

test('createDefaultColonistSettings provides concrete defaults for every field', () => {
  const settings = createDefaultColonistSettings()

  assert.strictEqual(typeof settings.threeDayHaulDistance, 'number')
  assert.ok(settings.threeDayHaulDistance > 0)
  assert.ok(settings.threeDayHaulDistance <= MAX_THREE_DAY_HAUL_DISTANCE)
  assert.strictEqual(typeof settings.startingPopulation, 'number')
  assert.ok(settings.startingPopulation > 0)
  assert.strictEqual(settings.yieldModifier, 'typical')
  assert.strictEqual(settings.epochBatch, 50)
})

test('resolveColonistSettings clamps three-day haul distance to the scale calibration max', () => {
  const settings = resolveColonistSettings({ threeDayHaulDistance: MAX_THREE_DAY_HAUL_DISTANCE + 50 })
  assert.strictEqual(settings.threeDayHaulDistance, MAX_THREE_DAY_HAUL_DISTANCE)
})

test('cloneWorldDocument copies colonization slice independently', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = 'setup'
  slice.foundingLanding = { x: 3, y: 4 }
  slice.colonistSettings.threeDayHaulDistance = 12
  slice.settlements = [{ id: 's1', x: 3, y: 4, tier: 'outpost', population: 50 }]
  slice.historyLog = [{ kind: 'founding', epoch: 0 }]
  slice.committedTips = [{ epoch: 0, settlements: [{ id: 's1' }] }]
  slice.realmId = 'realm-1'

  const doc = {
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
    ...slice,
  }

  const cloned = cloneWorldDocument(doc)

  assert.strictEqual(cloned.colonizationPhase, 'setup')
  assert.deepStrictEqual(cloned.foundingLanding, { x: 3, y: 4 })
  assert.strictEqual(cloned.colonistSettings.threeDayHaulDistance, 12)
  assert.notStrictEqual(cloned.colonistSettings, doc.colonistSettings)
  assert.notStrictEqual(cloned.foundingLanding, doc.foundingLanding)
  assert.notStrictEqual(cloned.settlements, doc.settlements)
  assert.notStrictEqual(cloned.historyLog, doc.historyLog)
  assert.notStrictEqual(cloned.committedTips, doc.committedTips)

  cloned.foundingLanding.x = 99
  cloned.settlements[0].population = 0
  cloned.historyLog.push({ kind: 'other', epoch: 1 })
  cloned.committedTips[0].epoch = 2
  cloned.colonistSettings.threeDayHaulDistance = 1

  assert.strictEqual(doc.foundingLanding.x, 3)
  assert.strictEqual(doc.settlements[0].population, 50)
  assert.strictEqual(doc.historyLog.length, 1)
  assert.strictEqual(doc.committedTips[0].epoch, 0)
  assert.strictEqual(doc.colonistSettings.threeDayHaulDistance, 12)
})
