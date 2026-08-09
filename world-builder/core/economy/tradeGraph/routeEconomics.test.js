import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DIRECTIONAL_FRICTION_DOWNHILL,
  DIRECTIONAL_FRICTION_NEUTRAL,
  DIRECTIONAL_FRICTION_UPHILL,
  ROUTE_CAPACITY_LB_PER_PERSON_DAY,
  directionalHaulFriction,
  offMapCargoCapacityLb,
  routeCargoCapacityLb,
  transportCostCpPerLb,
} from './routeEconomics.js'

test('route cargo capacity uses 365 x sqrt(pop product) x mode multiplier', () => {
  const base = ROUTE_CAPACITY_LB_PER_PERSON_DAY * Math.sqrt(400 * 900)
  assert.strictEqual(routeCargoCapacityLb({ populationA: 400, populationB: 900, mode: 'overland' }), base)
  assert.strictEqual(routeCargoCapacityLb({ populationA: 400, populationB: 900, mode: 'road' }), base * 2)
  assert.strictEqual(
    routeCargoCapacityLb({ populationA: 400, populationB: 900, mode: 'inlandWater' }),
    base * 4,
  )
  assert.strictEqual(
    routeCargoCapacityLb({ populationA: 400, populationB: 900, mode: 'openSea' }),
    base * 10,
  )
})

test('off-map capacity equals open-sea capacity with symmetric population', () => {
  assert.strictEqual(
    offMapCargoCapacityLb(150),
    routeCargoCapacityLb({ populationA: 150, populationB: 150, mode: 'openSea' }),
  )
})

test('transport cost applies mode multipliers and directional friction', () => {
  assert.strictEqual(transportCostCpPerLb({ mode: 'overland', haulDistanceFraction: 1 }), 1)
  assert.strictEqual(transportCostCpPerLb({ mode: 'road', haulDistanceFraction: 2 }), 1)
  assert.strictEqual(transportCostCpPerLb({ mode: 'inlandWater', haulDistanceFraction: 4 }), 1)
  assert.ok(
    Math.abs(transportCostCpPerLb({ mode: 'openSea', haulDistanceFraction: 10 }) - 1) < 1e-9,
  )
  assert.strictEqual(
    transportCostCpPerLb({ mode: 'overland', haulDistanceFraction: 2, directionalFriction: 1.5 }),
    3,
  )
})

test('open-sea transport ignores directional friction', () => {
  assert.ok(
    Math.abs(
      transportCostCpPerLb({ mode: 'openSea', haulDistanceFraction: 10, directionalFriction: 1.5 }) - 1,
    ) < 1e-9,
  )
})

test('directional friction interpolates downhill to uphill and stays neutral on open sea', () => {
  assert.strictEqual(
    directionalHaulFriction({ mode: 'overland', fromElevation: 0.5, toElevation: 0.5 }),
    DIRECTIONAL_FRICTION_NEUTRAL,
  )
  assert.strictEqual(
    directionalHaulFriction({ mode: 'overland', fromElevation: 0, toElevation: 1 }),
    DIRECTIONAL_FRICTION_UPHILL,
  )
  assert.strictEqual(
    directionalHaulFriction({ mode: 'overland', fromElevation: 1, toElevation: 0 }),
    DIRECTIONAL_FRICTION_DOWNHILL,
  )
  assert.strictEqual(
    directionalHaulFriction({ mode: 'openSea', fromElevation: 1, toElevation: 0 }),
    DIRECTIONAL_FRICTION_NEUTRAL,
  )
})

test('directional friction prefers downstream flow sign along inland water', () => {
  assert.strictEqual(
    directionalHaulFriction({ mode: 'inlandWater', downstreamSign: 1 }),
    DIRECTIONAL_FRICTION_DOWNHILL,
  )
  assert.strictEqual(
    directionalHaulFriction({ mode: 'inlandWater', downstreamSign: -1 }),
    DIRECTIONAL_FRICTION_UPHILL,
  )
})
