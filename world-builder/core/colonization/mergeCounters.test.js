import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LIVING_SPHERE_DEFICIT_EPOCHS,
  OUTPOST_REABSORPTION_STAGNATION_EPOCHS,
  patchMergeCounter,
  updateLivingSphereDeficitCounter,
  updateOutpostStagnationCounter,
} from './mergeCounters.js'

test('updateOutpostStagnationCounter increments to threshold and resets on growth', () => {
  let counters = {}
  const daughter = {
    id: 'd1',
    originSettlementId: 'origin',
    tier: 'outpost',
    population: 40,
  }

  for (let epoch = 0; epoch < OUTPOST_REABSORPTION_STAGNATION_EPOCHS; epoch += 1) {
    counters = updateOutpostStagnationCounter({
      settlement: daughter,
      survival: { foodSurplus: -1 },
      counters,
    })
  }
  assert.strictEqual(counters.d1.outpostStagnation, OUTPOST_REABSORPTION_STAGNATION_EPOCHS)

  counters = updateOutpostStagnationCounter({
    settlement: { ...daughter, population: 60 },
    survival: { foodSurplus: -1 },
    counters,
  })
  assert.strictEqual(counters.d1, undefined)
})

test('updateLivingSphereDeficitCounter resets when surplus returns', () => {
  let counters = {}
  const settlement = { id: 's1', tier: 'hamlet', population: 80 }
  for (let epoch = 0; epoch < LIVING_SPHERE_DEFICIT_EPOCHS; epoch += 1) {
    counters = updateLivingSphereDeficitCounter({
      settlement,
      survival: { foodSurplus: -2 },
      counters,
    })
  }
  assert.strictEqual(counters.s1.livingSphereDeficit, LIVING_SPHERE_DEFICIT_EPOCHS)

  counters = updateLivingSphereDeficitCounter({
    settlement,
    survival: { foodSurplus: 1 },
    counters,
  })
  assert.strictEqual(counters.s1, undefined)
})

test('patchMergeCounter removes empty entries', () => {
  const counters = patchMergeCounter({ s1: { outpostStagnation: 2 } }, 's1', {
    outpostStagnation: 0,
  })
  assert.deepStrictEqual(counters, {})
})
