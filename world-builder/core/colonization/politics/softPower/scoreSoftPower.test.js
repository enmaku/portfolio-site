import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SOFT_POWER_MAJORITY,
  SOFT_POWER_MARGIN_RATIO,
  isSoftPowerDominant,
  scoreSoftPowerBySettlement,
} from './scoreSoftPower.js'

function living(id, factionId = null, extra = {}) {
  return {
    id,
    factionId,
    status: 'living',
    population: 100,
    isTradePartner: false,
    vassalLiegeSettlementId: null,
    ...extra,
  }
}

function faction(id, capitalSettlementId, settlementIds) {
  return { id, capitalSettlementId, settlementIds, status: 'active' }
}

test('dominance requires majority and 2x margin', () => {
  assert.equal(isSoftPowerDominant({ share: 0.5, runnerUpShare: 0.25 }), false)
  assert.equal(isSoftPowerDominant({ share: 0.501, runnerUpShare: 0.25 }), true)
  assert.equal(isSoftPowerDominant({ share: 0.6, runnerUpShare: 0.31 }), false)
  assert.equal(isSoftPowerDominant({ share: 0.66, runnerUpShare: 0.33 }), true)
  assert.equal(isSoftPowerDominant({ share: 1, runnerUpShare: 0 }), true)
  assert.equal(SOFT_POWER_MAJORITY, 0.5)
  assert.equal(SOFT_POWER_MARGIN_RATIO, 2)
})

test('scores pin trade shares against faction taxed members and trade partners', () => {
  const settlements = [
    living('free'),
    living('cap-a', 'fa'),
    living('m-a', 'fa'),
    living('tp-a', 'fa', { isTradePartner: true }),
    living('cap-b', 'fb'),
    living('m-b', 'fb'),
  ]
  const factions = [
    faction('fa', 'cap-a', ['cap-a', 'm-a', 'tp-a']),
    faction('fb', 'cap-b', ['cap-b', 'm-b']),
  ]
  const bilateralCpByPair = {
    'free|m-a': 60,
    'free|tp-a': 20,
    'free|m-b': 20,
  }
  const scores = scoreSoftPowerBySettlement({
    settlements,
    factions,
    bilateralCpByPair,
  })
  const free = scores.free
  assert.ok(free)
  assert.equal(free.sharesByFactionId.fa, 0.8)
  assert.equal(free.sharesByFactionId.fb, 0.2)
  assert.equal(free.dominantFactionId, 'fa')
  assert.equal(free.majority, true)
  assert.equal(free.marginOk, true)
})

test('thin plurality without majority does not dominate', () => {
  const settlements = [
    living('free'),
    living('a1', 'fa'),
    living('b1', 'fb'),
    living('c1', 'fc'),
  ]
  const factions = [
    faction('fa', 'a1', ['a1']),
    faction('fb', 'b1', ['b1']),
    faction('fc', 'c1', ['c1']),
  ]
  const scores = scoreSoftPowerBySettlement({
    settlements,
    factions,
    bilateralCpByPair: {
      'a1|free': 40,
      'b1|free': 35,
      'c1|free': 25,
    },
  })
  assert.equal(scores.free.dominantFactionId, null)
  assert.equal(scores.free.majority, false)
})

test('majority without 2x margin does not dominate', () => {
  const settlements = [living('free'), living('a1', 'fa'), living('b1', 'fb')]
  const factions = [faction('fa', 'a1', ['a1']), faction('fb', 'b1', ['b1'])]
  const scores = scoreSoftPowerBySettlement({
    settlements,
    factions,
    bilateralCpByPair: {
      'a1|free': 55,
      'b1|free': 45,
    },
  })
  assert.equal(scores.free.dominantFactionId, null)
  assert.equal(scores.free.majority, true)
  assert.equal(scores.free.marginOk, false)
})

test('absolute floor blocks dominance when total volume is too low', () => {
  const settlements = [living('free'), living('a1', 'fa')]
  const factions = [faction('fa', 'a1', ['a1'])]
  const scores = scoreSoftPowerBySettlement({
    settlements,
    factions,
    bilateralCpByPair: { 'a1|free': 5 },
    absFloorCp: 10,
  })
  assert.equal(scores.free.dominantFactionId, null)
})

test('taxed members still receive rival dominance scores for rebellion pressure', () => {
  const settlements = [
    living('member', 'fa'),
    living('cap-a', 'fa'),
    living('rival', 'fb'),
  ]
  const factions = [
    faction('fa', 'cap-a', ['cap-a', 'member']),
    faction('fb', 'rival', ['rival']),
  ]
  const scores = scoreSoftPowerBySettlement({
    settlements,
    factions,
    bilateralCpByPair: {
      'cap-a|member': 20,
      'member|rival': 80,
    },
  })
  assert.equal(scores.member.sharesByFactionId.fb, 0.8)
  assert.equal(scores.member.dominantFactionId, 'fb')
})

test('determinism: same inputs yield same scores', () => {
  const input = {
    settlements: [living('free'), living('a1', 'fa'), living('b1', 'fb')],
    factions: [faction('fa', 'a1', ['a1']), faction('fb', 'b1', ['b1'])],
    bilateralCpByPair: { 'a1|free': 80, 'b1|free': 20 },
  }
  assert.deepStrictEqual(scoreSoftPowerBySettlement(input), scoreSoftPowerBySettlement(input))
})
