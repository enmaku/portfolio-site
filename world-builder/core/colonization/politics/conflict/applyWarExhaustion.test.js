import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyWarExhaustion,
  decayWarExhaustion,
} from './applyWarExhaustion.js'
import {
  WAR_EXHAUSTION_DECAY_EPOCHS,
  WAR_EXHAUSTION_PENALTY,
} from './conflictConstants.js'

function livingSettlement(id, population) {
  return { id, population, status: 'living' }
}

test('fought war applies proportional population losses on both sides with stake premium', () => {
  const slice = {
    epoch: 10,
    settlements: [
      livingSettlement('a', 1000),
      livingSettlement('b', 1000),
      livingSettlement('stake', 1000),
    ],
    warExhaustionBySettlementId: {},
  }
  const result = applyWarExhaustion({
    slice,
    contributionsBySettlementId: { a: 60, b: 40, stake: 100 },
    contestedSettlementId: 'stake',
    epoch: 10,
    fought: true,
  })
  const byId = Object.fromEntries(result.slice.settlements.map((s) => [s.id, s.population]))
  assert.ok(byId.a < 1000)
  assert.ok(byId.b < 1000)
  assert.ok(byId.stake < byId.a)
  assert.ok(byId.stake < byId.b)
  assert.ok(result.populationLosses.stake > result.populationLosses.a)
})

test('temporary martial penalty refreshes on re-fight and decays over epochs', () => {
  let slice = {
    epoch: 5,
    settlements: [livingSettlement('a', 500)],
    warExhaustionBySettlementId: {},
  }
  slice = applyWarExhaustion({
    slice,
    contributionsBySettlementId: { a: 50 },
    contestedSettlementId: 'a',
    epoch: 5,
    fought: true,
  }).slice
  assert.equal(slice.warExhaustionBySettlementId.a.penalty, WAR_EXHAUSTION_PENALTY)
  assert.equal(slice.warExhaustionBySettlementId.a.expiresEpoch, 5 + WAR_EXHAUSTION_DECAY_EPOCHS)

  slice = applyWarExhaustion({
    slice,
    contributionsBySettlementId: { a: 50 },
    contestedSettlementId: 'a',
    epoch: 6,
    fought: true,
  }).slice
  assert.equal(slice.warExhaustionBySettlementId.a.expiresEpoch, 6 + WAR_EXHAUSTION_DECAY_EPOCHS)

  slice = decayWarExhaustion({ slice, epoch: 6 + WAR_EXHAUSTION_DECAY_EPOCHS }).slice
  assert.equal(slice.warExhaustionBySettlementId.a, undefined)
})

test('non-fought unreachable exits do not apply full war exhaustion', () => {
  const slice = {
    epoch: 3,
    settlements: [livingSettlement('a', 800), livingSettlement('b', 800)],
    warExhaustionBySettlementId: {},
  }
  const result = applyWarExhaustion({
    slice,
    contributionsBySettlementId: { a: 10 },
    contestedSettlementId: 'b',
    epoch: 3,
    fought: false,
  })
  assert.equal(result.slice.settlements[0].population, 800)
  assert.deepEqual(result.slice.warExhaustionBySettlementId, {})
  assert.deepEqual(result.populationLosses, {})
})
