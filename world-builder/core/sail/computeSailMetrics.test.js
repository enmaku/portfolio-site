import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { computeSailMetrics } from './computeSailMetrics.js'

test('computeSailMetrics reports largest connected component size only', () => {
  const width = 6
  const height = 4
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(0.5)
  const mask = new Uint8Array(cellCount)
  mask[0] = 1
  mask[1] = 1
  mask[1 * width + 3] = 1
  mask[1 * width + 4] = 1
  mask[1 * width + 5] = 1
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[1 * width + 3] = 1
  riverCorridorMask[1 * width + 4] = 1
  riverCorridorMask[1 * width + 5] = 1

  const metrics = computeSailMetrics(mask, {
    elevation,
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask,
    gridWidth: width,
    gridHeight: height,
    seaLevel: SEA_LEVEL,
  })

  assert.strictEqual(metrics.largestComponentCellCount, 3)
})

test('computeSailMetrics detects coastal river access when ocean touches inland water', () => {
  const width = 5
  const height = 5
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(0.5)
  for (let x = 0; x < width; x += 1) {
    elevation[x] = 0.2
  }
  elevation[width + 2] = 0.5
  const mask = new Uint8Array(cellCount)
  for (let x = 0; x < width; x += 1) {
    mask[x] = 1
  }
  mask[width + 2] = 1
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[width + 2] = 1

  const metrics = computeSailMetrics(mask, {
    elevation,
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask,
    gridWidth: width,
    gridHeight: height,
    seaLevel: SEA_LEVEL,
  })

  assert.strictEqual(metrics.hasCoastalRiverAccess, true)
})

test('computeSailMetrics reports no coastal river access for inland-only water', () => {
  const width = 5
  const height = 5
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(0.5)
  const lakeMask = new Uint8Array(cellCount)
  lakeMask[2 * width + 2] = 1
  const mask = new Uint8Array(cellCount)
  mask[2 * width + 2] = 1
  mask[2 * width + 3] = 1

  const metrics = computeSailMetrics(mask, {
    elevation,
    lakeMask,
    riverCorridorMask: new Uint8Array(cellCount),
    gridWidth: width,
    gridHeight: height,
    seaLevel: SEA_LEVEL,
  })

  assert.strictEqual(metrics.hasCoastalRiverAccess, false)
})

test('computeSailMetrics measures coast-to-interior path length from ocean inward', () => {
  const width = 6
  const height = 5
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(0.5)
  for (let x = 0; x < width; x += 1) {
    elevation[x] = 0.2
  }
  const mask = new Uint8Array(cellCount)
  for (let x = 0; x < width; x += 1) {
    mask[x] = 1
  }
  mask[width + 2] = 1
  mask[2 * width + 2] = 1
  mask[3 * width + 2] = 1
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[width + 2] = 1
  riverCorridorMask[2 * width + 2] = 1
  riverCorridorMask[3 * width + 2] = 1

  const metrics = computeSailMetrics(mask, {
    elevation,
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask,
    gridWidth: width,
    gridHeight: height,
    seaLevel: SEA_LEVEL,
  })

  assert.ok(metrics.coastToInteriorPathLength >= 3)
})
