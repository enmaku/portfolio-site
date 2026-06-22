import assert from 'node:assert/strict'
import test from 'node:test'
import { computeFlowAccumulation } from './computeFlowAccumulation.js'
import { meanderAndSettleRivers, mergeParallelRiverBranches } from './meanderAndSettleRivers.js'

test('meanderAndSettleRivers is a no-op when meandering, settlement, and merge are disabled', () => {
  const width = 8
  const height = 8
  const mask = new Uint8Array(width * height)
  for (let x = 1; x <= 5; x += 1) {
    mask[4 * width + x] = 1
  }
  const elevation = new Float32Array(width * height).fill(0.7)
  const ocean = new Array(width * height).fill(false)
  const flowDirection = new Int16Array(width * height).fill(-1)
  const flowAccumulation = new Float32Array(width * height).fill(1)

  const result = meanderAndSettleRivers({
    riverNetworkMask: mask,
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 1,
    meanderStrength: 0,
    settlementStepCount: 0,
    mergeStrength: 0,
  })

  assert.strictEqual(result.riverNetworkMask, mask)
  assert.strictEqual(result.elevation, elevation)
})

test('meanderAndSettleRivers adds lateral deviation to straight river segments', () => {
  const width = 48
  const height = 48
  const mask = new Uint8Array(width * height)
  for (let x = 8; x <= 38; x += 1) {
    mask[24 * width + x] = 1
  }

  const elevation = new Float32Array(width * height).fill(0.78)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const wave = 0.05 * Math.sin((2 * Math.PI * x) / 11 + y * 0.14)
      elevation[y * width + x] = 0.72 + wave + Math.abs(y - 24) * 0.003
    }
  }

  const { ocean } = computeFlowAccumulation({ elevation, width, height })
  const flowDirection = new Int16Array(width * height).fill(-1)
  for (let x = 8; x < 38; x += 1) {
    flowDirection[24 * width + x] = 4
  }
  const flowAccumulation = new Float32Array(width * height).fill(64)

  const result = meanderAndSettleRivers({
    riverNetworkMask: mask,
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 4242,
    meanderStrength: 1.2,
    settlementStepCount: 0,
    mergeStrength: 0,
  })

  const newCells = collectAddedCells(mask, result.riverNetworkMask)
  assert.ok(newCells.length > 0)
  const maxDeviation = maxLateralDeviation(newCells, 8, 38, 24, width)
  assert.ok(
    maxDeviation >= 2,
    `expected meandered corridor, max lateral deviation=${maxDeviation.toFixed(2)}`,
  )
})

test('meanderAndSettleRivers carves river cells lower during settlement', () => {
  const width = 16
  const height = 16
  const mask = new Uint8Array(width * height)
  for (let x = 2; x <= 12; x += 1) {
    mask[8 * width + x] = 1
  }
  const elevation = new Float32Array(width * height).fill(0.68)
  for (let x = 2; x <= 12; x += 1) {
    elevation[8 * width + x] = 0.68 - (x - 2) * 0.004
  }
  const ocean = new Array(width * height).fill(false)
  const flowDirection = new Int16Array(width * height).fill(-1)
  const flowAccumulation = new Float32Array(width * height).fill(32)

  const before = averageRiverElevation(mask, elevation)
  const result = meanderAndSettleRivers({
    riverNetworkMask: mask,
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 9001,
    meanderStrength: 0,
    settlementStepCount: 6,
    mergeStrength: 0,
    channelWear: 0.006,
  })
  const after = averageRiverElevation(result.riverNetworkMask, result.elevation)

  assert.ok(after < before, `expected carved channel, before=${before}, after=${after}`)
})

