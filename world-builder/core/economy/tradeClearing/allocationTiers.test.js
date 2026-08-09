import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DIAMOND_PROSPERITY_GP_PER_PERSON,
  PROSPERITY_GP_PER_PERSON,
  prosperityDemandUnits,
  prosperityGpPerPerson,
} from './allocationTiers.js'

test('diamonds use a thinner prosperity gp target than other commodities', () => {
  assert.equal(PROSPERITY_GP_PER_PERSON, 1)
  assert.equal(DIAMOND_PROSPERITY_GP_PER_PERSON, 0.5)
  assert.equal(prosperityGpPerPerson('gold'), PROSPERITY_GP_PER_PERSON)
  assert.equal(prosperityGpPerPerson('diamonds'), DIAMOND_PROSPERITY_GP_PER_PERSON)
  // 10k people × 0.5 gp / 5000 gp per gem = 1 gem
  assert.equal(prosperityDemandUnits('diamonds', 10000), 1)
})
