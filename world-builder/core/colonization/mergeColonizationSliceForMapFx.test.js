import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeColonizationSliceForMapFx } from './mergeColonizationSliceForMapFx.js'
import {
  COLONIZATION_PHASE_RUNNING,
  createDefaultColonizationSlice,
} from './createDefaultColonizationSlice.js'

test('mergeColonizationSliceForMapFx prefers override primaryClaim over stale slice claim', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_RUNNING
  slice.primaryClaim = { old: [{ x: 0, y: 0 }] }
  slice.settlements = [{ id: 's1', x: 1, y: 1, status: 'living', population: 10 }]

  const base = {
    gridWidth: 4,
    gridHeight: 4,
    geographySeed: 1,
  }
  const overrideClaim = { s1: [{ x: 2, y: 2 }, { x: 3, y: 2 }] }
  const merged = mergeColonizationSliceForMapFx(base, slice, { primaryClaim: overrideClaim })
  assert.deepEqual(merged.primaryClaim, overrideClaim)
  assert.strictEqual(merged.colonizationPhase, COLONIZATION_PHASE_RUNNING)
  assert.strictEqual(merged.settlements[0].id, 's1')
})

test('mergeColonizationSliceForMapFx falls back to slice.primaryClaim', () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_RUNNING
  slice.primaryClaim = { kept: [{ x: 1, y: 1 }] }
  const merged = mergeColonizationSliceForMapFx({ gridWidth: 2, gridHeight: 2 }, slice)
  assert.deepEqual(merged.primaryClaim, { kept: [{ x: 1, y: 1 }] })
})
