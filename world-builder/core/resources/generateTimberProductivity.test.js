import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { generateTimberProductivity } from './generateTimberProductivity.js'

/**
 * @param {Uint8Array} biomes
 * @param {number} biomeId
 */
function meanTimberForBiome(raster, biomes, biomeId) {
  let sum = 0
  let count = 0
  for (let i = 0; i < biomes.length; i += 1) {
    if (biomes[i] !== biomeId) continue
    sum += raster[i]
    count += 1
  }
  return count > 0 ? sum / count : 0
}

/**
 * @param {number} width
 * @param {number} height
 * @param {(index: number, x: number, y: number) => Partial<import('../types.js').ScalarFields> & { biome?: number }>} fill
 */
function buildFixture(width, height, fill) {
  const cellCount = width * height
  const fields = {
    elevation: new Float32Array(cellCount),
    temperature: new Float32Array(cellCount),
    rainfall: new Float32Array(cellCount).fill(0.5),
    drainage: new Float32Array(cellCount).fill(0.5),
    salinity: new Float32Array(cellCount).fill(0),
  }
  const biomes = new Uint8Array(cellCount)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      const sample = fill(index, x, y)
      if (sample.elevation !== undefined) fields.elevation[index] = sample.elevation
      if (sample.temperature !== undefined) fields.temperature[index] = sample.temperature
      biomes[index] = sample.biome ?? BIOMES.GRASSLAND
    }
  }

  return { fields, biomes, width, height }
}

test('generateTimberProductivity returns raster matching grid with values in [0, 1]', () => {
  const { fields, biomes, width, height } = buildFixture(8, 8, () => ({
    elevation: 0.55,
    temperature: 0.5,
    biome: BIOMES.TEMPERATE_FOREST,
  }))

  const raster = generateTimberProductivity({
    fields,
    biomes,
    width,
    height,
    geographySeed: 42,
  })

  assert.strictEqual(raster.length, width * height)
  for (let i = 0; i < raster.length; i += 1) {
    assert.ok(raster[i] >= 0 && raster[i] <= 1, `cell ${i} out of range: ${raster[i]}`)
  }
})

test('generateTimberProductivity is deterministic for fixed geography seed', () => {
  const { fields, biomes, width, height } = buildFixture(6, 6, (index) => ({
    elevation: 0.45 + (index % 6) * 0.02,
    temperature: 0.35 + (index % 4) * 0.05,
    biome: index % 3 === 0 ? BIOMES.TAIGA : BIOMES.TROPICAL_RAINFOREST,
  }))

  const params = { fields, biomes, width, height, geographySeed: 12345 }
  const first = generateTimberProductivity(params)
  const second = generateTimberProductivity(params)

  assert.deepStrictEqual(first, second)
})

test('generateTimberProductivity is higher on forest biomes than tundra glacier and desert', () => {
  const { fields, biomes, width, height } = buildFixture(5, 5, (_index, x) => ({
    elevation: 0.55,
    temperature: 0.5,
    biome:
      x === 0
        ? BIOMES.TEMPERATE_FOREST
        : x === 1
          ? BIOMES.TAIGA
          : x === 2
            ? BIOMES.TROPICAL_RAINFOREST
            : x === 3
              ? BIOMES.TUNDRA
              : BIOMES.DESERT,
  }))

  const raster = generateTimberProductivity({
    fields,
    biomes,
    width,
    height,
    geographySeed: 7,
  })

  const temperate = meanTimberForBiome(raster, biomes, BIOMES.TEMPERATE_FOREST)
  const taiga = meanTimberForBiome(raster, biomes, BIOMES.TAIGA)
  const rainforest = meanTimberForBiome(raster, biomes, BIOMES.TROPICAL_RAINFOREST)
  const tundra = meanTimberForBiome(raster, biomes, BIOMES.TUNDRA)
  const desert = meanTimberForBiome(raster, biomes, BIOMES.DESERT)
  const glacier = meanTimberForBiome(raster, biomes, BIOMES.GLACIER)

  const forestMean = (temperate + taiga + rainforest) / 3
  const barrenMean = (tundra + desert + glacier) / 3

  assert.ok(forestMean > barrenMean + 0.2)
  assert.ok(temperate > tundra)
  assert.ok(taiga > desert)
  assert.ok(rainforest > glacier)
})

test('generateTimberProductivity suppresses timber above treeline proxy elevation and temperature', () => {
  const width = 2
  const height = 1
  const { fields, biomes } = buildFixture(width, height, (index) => ({
    biome: BIOMES.TEMPERATE_FOREST,
    elevation: index === 0 ? 0.52 : 0.88,
    temperature: index === 0 ? 0.55 : 0.12,
  }))

  const raster = generateTimberProductivity({
    fields,
    biomes,
    width,
    height,
    geographySeed: 99,
  })

  assert.ok(raster[0] > raster[1] + 0.25)
  assert.ok(raster[1] < 0.35)
})
