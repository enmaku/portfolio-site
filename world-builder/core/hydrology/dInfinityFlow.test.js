import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeFlowPartitions,
  D8_FALLBACK_MAX_AREA,
  D8_OFFSETS,
  facetSlope,
  partitionsToFlowDirection,
} from './dInfinityFlow.js'

test('facetSlope returns null when both neighbors are uphill', () => {
  assert.strictEqual(facetSlope(0.5, 0.6, 0.7, 1, 1), null)
})

test('D8 fallback routes tiny upslope-area headwaters through a single downstream cell', () => {
  const width = 5
  const height = 5
  const elevation = new Float32Array(width * height).fill(0.5)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      elevation[y * width + x] = 0.9 - y * 0.15
    }
  }

  const ocean = Array.from({ length: width * height }, () => false)
  const partitions = computeFlowPartitions({ elevation, width, height, ocean })
  const headwaterIdx = 0
  const headwater = partitions[headwaterIdx]

  assert.strictEqual(headwater.primaryFraction, 1)
  assert.strictEqual(headwater.secondaryFraction, 0)
  assert.strictEqual(headwater.secondaryDir, -1)
  assert.ok(headwater.primaryDir >= 0)
  assert.ok(headwater.primaryIdx >= 0)
})

test('partitionsToFlowDirection exposes primary D8 direction for graph tracing', () => {
  const width = 3
  const height = 3
  const elevation = new Float32Array(width * height).fill(0.5)
  elevation[0] = 0.9
  elevation[3] = 0.3
  const ocean = Array.from({ length: width * height }, () => false)
  const partitions = computeFlowPartitions({ elevation, width, height, ocean })
  const flowDirection = partitionsToFlowDirection(partitions)

  assert.ok(flowDirection[0] >= 0)
  assert.ok(flowDirection[0] < D8_OFFSETS.length)
})

test('D8_FALLBACK_MAX_AREA bounds headwater fallback routing', () => {
  assert.strictEqual(D8_FALLBACK_MAX_AREA, 1)
})
