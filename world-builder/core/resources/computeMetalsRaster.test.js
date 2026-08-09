import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES, SEA_LEVEL } from '../biomeIds.js'
import { computeMetalsRaster } from './computeMetalsRaster.js'

const width = 5
const height = 5
const cellCount = width * height

function idx(x, y) {
  return y * width + x
}

function makeGrid({ biomes, elevation, drainage, riverNetworkMask }) {
  return {
    biomes: biomes ?? new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    elevation: elevation ?? new Float32Array(cellCount).fill(SEA_LEVEL + 0.2),
    drainage: drainage ?? new Float32Array(cellCount).fill(0),
    riverNetworkMask: riverNetworkMask ?? new Uint8Array(cellCount),
    width,
    height,
    seaLevel: SEA_LEVEL,
  }
}

test('computeMetalsRaster returns a grid-sized Float32Array with values in [0, 1]', () => {
  const raster = computeMetalsRaster(makeGrid({}))
  assert.strictEqual(raster.length, cellCount)
  for (const value of raster) {
    assert.ok(value >= 0 && value <= 1)
  }
})

test('computeMetalsRaster scores mountain and hills cells higher than grassland', () => {
  const biomes = new Uint8Array(cellCount).fill(BIOMES.GRASSLAND)
  biomes[idx(2, 2)] = BIOMES.MOUNTAIN
  biomes[idx(1, 2)] = BIOMES.HILLS

  const elevation = new Float32Array(cellCount).fill(SEA_LEVEL + 0.25)
  elevation[idx(2, 2)] = 0.82
  elevation[idx(1, 2)] = 0.68

  const raster = computeMetalsRaster(makeGrid({ biomes, elevation }))
  assert.ok(raster[idx(2, 2)] > raster[idx(0, 0)])
  assert.ok(raster[idx(1, 2)] > raster[idx(0, 0)])
})

test('computeMetalsRaster boosts upland river-headwater proxies', () => {
  const biomes = new Uint8Array(cellCount).fill(BIOMES.HILLS)
  const elevation = new Float32Array(cellCount).fill(0.72)
  const drainage = new Float32Array(cellCount).fill(0)
  drainage[idx(2, 2)] = 0.35
  const riverNetworkMask = new Uint8Array(cellCount)
  riverNetworkMask[idx(2, 2)] = 1

  const raster = computeMetalsRaster(
    makeGrid({ biomes, elevation, drainage, riverNetworkMask }),
  )
  assert.ok(raster[idx(2, 2)] > raster[idx(0, 0)])
})

test('computeMetalsRaster is deterministic for the same inputs', () => {
  const grid = makeGrid({
    biomes: new Uint8Array(cellCount).fill(BIOMES.MOUNTAIN),
    elevation: new Float32Array(cellCount).fill(0.8),
  })
  const first = computeMetalsRaster(grid)
  const second = computeMetalsRaster(grid)
  assert.deepStrictEqual(Array.from(first), Array.from(second))
})
