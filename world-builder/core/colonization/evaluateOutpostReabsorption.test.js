import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateOutpostReabsorption } from './evaluateOutpostReabsorption.js'
import { OUTPOST_REABSORPTION_STAGNATION_EPOCHS } from './mergeCounters.js'

test('evaluateOutpostReabsorption merges stagnating daughter into origin survivor', () => {
  const settlements = [
    { id: 'origin', status: 'living', tier: 'hamlet', population: 120 },
    {
      id: 'daughter',
      status: 'living',
      tier: 'outpost',
      population: 30,
      originSettlementId: 'origin',
    },
  ]
  const candidates = evaluateOutpostReabsorption({
    settlements,
    mergeCounters: {
      daughter: { outpostStagnation: OUTPOST_REABSORPTION_STAGNATION_EPOCHS },
    },
    foundingSettlementId: 'origin',
    alreadyAbsorbedThisEpoch: new Set(),
    alreadySurvivorThisEpoch: new Set(),
  })

  assert.strictEqual(candidates.length, 1)
  assert.strictEqual(candidates[0].survivorSettlementId, 'origin')
  assert.strictEqual(candidates[0].absorbedSettlementId, 'daughter')
})

test('evaluateOutpostReabsorption keeps founding landing merge-immune as absorbed pin', () => {
  const settlements = [
    {
      id: 'founding',
      status: 'living',
      tier: 'outpost',
      population: 30,
      originSettlementId: 'origin',
    },
    { id: 'origin', status: 'living', tier: 'hamlet', population: 120 },
  ]
  const candidates = evaluateOutpostReabsorption({
    settlements,
    mergeCounters: {
      founding: { outpostStagnation: OUTPOST_REABSORPTION_STAGNATION_EPOCHS },
    },
    foundingSettlementId: 'founding',
    alreadyAbsorbedThisEpoch: new Set(),
    alreadySurvivorThisEpoch: new Set(),
  })
  assert.strictEqual(candidates.length, 0)
})
