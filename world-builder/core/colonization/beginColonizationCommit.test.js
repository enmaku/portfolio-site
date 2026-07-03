import assert from 'node:assert/strict'
import test from 'node:test'
import { beginColonizationCommit } from './beginColonizationCommit.js'
import {
  COLONIZATION_PHASE_RUNNING,
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
} from './createDefaultColonizationSlice.js'

function geographyDoc() {
  return {
    geographySeed: 42,
    gridWidth: 4,
    gridHeight: 4,
    fields: {
      elevation: new Float32Array(16),
      temperature: new Float32Array(16).fill(0.5),
      rainfall: new Float32Array(16).fill(0.4),
      drainage: new Float32Array(16),
      salinity: new Float32Array(16).fill(0.1),
    },
  }
}

test('beginColonizationCommit enters running with founding settlement and tip', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 1, y: 2 }
  slice.colonistSettings.startingPopulation = 120

  const next = beginColonizationCommit(slice, geographyDoc())

  assert.strictEqual(next.colonizationPhase, COLONIZATION_PHASE_RUNNING)
  assert.strictEqual(next.epoch, 0)
  assert.strictEqual(next.settlements.length, 1)
  assert.strictEqual(next.settlements[0].x, 1)
  assert.strictEqual(next.settlements[0].y, 2)
  assert.strictEqual(next.settlements[0].population, 120)
  assert.strictEqual(next.historyLog.length, 1)
  assert.strictEqual(next.historyLog[0].kind, 'founding')
  assert.strictEqual(next.committedTips.length, 1)
  assert.strictEqual(next.committedTips[0].epoch, 0)
  assert.ok(typeof next.realmId === 'string' && next.realmId.length > 0)
})

test('beginColonizationCommit is a no-op without landing or outside setup', () => {
  const noLanding = createDefaultColonizationSlice()
  noLanding.colonizationPhase = COLONIZATION_PHASE_SETUP
  assert.strictEqual(beginColonizationCommit(noLanding, geographyDoc()), noLanding)

  const terrain = createDefaultColonizationSlice()
  terrain.foundingLanding = { x: 0, y: 0 }
  assert.strictEqual(beginColonizationCommit(terrain, geographyDoc()), terrain)
})
