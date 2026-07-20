import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  computeSettlementTradeProfile,
  tradeProfileWantsAndSupplies,
} from './settlementTradeProfile.js'

test('computes surplusOrDeficit from production and demand', () => {
  const profile = computeSettlementTradeProfile({
    settlementId: 'a',
    production: { grain: 100, fish: 0 },
    demand: { grain: 40, fish: 10 },
  })
  assert.equal(profile.surplusOrDeficit.grain, 60)
  assert.equal(profile.surplusOrDeficit.fish, -10)
})

test('derives demand from population when demand omitted', () => {
  const profile = computeSettlementTradeProfile({
    settlementId: 'a',
    production: { grain: 0 },
    population: 10,
  })
  assert.ok(profile.demand.grain > 0)
  assert.ok(profile.surplusOrDeficit.grain < 0)
})

test('splits wants and supplies from surplusOrDeficit', () => {
  const profile = computeSettlementTradeProfile({
    settlementId: 'a',
    production: { grain: 50, timber: 20 },
    demand: { grain: 10, timber: 40 },
  })
  const { supplies, wants } = tradeProfileWantsAndSupplies(profile, ['grain', 'timber'])
  assert.deepEqual(supplies, [{ commodityId: 'grain', amount: 40 }])
  assert.deepEqual(wants, [{ commodityId: 'timber', amount: 20 }])
})
