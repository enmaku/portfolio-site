import assert from 'node:assert/strict'
import test from 'node:test'
import { computeRealmExpeditionBudget } from './computeRealmExpeditionBudget.js'

test('computeRealmExpeditionBudget keeps independent land and maritime pools', () => {
  const budget = computeRealmExpeditionBudget({
    totalPopulation: 10000,
    landFrontierEdges: 40,
    maritimeFrontierEdges: 16,
    frontierExhausted: false,
    eligiblePortCount: 0,
  })
  assert.strictEqual(budget.landSlots, 632)
  assert.strictEqual(budget.maritimeSlots, 400)
})

test('computeRealmExpeditionBudget tapers land pool when frontier exhausted', () => {
  const active = computeRealmExpeditionBudget({
    totalPopulation: 10000,
    landFrontierEdges: 40,
    maritimeFrontierEdges: 0,
    frontierExhausted: false,
    eligiblePortCount: 0,
  })
  const exhausted = computeRealmExpeditionBudget({
    totalPopulation: 10000,
    landFrontierEdges: 40,
    maritimeFrontierEdges: 0,
    frontierExhausted: true,
    eligiblePortCount: 0,
  })
  assert.strictEqual(exhausted.landSlots, Math.floor(active.landSlots * 0.15))
})

test('computeRealmExpeditionBudget floors maritime pool at eligible port count', () => {
  const budget = computeRealmExpeditionBudget({
    totalPopulation: 100,
    landFrontierEdges: 0,
    maritimeFrontierEdges: 4,
    frontierExhausted: false,
    eligiblePortCount: 3,
  })
  assert.ok(budget.maritimeSlots >= 3)
})

test('computeRealmExpeditionBudget floors maritime pool for ports when unvisited sail remains', () => {
  const budget = computeRealmExpeditionBudget({
    totalPopulation: 100,
    landFrontierEdges: 0,
    maritimeFrontierEdges: 0,
    frontierExhausted: false,
    eligiblePortCount: 2,
    hasUnvisitedSailCells: true,
  })
  assert.ok(budget.maritimeSlots >= 2)
})
