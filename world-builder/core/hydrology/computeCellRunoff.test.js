import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeCellRunoff,
  computeDrainageInfiltration,
  RUNOFF_EPSILON,
  RUNOFF_TO_FLOW_UNITS,
} from './computeCellRunoff.js'
import { facetSlope } from './dInfinityFlow.js'

test('computeDrainageInfiltration caps at 0.8', () => {
  const drainage = new Float32Array([1])
  assert.ok(computeDrainageInfiltration(drainage, 0, 2) <= 0.8)
})

test('computeCellRunoff applies rainfall infiltration and snow melt', () => {
  const rainfall = new Float32Array([0.5, 0.5])
  const meltContribution = new Float32Array([0, 3])
  const soilDrainage = new Float32Array([0, 1])
  const runoff = computeCellRunoff({
    rainfall,
    meltContribution,
    soilDrainage,
    soilDrainageScale: 1,
  })

  assert.ok(Math.abs(runoff[0] - 0.5 * RUNOFF_TO_FLOW_UNITS) < 1e-5)
  assert.ok(runoff[1] > 3 * RUNOFF_TO_FLOW_UNITS)
})

test('computeCellRunoff enforces RUNOFF_EPSILON on bare land', () => {
  const runoff = computeCellRunoff({
    rainfall: new Float32Array([0]),
  })
  assert.ok(Math.abs(runoff[0] - RUNOFF_EPSILON) < 1e-6 || runoff[0] === RUNOFF_EPSILON)
})

test('facetSlope returns split fraction between two downhill neighbors', () => {
  const slope = facetSlope(1, 0.75, 0.85, 1, Math.SQRT2)
  assert.ok(slope)
  assert.ok(slope.r > 0 && slope.r < 1)
})
