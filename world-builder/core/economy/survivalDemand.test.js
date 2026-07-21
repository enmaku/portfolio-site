import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FOOD_LB_PER_PERSON,
  SALT_LB_PER_PERSON,
  SURVIVAL_COMFORT_FOOD_MULTIPLIER,
  comfortFoodDemandLb,
  survivalFoodDemandLb,
  survivalSaltDemandLb,
} from './survivalDemand.js'

test('survival demand scales linearly with population', () => {
  assert.equal(survivalFoodDemandLb(100), 100 * FOOD_LB_PER_PERSON)
  assert.equal(survivalSaltDemandLb(100), 100 * SALT_LB_PER_PERSON)
})

test('survival demand clamps negative population to zero', () => {
  assert.equal(survivalFoodDemandLb(-5), 0)
  assert.equal(survivalSaltDemandLb(-5), 0)
})

test('comfort food demand is survival food demand times the comfort multiplier', () => {
  assert.equal(comfortFoodDemandLb(100), survivalFoodDemandLb(100) * SURVIVAL_COMFORT_FOOD_MULTIPLIER)
})
