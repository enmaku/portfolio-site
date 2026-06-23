import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { computeFlowAccumulation } from './computeFlowAccumulation.js'
import {
  applyLiteStreamPower,
  clampStreamPowerOptions,
  MAX_INCISE_ITERATIONS,
} from './seededTemporaryRiverCarve.js'

/**
 * @param {number} width
 * @param {number} height
 */
function buildSyntheticTrunkDem(width, height) {
  const elevation = new Float32Array(width * height).fill(0.5)
  const corridorMask = new Uint8Array(width * height)
  for (let y = 2; y < height - 4; y += 1) {
    const idx = y * width + Math.floor(width / 2)
    elevation[idx] = 0.82 - (y - 2) * 0.028
    corridorMask[idx] = 1
  }
  for (let x = Math.floor(width / 2) - 2; x <= Math.floor(width / 2) + 2; x += 1) {
    elevation[2 * width + x] = 0.88
  }
  const ocean = Array.from({ length: width * height }, (_, idx) => {
    const y = Math.floor(idx / width)
    return y >= height - 3
  })
  const rainfall = new Float32Array(width * height).fill(0.55)
  const { flowDirection, flowAccumulation } = computeFlowAccumulation({
    elevation,
    width,
    height,
    seaLevel: SEA_LEVEL,
    rainfall,
  })
  return { elevation, corridorMask, ocean, flowDirection, flowAccumulation }
}

/**
 * @param {Float32Array} elevation
 * @param {number[]} path
 */
function meanPathGradient(elevation, path) {
  if (path.length < 2) return 0
  let totalDrop = 0
  for (let step = 0; step < path.length - 1; step += 1) {
    totalDrop += elevation[path[step]] - elevation[path[step + 1]]
  }
  return totalDrop / (path.length - 1)
}

test('clampStreamPowerOptions caps iteration count and coefficients', () => {
  const clamped = clampStreamPowerOptions({
    inciseIterations: 99,
    streamPowerK: 1,
    streamPowerM: 0.05,
    streamPowerN: 5,
    channelInitiationThreshold: -1,
  })

  assert.strictEqual(clamped.inciseIterations, MAX_INCISE_ITERATIONS)
  assert.ok(clamped.streamPowerK <= 0.008)
  assert.ok(clamped.streamPowerM >= 0.2)
  assert.ok(clamped.streamPowerN <= 2)
  assert.strictEqual(clamped.channelInitiationThreshold, 0)
})

test('applyLiteStreamPower erodes initiating channel cells deterministically', () => {
  const width = 16
  const height = 16
  const { elevation, corridorMask, ocean, flowDirection, flowAccumulation } = buildSyntheticTrunkDem(width, height)
  const before = new Float32Array(elevation)
  const options = clampStreamPowerOptions({
    inciseIterations: 4,
    streamPowerK: 0.003,
    streamPowerM: 0.45,
    streamPowerN: 1.1,
    channelInitiationThreshold: 0.012,
  })

  const first = applyLiteStreamPower({
    elevation,
    corridorMask,
    ocean,
    flowAccumulation,
    flowDirection,
    width,
    height,
    seaLevel: SEA_LEVEL,
    geographySeed: 4242,
    ...options,
  })
  const second = applyLiteStreamPower({
    elevation: new Float32Array(before),
    corridorMask,
    ocean,
    flowAccumulation,
    flowDirection,
    width,
    height,
    seaLevel: SEA_LEVEL,
    geographySeed: 4242,
    ...options,
  })

  assert.deepStrictEqual(first, second)

  let eroded = 0
  for (let idx = 0; idx < before.length; idx += 1) {
    if (corridorMask[idx] && first[idx] < before[idx] - 1e-6) {
      eroded += 1
    }
  }
  assert.ok(eroded >= 1, 'expected stream-power erosion on corridor cells')
})

