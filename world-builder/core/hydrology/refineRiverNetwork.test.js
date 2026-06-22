import assert from 'node:assert/strict'
import test from 'node:test'
import { computeFlowAccumulation } from './computeFlowAccumulation.js'
import {
  branchKeepRatioForMergeStrength,
  refineRiverNetworkFromSketch,
} from './refineRiverNetwork.js'

test('refineRiverNetworkFromSketch is a no-op mask when sketch is empty', () => {
  const width = 8
  const height = 8
  const sketchMask = new Uint8Array(width * height)
  const elevation = new Float32Array(width * height).fill(0.7)
  const ocean = new Array(width * height).fill(false)
  const flowDirection = new Int16Array(width * height).fill(-1)
  const flowAccumulation = new Float32Array(width * height).fill(1)

  const result = refineRiverNetworkFromSketch({
    sketchMask,
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 1,
    meanderStrength: 0,
    settlementStepCount: 0,
    mergeStrength: 1,
  })

  assert.strictEqual(countMarked(result.riverNetworkMask), 0)
  assert.ok(result.elevation instanceof Float32Array)
})

test('refineRiverNetworkFromSketch collapses parallel sketch strands into one corridor', () => {
  const width = 32
  const height = 32
  const sketchMask = new Uint8Array(width * height)
  for (let y = 10; y <= 13; y += 1) {
    for (let x = 4; x <= 26; x += 1) {
      sketchMask[y * width + x] = 1
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

  const refined = refineRiverNetworkFromSketch({
    sketchMask,
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 42,
    meanderStrength: 0,
    settlementStepCount: 0,
    mergeStrength: 1.2,
  })

  assert.ok(countMarked(refined.riverNetworkMask) < countMarked(sketchMask))
  assert.ok(crossSectionThickness(refined.riverNetworkMask, width, height, 15) <= 2)
  assert.strictEqual(riverComponentCount(refined.riverNetworkMask, width, height), 1)
})

test('refineRiverNetworkFromSketch adds lateral deviation when meandering is enabled', () => {
  const width = 48
  const height = 48
  const sketchMask = new Uint8Array(width * height)
  for (let x = 8; x <= 38; x += 1) {
    sketchMask[24 * width + x] = 1
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

  const straight = refineRiverNetworkFromSketch({
    sketchMask,
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 4242,
    meanderStrength: 0,
    settlementStepCount: 0,
    mergeStrength: 1,
  })
  const meandered = refineRiverNetworkFromSketch({
    sketchMask,
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 4242,
    meanderStrength: 1.2,
    settlementStepCount: 0,
    mergeStrength: 1,
  })

  const straightDeviation = maxLateralDeviation(
    collectRiverCells(straight.riverNetworkMask),
    8,
    38,
    24,
    width,
  )
  const meanderDeviation = maxLateralDeviation(
    collectRiverCells(meandered.riverNetworkMask),
    8,
    38,
    24,
    width,
  )
  assert.ok(meanderDeviation >= straightDeviation + 1)
})

test('refineRiverNetworkFromSketch carves river cells lower during settlement', () => {
  const width = 16
  const height = 16
  const sketchMask = new Uint8Array(width * height)
  for (let x = 2; x <= 12; x += 1) {
    sketchMask[8 * width + x] = 1
  }
  const elevation = new Float32Array(width * height).fill(0.68)
  for (let x = 2; x <= 12; x += 1) {
    elevation[8 * width + x] = 0.68 - (x - 2) * 0.004
  }
  const ocean = new Array(width * height).fill(false)
  const flowDirection = new Int16Array(width * height).fill(-1)
  for (let x = 2; x < 12; x += 1) {
    flowDirection[8 * width + x] = 4
  }
  const flowAccumulation = new Float32Array(width * height).fill(32)

  const before = averageRiverElevation(sketchMask, elevation)
  const result = refineRiverNetworkFromSketch({
    sketchMask,
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 9001,
    meanderStrength: 0,
    settlementStepCount: 6,
    mergeStrength: 1,
    channelWear: 0.006,
  })
  const after = averageRiverElevation(result.riverNetworkMask, result.elevation)

  assert.ok(after < before, `expected carved channel, before=${before}, after=${after}`)
})

test('branchKeepRatioForMergeStrength lowers branch retention as merge strength rises', () => {
  assert.ok(branchKeepRatioForMergeStrength(2) < branchKeepRatioForMergeStrength(0.5))
})

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
 * @param {number} width
 * @param {number} height
 * @param {number} sampleX
 */
function crossSectionThickness(mask, width, height, sampleX) {
  let maxThickness = 0
  for (let x = sampleX - 1; x <= sampleX + 1; x += 1) {
    if (x < 0 || x >= width) continue
    let thickness = 0
    for (let y = 0; y < height; y += 1) {
      if (mask[y * width + x]) thickness += 1
    }
    maxThickness = Math.max(maxThickness, thickness)
  }
  return maxThickness
}

/**
 * @param {Uint8Array} mask
 */
function collectRiverCells(mask) {
  /** @type {number[]} */
  const cells = []
  for (let idx = 0; idx < mask.length; idx += 1) {
    if (mask[idx]) cells.push(idx)
  }
  return cells
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
