import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../core/biomeIds.js'
import { classifyBiomeFromSample } from '../core/classifyBiomesFromFields.js'
import { biomeColorForId } from './biomePalette.js'
import { buildLandTerrainRgba } from './buildLandTerrainRgba.js'

test('buildLandTerrainRgba paints river cells as underlying land biome', () => {
  const width = 3
  const height = 1
  const biomes = new Uint8Array([BIOMES.GRASSLAND, BIOMES.RIVER_CORRIDOR, BIOMES.GRASSLAND])
  const sample = {
    elevation: 0.5,
    temperature: 0.5,
    rainfall: 0.5,
    drainage: 0.1,
    salidity: 0.1,
  }
  const fields = {
    elevation: new Float32Array([sample.elevation, sample.elevation, sample.elevation]),
    temperature: new Float32Array([sample.temperature, sample.temperature, sample.temperature]),
    rainfall: new Float32Array([sample.rainfall, sample.rainfall, sample.rainfall]),
    drainage: new Float32Array([sample.drainage, sample.drainage, sample.drainage]),
    salidity: new Float32Array([sample.salidity, sample.salidity, sample.salidity]),
  }

  const rgba = buildLandTerrainRgba({
    gridWidth: width,
    gridHeight: height,
    biomes,
    fields,
  })

  const riverColor = biomeColorForId(BIOMES.RIVER_CORRIDOR)
  const landColor = biomeColorForId(classifyBiomeFromSample(sample))
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
