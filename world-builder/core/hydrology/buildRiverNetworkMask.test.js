import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRiverNetworkMask } from './buildRiverNetworkMask.js'

test('buildRiverNetworkMask traces downstream corridors from overflowing lakes', () => {
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
})
