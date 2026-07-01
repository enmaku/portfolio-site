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

test('runFullDerivedGeographyPipeline includes arable raster on world document', () => {
  const doc = runFullDerivedGeographyPipeline(params)
  const cellCount = params.width * params.height

  assert.ok(doc.arableRaster)
  assert.strictEqual(doc.arableRaster.length, cellCount)

  for (let i = 0; i < doc.arableRaster.length; i += 1) {
    assert.ok(doc.arableRaster[i] >= 0 && doc.arableRaster[i] <= 1)
  }
})

test('runFullDerivedGeographyPipeline arable raster is deterministic for same seed', () => {
  const first = runFullDerivedGeographyPipeline(params)
  const second = runFullDerivedGeographyPipeline(params)

  assert.deepStrictEqual(first.arableRaster, second.arableRaster)
})

test('runFullDerivedGeographyPipeline arable is higher on river corridors than arid highlands', () => {
  const doc = runFullDerivedGeographyPipeline(diverseBiomeParams)
  const corridorMask = doc.riverCorridorMask ?? doc.riverNetworkMask
  assert.ok(corridorMask)

  const favorableBiomes = new Set([
    BIOMES.GRASSLAND,
    BIOMES.TEMPERATE_FOREST,
    BIOMES.RIVER_CORRIDOR,
  ])
  const unfavorableBiomes = new Set([BIOMES.MOUNTAIN, BIOMES.DESERT, BIOMES.GLACIER])

  let favorableSum = 0
  let favorableCount = 0
  let unfavorableSum = 0
  let unfavorableCount = 0

  for (let i = 0; i < doc.biomes.length; i += 1) {
    if (corridorMask[i] && favorableBiomes.has(doc.biomes[i])) {
      favorableSum += doc.arableRaster[i]
      favorableCount += 1
    } else if (unfavorableBiomes.has(doc.biomes[i])) {
      unfavorableSum += doc.arableRaster[i]
      unfavorableCount += 1
    }
  }

  assert.ok(favorableCount > 0)
  assert.ok(unfavorableCount > 0)
  assert.ok(favorableSum / favorableCount > unfavorableSum / unfavorableCount + 0.05)
})
