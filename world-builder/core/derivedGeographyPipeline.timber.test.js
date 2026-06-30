import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from './biomeIds.js'
import { runFullDerivedGeographyPipeline } from './derivedGeographyPipeline.js'
import { DEFAULT_GEOGRAPHY_SEED } from './worldGenerationOptions.js'

const params = {
  geographySeed: 12345,
  prevailingWindDegrees: 90,
  width: 64,
  height: 64,
}

const diverseBiomeParams = {
  geographySeed: DEFAULT_GEOGRAPHY_SEED,
  prevailingWindDegrees: 90,
  width: 256,
  height: 256,
}

test('runFullDerivedGeographyPipeline includes timber raster on world document', () => {
  const doc = runFullDerivedGeographyPipeline(params)
  const cellCount = params.width * params.height

  assert.ok(doc.timberRaster)
  assert.strictEqual(doc.timberRaster.length, cellCount)

  for (let i = 0; i < doc.timberRaster.length; i += 1) {
    assert.ok(doc.timberRaster[i] >= 0 && doc.timberRaster[i] <= 1)
  }
})

test('runFullDerivedGeographyPipeline timber raster is deterministic for same seed', () => {
  const first = runFullDerivedGeographyPipeline(params)
  const second = runFullDerivedGeographyPipeline(params)

  assert.deepStrictEqual(first.timberRaster, second.timberRaster)
})

test('runFullDerivedGeographyPipeline timber is higher in forest biomes than barren biomes', () => {
  const doc = runFullDerivedGeographyPipeline(diverseBiomeParams)
  const { biomes, timberRaster } = doc

  const forestBiomes = new Set([
    BIOMES.TEMPERATE_FOREST,
    BIOMES.TAIGA,
    BIOMES.TROPICAL_RAINFOREST,
  ])
  const barrenBiomes = new Set([BIOMES.TUNDRA, BIOMES.DESERT, BIOMES.GLACIER])

  let forestSum = 0
  let forestCount = 0
  let barrenSum = 0
  let barrenCount = 0

  for (let i = 0; i < biomes.length; i += 1) {
    if (forestBiomes.has(biomes[i])) {
      forestSum += timberRaster[i]
      forestCount += 1
    } else if (barrenBiomes.has(biomes[i])) {
      barrenSum += timberRaster[i]
      barrenCount += 1
    }
  }

  assert.ok(forestCount > 0)
  assert.ok(barrenCount > 0)
  assert.ok(forestSum / forestCount > barrenSum / barrenCount + 0.1)
})
