import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { computeFlowAccumulation } from './computeFlowAccumulation.js'
import {
  carveTemporaryRivers,
  routeDownslopePath,
  selectTemporaryRiverSources,
} from './seededTemporaryRiverCarve.js'

test('selectTemporaryRiverSources picks high slope×area cells deterministically', () => {
  const width = 24
  const height = 24
  const elevation = new Float32Array(width * height).fill(0.55)
  for (let y = 0; y < 8; y += 1) {
    for (let x = 8; x < 16; x += 1) {
      elevation[y * width + x] = 0.82 - y * 0.04
    }
  }
  const rainfall = new Float32Array(width * height).fill(0.5)
  const { flowAccumulation, ocean, flowDirection } = computeFlowAccumulation({
    elevation,
    width,
    height,
    seaLevel: SEA_LEVEL,
    rainfall,
  })

  const first = selectTemporaryRiverSources({
    elevation,
    ocean,
    flowAccumulation,
    flowDirection,
    width,
    height,
    geographySeed: 4242,
    seaLevel: SEA_LEVEL,
  })
  const second = selectTemporaryRiverSources({
    elevation,
    ocean,
    flowAccumulation,
    flowDirection,
    width,
    height,
    geographySeed: 4242,
    seaLevel: SEA_LEVEL,
  })

  assert.deepStrictEqual(first, second)
  assert.ok(first.length >= 1)
  for (const idx of first) {
    assert.ok(!ocean[idx])
    assert.ok(elevation[idx] > SEA_LEVEL)
  }
})

test('routeDownslopePath follows steepest descent on filled DEM', () => {
  const width = 12
  const height = 12
  const elevation = new Float32Array(width * height).fill(0.5)
  for (let y = 2; y < 10; y += 1) {
    elevation[y * width + 6] = 0.9 - (y - 2) * 0.05
  }
  const ocean = Array.from({ length: width * height }, (_, idx) => {
    const y = Math.floor(idx / width)
    return y >= 10
  })
  const rainfall = new Float32Array(width * height).fill(0.5)
  const { flowDirection } = computeFlowAccumulation({
    elevation,
    width,
    height,
    seaLevel: SEA_LEVEL,
    rainfall,
  })

  const sourceIdx = 2 * width + 6
  const path = routeDownslopePath({
    sourceIdx,
    elevation,
    ocean,
    flowDirection,
    width,
    height,
  })

  assert.ok(path.length >= 2)
  assert.strictEqual(path[0], sourceIdx)
  for (let step = 0; step < path.length - 1; step += 1) {
    assert.ok(elevation[path[step]] >= elevation[path[step + 1]] - 1e-5)
  }
  const last = path[path.length - 1]
  assert.ok(ocean[last] || elevation[last] <= elevation[path[path.length - 2]] + 1e-5)
})

test('carveTemporaryRivers lowers corridor cells below pre-carve neighbors along path', () => {
  const width = 20
  const height = 20
  const elevation = new Float32Array(width * height).fill(0.52)
  for (let y = 2; y < 14; y += 1) {
    elevation[y * width + 10] = 0.86 - (y - 2) * 0.035
  }
  for (let x = 8; x <= 12; x += 1) {
    elevation[2 * width + x] = 0.88
  }
  const ocean = Array.from({ length: width * height }, (_, idx) => {
    const y = Math.floor(idx / width)
    return y >= 15
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

  const { elevation: carved, paths, corridorMask } = carveTemporaryRivers({
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 9001,
    seaLevel: SEA_LEVEL,
    incisionDepth: 0.012,
  })

  assert.ok(paths.length >= 1)
  assert.ok(corridorMask.some((value) => value === 1))

  for (const path of paths) {
    for (let step = 0; step < path.length; step += 1) {
      const idx = path[step]
      assert.ok(carved[idx] < before[idx] - 1e-5, `path cell ${idx} should be incised`)
      if (step > 0) {
        const upstream = path[step - 1]
        assert.ok(
          carved[idx] < before[upstream] - 1e-5,
          `path cell ${idx} should sit below upstream neighbor ${upstream}`,
        )
      }
    }
  }
})

test('carveTemporaryRivers reports fractional progress', () => {
  const width = 32
  const height = 32
  const elevation = new Float32Array(width * height).fill(0.5)
  for (let y = 0; y < 12; y += 1) {
    for (let x = 12; x < 20; x += 1) {
      elevation[y * width + x] = 0.84 - y * 0.03
    }
  }
  const rainfall = new Float32Array(width * height).fill(0.5)
  const { flowDirection, flowAccumulation, ocean } = computeFlowAccumulation({
    elevation,
    width,
    height,
    seaLevel: SEA_LEVEL,
    rainfall,
  })

  /** @type {number[]} */
  const progressSamples = []
  carveTemporaryRivers({
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 77,
    seaLevel: SEA_LEVEL,
    incisionDepth: 0.01,
    onProgress(progress) {
      progressSamples.push(progress)
    },
  })

  assert.ok(progressSamples.length >= 2)
  assert.strictEqual(progressSamples[0], 0)
  assert.strictEqual(progressSamples[progressSamples.length - 1], 1)
  for (const sample of progressSamples) {
    assert.ok(sample >= 0 && sample <= 1)
  }
})

test('carveTemporaryRivers applies stream-power after corridor carve', () => {
  const width = 20
  const height = 20
  const elevation = new Float32Array(width * height).fill(0.52)
  for (let y = 2; y < 14; y += 1) {
    elevation[y * width + 10] = 0.86 - (y - 2) * 0.035
  }
  for (let x = 8; x <= 12; x += 1) {
    elevation[2 * width + x] = 0.88
  }
  const ocean = Array.from({ length: width * height }, (_, idx) => {
    const y = Math.floor(idx / width)
    return y >= 15
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

  const withStreamPower = carveTemporaryRivers({
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 9001,
    seaLevel: SEA_LEVEL,
    incisionDepth: 0.012,
    inciseIterations: 5,
    streamPowerK: 0.003,
  })
  const withoutStreamPower = carveTemporaryRivers({
    elevation: before,
    ocean,
    flowDirection,
    flowAccumulation,
    width,
    height,
    geographySeed: 9001,
    seaLevel: SEA_LEVEL,
    incisionDepth: 0.012,
    inciseIterations: 0,
  })

  let differs = false
  for (let idx = 0; idx < before.length; idx += 1) {
    if (Math.abs(withStreamPower.elevation[idx] - withoutStreamPower.elevation[idx]) > 1e-6) {
      differs = true
      break
    }
  }
  assert.ok(differs, 'expected stream-power iterations to change carved elevation')
})
