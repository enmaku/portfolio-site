import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRiverNetworkMask } from './buildRiverNetworkMask.js'

test('buildRiverNetworkMask marks downstream corridor cells from lake overflow outlets', () => {
  const width = 7
  const height = 5
  const cellCount = width * height
  const flowAccumulation = new Float32Array(cellCount).fill(1)
  const flowDirection = new Int16Array(cellCount).fill(-1)
  const ocean = Array.from({ length: cellCount }, () => false)
  const lakeMask = new Uint8Array(cellCount)
  const lakeIdByCell = new Int32Array(cellCount).fill(-1)

  lakeMask[2 * width + 2] = 1
  lakeIdByCell[2 * width + 2] = 0
  flowAccumulation[2 * width + 3] = 20
  flowDirection[2 * width + 3] = 4
  flowAccumulation[2 * width + 4] = 18
  flowDirection[2 * width + 4] = 4
  flowAccumulation[2 * width + 5] = 16
  flowDirection[2 * width + 5] = 4
  ocean[2 * width + 6] = true

  const mask = buildRiverNetworkMask({
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
    lakeMask,
    overflowLakeIds: new Set([0]),
    lakeIdByCell,
    navigableFlowCutoffScale: 0.1,
  })

  assert.strictEqual(mask[2 * width + 3], 1)
  assert.ok(mask[2 * width + 4] === 1 || mask[2 * width + 5] === 1)
  assert.strictEqual(mask[2 * width + 2], 0)
})

test('buildRiverNetworkMask marks coastal tributaries draining to ocean', () => {
  const width = 9
  const height = 5
  const cellCount = width * height
  const flowAccumulation = new Float32Array(cellCount).fill(1)
  const flowDirection = new Int16Array(cellCount).fill(-1)
  const ocean = Array.from({ length: cellCount }, () => false)

  for (let x = 1; x <= 5; x += 1) {
    const idx = 2 * width + x
    flowAccumulation[idx] = 40 - x
    flowDirection[idx] = 4
  }
  ocean[2 * width + 6] = true

  const mask = buildRiverNetworkMask({
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
    navigableFlowCutoffScale: 0.1,
  })

  assert.strictEqual(mask[2 * width + 5], 1)
  assert.ok(mask[2 * width + 4] === 1 || mask[2 * width + 3] === 1)
  assert.strictEqual(mask[2 * width + 6], 0)
})

test('buildRiverNetworkMask stays empty when no coastal outlets exist', () => {
  const width = 4
  const height = 4
  const cellCount = width * height
  const flowAccumulation = new Float32Array(cellCount).fill(10)
  const flowDirection = new Int16Array(cellCount).fill(4)
  const ocean = Array.from({ length: cellCount }, () => false)

  const mask = buildRiverNetworkMask({
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
  })

  assert.ok(mask.every((value) => value === 0))
})