test('mergeParallelRiverBranches collapses parallel strands toward the main channel', () => {
  const width = 32
  const height = 32
  const mask = new Uint8Array(width * height)
  for (let y = 10; y <= 13; y += 1) {
    for (let x = 4; x <= 26; x += 1) {
      mask[y * width + x] = 1
    }
  }

  const elevation = new Float32Array(width * height).fill(0.72)
  for (let x = 4; x <= 26; x += 1) {
    elevation[10 * width + x] = 0.66
    elevation[11 * width + x] = 0.62
    elevation[12 * width + x] = 0.63
    elevation[13 * width + x] = 0.67
  }

  const ocean = new Array(width * height).fill(false)
  for (let y = 0; y < height; y += 1) {
    for (let x = 27; x < width; x += 1) {
      ocean[y * width + x] = true
    }
  }

  const flowDirection = new Int16Array(width * height).fill(-1)
  for (let y = 10; y <= 13; y += 1) {
    for (let x = 4; x < 27; x += 1) {
      flowDirection[y * width + x] = 4
    }
  }

  const flowAccumulation = new Float32Array(width * height).fill(1)
  for (let x = 4; x <= 26; x += 1) {
    flowAccumulation[11 * width + x] = 120
    flowAccumulation[12 * width + x] = 95
    flowAccumulation[10 * width + x] = 18
    flowAccumulation[13 * width + x] = 14
  }

  const merged = mergeParallelRiverBranches({
    riverNetworkMask: mask,
    elevation,
    flowAccumulation,
    ocean,
    flowDirection,
    width,
    height,
    mergeStrength: 1.2,
  })

  assert.ok(countMarked(merged) < countMarked(mask))
  assert.strictEqual(merged[11 * width + 12], 1)
  assert.strictEqual(merged[12 * width + 12], 1)
  assert.strictEqual(merged[10 * width + 12], 0)
  assert.strictEqual(merged[13 * width + 12], 0)
  assert.strictEqual(riverComponentCount(merged, width, height), 1)
})

test('mergeParallelRiverBranches preserves single-width bridge corridors', () => {
  const width = 32
  const height = 32
  const mask = new Uint8Array(width * height)
  for (let x = 2; x <= 16; x += 1) {
    mask[8 * width + x] = 1
    mask[22 * width + x] = 1
  }
  for (let y = 9; y <= 21; y += 1) {
    mask[y * width + 15] = 1
  }

  const elevation = new Float32Array(width * height).fill(0.72)
  for (let x = 2; x <= 16; x += 1) {
    elevation[8 * width + x] = 0.62 - x * 0.002
    elevation[22 * width + x] = 0.58 - x * 0.002
  }
  for (let y = 9; y <= 21; y += 1) {
    elevation[y * width + 15] = 0.6 - (y - 9) * 0.002
  }

  const ocean = new Array(width * height).fill(false)
  for (let y = 0; y < height; y += 1) {
    for (let x = 20; x < width; x += 1) {
      ocean[y * width + x] = true
    }
  }

  const flowDirection = new Int16Array(width * height).fill(-1)
  for (let x = 2; x < 16; x += 1) {
    flowDirection[8 * width + x] = 4
    flowDirection[22 * width + x] = 4
  }
  for (let y = 9; y < 21; y += 1) {
    flowDirection[y * width + 15] = 6
  }

  const flowAccumulation = new Float32Array(width * height).fill(1)
  for (let x = 2; x <= 16; x += 1) {
    flowAccumulation[8 * width + x] = 8
    flowAccumulation[22 * width + x] = 120
  }
  for (let y = 9; y <= 21; y += 1) {
    flowAccumulation[y * width + 15] = 12
  }

  const merged = mergeParallelRiverBranches({
    riverNetworkMask: mask,
    elevation,
    flowAccumulation,
    ocean,
    flowDirection,
    width,
    height,
    mergeStrength: 1.5,
  })

  for (let y = 9; y <= 21; y += 1) {
    assert.strictEqual(merged[y * width + 15], 1, `bridge cell y=${y} should remain`)
  }
  assert.strictEqual(merged[22 * width + 15], 1)
  assert.strictEqual(riverComponentCount(merged, width, height), 1)
  assert.strictEqual(riverComponentCount(mask, width, height), 1)
})

