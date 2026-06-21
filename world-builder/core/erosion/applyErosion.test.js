import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { applyErosion } from './applyErosion.js'
import { EROSION_SNAPSHOT_INTERVAL, EROSION_STEP_COUNT } from '../types.js'

function makeRampElevation(width, height) {
  const elevation = new Float32Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      elevation[y * width + x] = SEA_LEVEL + 0.5 * (x / (width - 1))
    }
  }
  return elevation
}

test('applyErosion is deterministic for same seed', () => {
  const width = 16
  const height = 16
  const elevation = makeRampElevation(width, height)
  const params = { elevation, width, height, geographySeed: 42 }

  const first = applyErosion(params)
  const second = applyErosion(params)

  assert.deepStrictEqual(first.elevation, second.elevation)
  assert.strictEqual(first.snapshots.length, second.snapshots.length)
  assert.deepStrictEqual(first.snapshots[0], second.snapshots[0])
})

test('applyErosion produces fixed snapshot count for default steps', () => {
  const width = 8
  const height = 8
  const elevation = makeRampElevation(width, height)
  const result = applyErosion({ elevation, width, height, geographySeed: 1 })

  assert.strictEqual(result.stepCount, EROSION_STEP_COUNT)
  const expectedSnapshots = Math.ceil(EROSION_STEP_COUNT / EROSION_SNAPSHOT_INTERVAL)
  assert.strictEqual(result.snapshots.length, expectedSnapshots)
})

test('applyErosion lowers high ground along flow paths', () => {
  const width = 12
  const height = 12
  const elevation = new Float32Array(width * height).fill(0.85)
  elevation[6 * width + 6] = 0.95

  const result = applyErosion({ elevation, width, height, geographySeed: 99 })
  const peakIdx = 6 * width + 6

  assert.ok(result.elevation[peakIdx] < elevation[peakIdx])
})

test('applyErosion deepens channels toward lower neighbors', () => {
  const width = 10
  const height = 10
  const elevation = makeRampElevation(width, height)
  const midIdx = 5 * width + 5
  const before = elevation[midIdx]

  const result = applyErosion({ elevation, width, height, geographySeed: 7 })
  assert.ok(result.elevation[midIdx] <= before)
})
