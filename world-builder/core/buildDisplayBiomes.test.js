import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from './biomeIds.js'
import { classifyBiomeFromSample } from './classifyBiomesFromFields.js'
import { buildDisplayBiomes } from './buildDisplayBiomes.js'
import { generateDerivedGeography } from './generateDerivedGeography.js'
import { DEFAULT_GEOGRAPHY_SEED } from '../worldBuilderPageModel.js'

test('buildDisplayBiomes replaces river corridor with underlying land biome', () => {
  const sample = {
    elevation: 0.5,
    temperature: 0.5,
    rainfall: 0.5,
    drainage: 0.1,
    salinity: 0.1,
  }
  const fields = {
    elevation: new Float32Array([sample.elevation, sample.elevation, sample.elevation]),
    temperature: new Float32Array([sample.temperature, sample.temperature, sample.temperature]),
    rainfall: new Float32Array([sample.rainfall, sample.rainfall, sample.rainfall]),
    drainage: new Float32Array([sample.drainage, sample.drainage, sample.drainage]),
    salinity: new Float32Array([sample.salinity, sample.salinity, sample.salinity]),
  }
  const biomes = new Uint8Array([BIOMES.GRASSLAND, BIOMES.RIVER_CORRIDOR, BIOMES.DESERT])

  const displayBiomes = buildDisplayBiomes(biomes, fields)

  assert.strictEqual(displayBiomes[0], BIOMES.GRASSLAND)
  assert.strictEqual(displayBiomes[1], classifyBiomeFromSample(sample))
  assert.strictEqual(displayBiomes[2], BIOMES.DESERT)
})

test('buildDisplayBiomes leaves non-river simulation biomes unchanged', () => {
  const fields = {
    elevation: new Float32Array([0.2, 0.9]),
    temperature: new Float32Array([0.5, 0.1]),
    rainfall: new Float32Array([0.5, 0.1]),
    drainage: new Float32Array([0.5, 0.5]),
    salinity: new Float32Array([0.1, 0.1]),
  }
  const biomes = new Uint8Array([BIOMES.OCEAN, BIOMES.MOUNTAIN])

  const displayBiomes = buildDisplayBiomes(biomes, fields)

  assert.deepStrictEqual(displayBiomes, biomes)
})

test('generateDerivedGeography includes displayBiomes with no river corridor indices', () => {
  const doc = generateDerivedGeography({
    geographySeed: DEFAULT_GEOGRAPHY_SEED,
    prevailingWindDegrees: 90,
    width: 64,
    height: 64,
  })

  assert.ok(doc.displayBiomes)
  assert.strictEqual(doc.displayBiomes.length, doc.biomes.length)

  for (let i = 0; i < doc.biomes.length; i += 1) {
    if (doc.biomes[i] === BIOMES.RIVER_CORRIDOR) {
      assert.notStrictEqual(doc.displayBiomes[i], BIOMES.RIVER_CORRIDOR)
    } else {
      assert.strictEqual(doc.displayBiomes[i], doc.biomes[i])
    }
  }
})
