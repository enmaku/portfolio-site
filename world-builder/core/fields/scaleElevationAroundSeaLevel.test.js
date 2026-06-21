import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { scaleElevationAroundSeaLevel } from './scaleElevationAroundSeaLevel.js'

test('scaleElevationAroundSeaLevel leaves sea level unchanged', () => {
  const elevation = new Float32Array([SEA_LEVEL, SEA_LEVEL, SEA_LEVEL])
  scaleElevationAroundSeaLevel(elevation, SEA_LEVEL, 2)
  for (const value of elevation) {
    assert.ok(Math.abs(value - SEA_LEVEL) < 1e-5)
  }
})

test('scaleElevationAroundSeaLevel amplifies highs and deepens lows', () => {
  const elevation = new Float32Array([0.1, SEA_LEVEL, 0.9])
  scaleElevationAroundSeaLevel(elevation, SEA_LEVEL, 2)
  assert.ok(elevation[0] < 0.1)
  assert.ok(Math.abs(elevation[1] - SEA_LEVEL) < 1e-5)
  assert.ok(elevation[2] > 0.9)
})

test('scaleElevationAroundSeaLevel flattens relief below 1', () => {
  const elevation = new Float32Array([0.1, SEA_LEVEL, 0.9])
  scaleElevationAroundSeaLevel(elevation, SEA_LEVEL, 0.5)
  assert.ok(elevation[0] > 0.1)
  assert.ok(Math.abs(elevation[1] - SEA_LEVEL) < 1e-5)
  assert.ok(elevation[2] < 0.9)
})

test('scaleElevationAroundSeaLevel clamps to normalized range', () => {
  const elevation = new Float32Array([0, 1])
  scaleElevationAroundSeaLevel(elevation, SEA_LEVEL, 4)
  assert.strictEqual(elevation[0], 0)
  assert.strictEqual(elevation[1], 1)
})