test('meanderAndSettleRivers merges parallel strands when merge strength is enabled', () => {
  const width = 32
  const height = 32
  const mask = new Uint8Array(width * height)
  for (let y = 10; y <= 13; y += 1) {
    for (let x = 4; x <= 26; x += 1) {
      mask[y * width + x] = 1
    }
  }

  const elevation = new Float32Array(width * height).fill(0.72)
  for (let x = 4; x <= 26; x += 1) {
    elevation[11 * width + x] = 0.62
    elevation[12 * width + x] = 0.63
    elevation[10 * width + x] = 0.66
    elevation[13 * width + x] = 0.67
  }

  const ocean = new Array(width * height).fill(false)
  for (let y = 0; y < height; y += 1) {
    for (let x = 27; x < width; x += 1) {
      ocean[y * width + x] = true
    }
  }

  const flowDirection = new Int16Array(width * height).fill(-1)
  for (let y = 10; y <= 13; y += 1) {
    for (let x = 4; x < 27; x += 1) {
      flowDirection[y * width + x] = 4
    }
  }

  const flowAccumulation = new Float32Array(width * height).fill(1)
  for (let x = 4; x <= 26; x += 1) {
    flowAccumulation[11 * width + x] = 120
    flowAccumulation[12 * width + x] = 95
    flowAccumulation[10 * width + x] = 18
    flowAccumulation[13 * width + x] = 14
  }

  const withoutMerge = meanderAndSettleRivers({
    riverNetworkMask: mask,
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 1,
    meanderStrength: 0,
    settlementStepCount: 0,
    mergeStrength: 0,
  })
  const withMerge = meanderAndSettleRivers({
    riverNetworkMask: mask,
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 1,
    meanderStrength: 0,
    settlementStepCount: 0,
    mergeStrength: 1.2,
  })

  assert.ok(countMarked(withMerge.riverNetworkMask) < countMarked(withoutMerge.riverNetworkMask))
  assert.strictEqual(
    riverComponentCount(withMerge.riverNetworkMask, width, height),
    riverComponentCount(mask, width, height),
  )
})

/**
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 */
function riverComponentCount(mask, width, height) {
  const labels = new Int32Array(mask.length).fill(-1)
  let count = 0
  for (let idx = 0; idx < mask.length; idx += 1) {
    if (!mask[idx] || labels[idx] >= 0) continue
    /** @type {number[]} */
    const stack = [idx]
    labels[idx] = count
    while (stack.length > 0) {
      const current = stack.pop()
      const x = current % width
      const y = Math.floor(current / width)
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const nIdx = ny * width + nx
          if (!mask[nIdx] || labels[nIdx] >= 0) continue
          labels[nIdx] = count
          stack.push(nIdx)
        }
      }
    }
    count += 1
  }
  return count
}

/**
 * @param {Uint8Array} mask
 */
function countMarked(mask) {
  let count = 0
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i]) count += 1
  }
  return count
}

/**
 * @param {Uint8Array} before
 * @param {Uint8Array} after
 */
function collectAddedCells(before, after) {
  /** @type {number[]} */
  const added = []
  for (let idx = 0; idx < after.length; idx += 1) {
    if (after[idx] && !before[idx]) added.push(idx)
  }
  return added
}

/**
 * @param {number[]} cells
 * @param {number} minX
 * @param {number} maxX
 * @param {number} y
 * @param {number} width
 */
function maxLateralDeviation(cells, minX, maxX, y, width) {
  let max = 0
  for (const idx of cells) {
    const x = idx % width
    const cy = Math.floor(idx / width)
    if (x < minX || x > maxX) continue
    max = Math.max(max, Math.abs(cy - y))
  }
  return max
}

/**
 * @param {Uint8Array} mask
 * @param {Float32Array} elevation
 */
function averageRiverElevation(mask, elevation) {
  let sum = 0
  let count = 0
  for (let idx = 0; idx < mask.length; idx += 1) {
    if (!mask[idx]) continue
    sum += elevation[idx]
    count += 1
  }
  return count > 0 ? sum / count : 0
}