test('applyLiteStreamPower deposits on low-slope downstream corridor reaches', () => {
  const width = 20
  const height = 20
  const centerX = Math.floor(width / 2)
  const elevation = new Float32Array(width * height).fill(0.5)
  const corridorMask = new Uint8Array(width * height)
  for (let y = 2; y < height - 4; y += 1) {
    const idx = y * width + centerX
    elevation[idx] = y < 10 ? 0.78 - (y - 2) * 0.03 : 0.54 - (y - 10) * 0.004
    corridorMask[idx] = 1
    for (let x = 0; x < width; x += 1) {
      if (x === centerX) continue
      elevation[y * width + x] = elevation[idx] + 0.03
    }
  }
  const ocean = Array.from({ length: width * height }, (_, idx) => {
    const y = Math.floor(idx / width)
    return y >= height - 3
  })
  const rainfall = new Float32Array(width * height).fill(0.55)
  const { flowDirection, flowAccumulation } = computeFlowAccumulation({
    elevation,
    width,
    height,
    seaLevel: SEA_LEVEL,
    rainfall,
  })
  const before = new Float32Array(elevation)

  const result = applyLiteStreamPower({
    elevation,
    corridorMask,
    ocean,
    flowAccumulation,
    flowDirection,
    width,
    height,
    seaLevel: SEA_LEVEL,
    geographySeed: 9001,
    ...clampStreamPowerOptions({
      inciseIterations: 5,
      streamPowerK: 0.003,
      streamPowerM: 0.45,
      streamPowerN: 1.1,
      channelInitiationThreshold: 0.012,
    }),
  })

  let deposited = 0
  for (let y = 10; y < height - 5; y += 1) {
    const idx = y * width + centerX
    if (result[idx] > before[idx] + 1e-6) {
      deposited += 1
    }
  }
  assert.ok(deposited >= 1, 'expected floodplain deposition on gentle downstream reaches')
})

test('applyLiteStreamPower lowers mean trunk gradient vs pre-iteration', () => {
  const width = 24
  const height = 24
  const { elevation, corridorMask, ocean, flowDirection, flowAccumulation } = buildSyntheticTrunkDem(width, height)
  const trunkPath = []
  for (let y = 2; y < height - 4; y += 1) {
    trunkPath.push(y * width + Math.floor(width / 2))
  }
  const beforeGradient = meanPathGradient(elevation, trunkPath)

  const result = applyLiteStreamPower({
    elevation: new Float32Array(elevation),
    corridorMask,
    ocean,
    flowAccumulation,
    flowDirection,
    width,
    height,
    seaLevel: SEA_LEVEL,
    geographySeed: 1337,
    ...clampStreamPowerOptions({
      inciseIterations: 6,
      streamPowerK: 0.003,
      streamPowerM: 0.45,
      streamPowerN: 1.1,
      channelInitiationThreshold: 0.01,
    }),
  })

  const afterGradient = meanPathGradient(result, trunkPath)
  assert.ok(
    afterGradient < beforeGradient - 1e-5,
    `expected gentler trunk gradient (${afterGradient} vs ${beforeGradient})`,
  )
})

test('applyLiteStreamPower reports fractional progress across iterations', () => {
  const width = 12
  const height = 12
  const { elevation, corridorMask, ocean, flowDirection, flowAccumulation } = buildSyntheticTrunkDem(width, height)
  /** @type {number[]} */
  const progressSamples = []

  applyLiteStreamPower({
    elevation,
    corridorMask,
    ocean,
    flowAccumulation,
    flowDirection,
    width,
    height,
    seaLevel: SEA_LEVEL,
    geographySeed: 7,
    ...clampStreamPowerOptions({
      inciseIterations: 4,
      streamPowerK: 0.002,
      streamPowerM: 0.45,
      streamPowerN: 1.1,
      channelInitiationThreshold: 0.012,
    }),
    onProgress(progress) {
      progressSamples.push(progress)
    },
  })

  assert.ok(progressSamples.length >= 2)
  assert.strictEqual(progressSamples[0], 0)
  assert.strictEqual(progressSamples[progressSamples.length - 1], 1)
  assert.ok(progressSamples.some((value) => value > 0 && value < 1))
})
