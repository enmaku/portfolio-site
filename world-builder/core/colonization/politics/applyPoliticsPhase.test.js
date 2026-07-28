import assert from 'node:assert/strict'
import test from 'node:test'
import { applyPoliticsPhase } from './applyPoliticsPhase.js'
import { HISTORY_KIND_INCREMENT3_LATCHED } from './historyKinds.js'
import { createDefaultColonizationSlice } from '../createDefaultColonizationSlice.js'

function flatLandDoc(width, height) {
  const n = width * height
  return {
    gridWidth: width,
    gridHeight: height,
    arableRaster: new Float32Array(n).fill(2),
    timberRaster: new Float32Array(n).fill(1),
    fields: {
      elevation: new Float32Array(n).fill(0.6),
      movementCost: new Float32Array(n).fill(1),
    },
    lakeMask: new Uint8Array(n),
    riverCorridorMask: new Uint8Array(n),
  }
}

test('applyPoliticsPhase leaves membership empty before latch conditions hold', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 5
  slice.settlements = [
    { id: 'a', x: 5, y: 5, population: 100, status: 'living', tier: 'village' },
    { id: 'b', x: 6, y: 5, population: 100, status: 'living', tier: 'village' },
  ]
  const { slice: next, events } = applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(20, 20),
    primaryClaim: {},
  })

  assert.strictEqual(next.increment3LatchedEpoch, null)
  assert.deepStrictEqual(next.factions, [])
  assert.ok(!events.some((e) => e.kind === HISTORY_KIND_INCREMENT3_LATCHED))
})

test('applyPoliticsPhase latches once and records history', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 8
  slice.colonistSettings.threeDayHaulDistance = 3
  slice.settlements = [
    { id: 'a', x: 2, y: 2, population: 100, status: 'living', tier: 'village' },
    { id: 'b', x: 35, y: 35, population: 100, status: 'living', tier: 'village' },
  ]
  const doc = flatLandDoc(40, 40)
  const first = applyPoliticsPhase({
    slice,
    worldDocument: doc,
    primaryClaim: {},
  })
  assert.strictEqual(first.slice.increment3LatchedEpoch, 8)
  assert.ok(first.slice.historyLog.some((e) => e.kind === HISTORY_KIND_INCREMENT3_LATCHED))

  const second = applyPoliticsPhase({
    slice: first.slice,
    worldDocument: doc,
    primaryClaim: {},
  })
  assert.strictEqual(second.slice.increment3LatchedEpoch, 8)
  assert.strictEqual(
    second.slice.historyLog.filter((e) => e.kind === HISTORY_KIND_INCREMENT3_LATCHED).length,
    1,
  )
})
