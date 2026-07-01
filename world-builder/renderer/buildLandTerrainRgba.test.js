import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../core/biomeIds.js'
import { buildDisplayBiomes } from '../core/buildDisplayBiomes.js'
import { generateDerivedGeography } from '../core/generateDerivedGeography.js'
import { DEFAULT_GEOGRAPHY_SEED } from '../core/worldGenerationOptions.js'
import { biomeColorForId } from './biomePalette.js'
import { buildLandTerrainRgba } from './buildLandTerrainRgba.js'

/**
 * @param {Uint8ClampedArray} rgba
 * @returns {string}
 */
function fnv1aRgbaHash(rgba) {
  let hash = 2166136261
  for (let i = 0; i < rgba.length; i += 1) {
    hash = Math.imul(hash ^ rgba[i], 16777619)
  }
  return (hash >>> 0).toString(16)
}

test('buildLandTerrainRgba uses display biomes without reclassifying river cells', () => {
  const width = 3
  const height = 1
  const biomes = new Uint8Array([BIOMES.GRASSLAND, BIOMES.RIVER_CORRIDOR, BIOMES.GRASSLAND])
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
  const displayBiomes = buildDisplayBiomes(biomes, fields)

  const rgba = buildLandTerrainRgba({
    gridWidth: width,
    gridHeight: height,
    biomes,
    displayBiomes,
    fields,
  })

  const riverColor = biomeColorForId(BIOMES.RIVER_CORRIDOR)
  const landColor = biomeColorForId(displayBiomes[1])
  const riverOffset = 1 * 4

  assert.notDeepStrictEqual(
    [rgba[riverOffset], rgba[riverOffset + 1], rgba[riverOffset + 2]],
    [riverColor[0], riverColor[1], riverColor[2]],
  )
  assert.deepStrictEqual(
    [rgba[riverOffset], rgba[riverOffset + 1], rgba[riverOffset + 2]],
    [landColor[0], landColor[1], landColor[2]],
  )
})

test('buildLandTerrainRgba matches default-seed river-corridor land tint', () => {
  const doc = generateDerivedGeography({
    geographySeed: DEFAULT_GEOGRAPHY_SEED,
    prevailingWindDegrees: 90,
    width: 64,
    height: 64,
  })

  const rgba = buildLandTerrainRgba(doc)
  assert.strictEqual(fnv1aRgbaHash(rgba), 'e0760345')
})
