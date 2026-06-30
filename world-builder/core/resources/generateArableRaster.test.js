import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES, SEA_LEVEL } from '../biomeIds.js'
import { generatePhysicalTerrainBaseline } from '../generatePhysicalTerrainBaseline.js'
import { generateTemperature } from '../fields/generateTemperature.js'
import { DEFAULT_GEOGRAPHY_SEED } from '../../worldBuilderPageModel.js'
import { generateArableRaster } from './generateArableRaster.js'

const REPRESENTATIVE_GEOGRAPHY_SEEDS = [12345, 31842, DEFAULT_GEOGRAPHY_SEED]

function rasterChecksum(arr, stride = 97) {
  let checksum = 0
  for (let i = 0; i < arr.length; i += stride) {
    checksum = (checksum + Math.round(arr[i] * 1e6) * (i + 1)) % 2147483647
  }
  return checksum
}

const ARABLE_GOLDEN_CHECKSUMS = new Map([
  [12345, 1973926258],
  [31842, 2055437175],
  [DEFAULT_GEOGRAPHY_SEED, 330469910],
])

/**
 * @param {number} width
 * @param {number} height
 * @param {(x: number, y: number, idx: number) => Partial<{
 *   elevation: number,
 *   temperature: number,
 *   rainfall: number,
 *   drainage: number,
 *   biome: number,
 *   river: number,
 * }>} fill
 */
function buildFixture(width, height, fill) {
  const cellCount = width * height
  const elevation = new Float32Array(cellCount)
  const temperature = new Float32Array(cellCount)
  const rainfall = new Float32Array(cellCount)
  const drainage = new Float32Array(cellCount)
  const biomes = new Uint8Array(cellCount)
  const riverCorridorMask = new Uint8Array(cellCount)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      const sample = fill(x, y, idx)
      elevation[idx] = sample.elevation ?? 0.55
      temperature[idx] = sample.temperature ?? 0.5
      rainfall[idx] = sample.rainfall ?? 0.5
      drainage[idx] = sample.drainage ?? 0.5
      biomes[idx] = sample.biome ?? BIOMES.GRASSLAND
      riverCorridorMask[idx] = sample.river ?? 0
    }
  }

  return {
    elevation,
    temperature,
    rainfall,
    drainage,
    biomes,
    riverCorridorMask,
    width,
    height,
    geographySeed: 4242,
    seaLevel: SEA_LEVEL,
  }
}

function meanArable(raster, indices) {
  let sum = 0
  for (const idx of indices) {
    sum += raster[idx]
  }
  return sum / indices.length
}

test('generateArableRaster returns grid-sized values in [0, 1]', () => {
  const width = 8
  const height = 6
  const fixture = buildFixture(width, height, () => ({}))
  const raster = generateArableRaster(fixture)

  assert.strictEqual(raster.length, width * height)
  for (let i = 0; i < raster.length; i += 1) {
    assert.ok(raster[i] >= 0 && raster[i] <= 1, `cell ${i} out of range: ${raster[i]}`)
  }
})

test('generateArableRaster is deterministic for same geography seed', () => {
  const fixture = buildFixture(12, 12, (x, y) => ({
    biome: y < 6 ? BIOMES.TEMPERATE_FOREST : BIOMES.DESERT,
    rainfall: y < 6 ? 0.75 : 0.1,
    river: x === 6 ? 1 : 0,
  }))
  const first = generateArableRaster(fixture)
  const second = generateArableRaster(fixture)
  assert.deepStrictEqual(first, second)
})

test('generateArableRaster favors temperate wet river-adjacent cells over mountain desert', () => {
  const width = 11
  const height = 11
  const centerY = 5
  const riverX = 5
  const fixture = buildFixture(width, height, (x, y) => {
    if (y === centerY && x >= 2 && x <= 8) {
      return {
        elevation: 0.5,
        temperature: 0.52,
        rainfall: 0.8,
        drainage: 0.45,
        biome: x === riverX ? BIOMES.RIVER_CORRIDOR : BIOMES.TEMPERATE_FOREST,
        river: x === riverX ? 1 : 0,
      }
    }
    return {
      elevation: 0.82,
      temperature: 0.62,
      rainfall: 0.08,
      drainage: 0.7,
      biome: BIOMES.MOUNTAIN,
      river: 0,
    }
  })

  const raster = generateArableRaster(fixture)
  const riverBandIndices = []
  const mountainIndices = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (y === centerY && x >= 2 && x <= 8) {
        riverBandIndices.push(idx)
      } else {
        mountainIndices.push(idx)
      }
    }
  }

  assert.ok(
    meanArable(raster, riverBandIndices) > meanArable(raster, mountainIndices) + 0.15,
    `river band mean ${meanArable(raster, riverBandIndices)} should exceed mountain mean ${meanArable(raster, mountainIndices)}`,
  )
})

test('generateArableRaster zeros ocean cells', () => {
  const fixture = buildFixture(4, 4, () => ({
    elevation: 0.2,
    biome: BIOMES.OCEAN,
  }))
  const raster = generateArableRaster(fixture)
  assert.ok(raster.every((value) => value === 0))
})

test('generateArableRaster boosts trunk channel cells over tributary-only neighbors', () => {
  const width = 5
  const height = 5
  const centerY = 2
  const trunkX = 2
  const tributaryX = 0
  const channelWidth = new Float32Array(width * height)
  const riverCorridorMask = new Uint8Array(width * height)
  channelWidth[centerY * width + trunkX] = 10
  channelWidth[centerY * width + tributaryX] = 2
  riverCorridorMask[centerY * width + trunkX] = 1
  riverCorridorMask[centerY * width + tributaryX] = 1

  const fixture = buildFixture(width, height, (x, y) => ({
    elevation: 0.55,
    temperature: 0.45,
    rainfall: 0.35,
    drainage: y === centerY ? 0.8 : 0.5,
    biome: BIOMES.HILLS,
    river: x === trunkX || x === tributaryX ? 1 : 0,
  }))
  fixture.riverCorridorMask = riverCorridorMask
  fixture.channelWidth = channelWidth
  fixture.riverNetworkMask = riverCorridorMask

  const raster = generateArableRaster(fixture)
  const trunkIdx = centerY * width + trunkX
  const tributaryIdx = centerY * width + tributaryX

  assert.ok(
    raster[trunkIdx] > raster[tributaryIdx],
    `trunk ${raster[trunkIdx]} should exceed tributary ${raster[tributaryIdx]}`,
  )
})

test('generateArableRaster preserves golden checksums for representative seeds', () => {
  for (const geographySeed of REPRESENTATIVE_GEOGRAPHY_SEEDS) {
    const width = 64
    const height = 64
    const doc = generatePhysicalTerrainBaseline({
      geographySeed,
      prevailingWindDegrees: 90,
      width,
      height,
    })
    const temperature = generateTemperature({
      geographySeed,
      width,
      height,
      elevation: doc.fields.elevation,
    })
    const raster = generateArableRaster({
      elevation: doc.fields.elevation,
      temperature,
      rainfall: doc.fields.rainfall,
      drainage: doc.fields.drainage,
      biomes: doc.biomes,
      riverCorridorMask: null,
      riverNetworkMask: null,
      channelWidth: null,
      width,
      height,
      geographySeed,
      seaLevel: SEA_LEVEL,
    })
    assert.strictEqual(
      rasterChecksum(raster),
      ARABLE_GOLDEN_CHECKSUMS.get(geographySeed),
      `arable checksum drift for seed ${geographySeed}`,
    )
  }
})
