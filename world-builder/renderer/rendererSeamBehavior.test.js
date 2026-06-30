import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../core/biomeIds.js'
import { buildDisplayBiomes } from '../core/buildDisplayBiomes.js'
import { assembleRiverNetwork } from '../core/hydrology/riverNetwork.js'
import { biomeColorForId } from './biomePalette.js'
import { biomeIndicesToRgba } from './biomeIndicesToRgba.js'
import { buildLandTerrainRgba } from './buildLandTerrainRgba.js'
import { buildRiverOverlayRgba } from './buildRiverOverlayCanvas.js'

test('terrain rasterization follows displayBiomes, not simulation river-corridor biomes', () => {
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

test('biomeIndicesToRgba tints from displayBiomes on the world document', () => {
  const gridWidth = 2
  const gridHeight = 1
  const biomes = new Uint8Array([BIOMES.RIVER_CORRIDOR, BIOMES.GRASSLAND])
  const displayBiomes = new Uint8Array([BIOMES.GRASSLAND, BIOMES.DESERT])
  const rgba = biomeIndicesToRgba({
    gridWidth,
    gridHeight,
    biomes,
    displayBiomes,
    fields: { elevation: new Float32Array(2) },
  })

  const grassColor = biomeColorForId(BIOMES.GRASSLAND)
  const desertColor = biomeColorForId(BIOMES.DESERT)

  assert.deepStrictEqual([rgba[0], rgba[1], rgba[2]], [grassColor[0], grassColor[1], grassColor[2]])
  assert.deepStrictEqual([rgba[4], rgba[5], rgba[6]], [desertColor[0], desertColor[1], desertColor[2]])
})

test('river overlay rasterizes painted corridor geometry from the river network contract', () => {
  const width = 8
  const height = 6
  const cellCount = width * height
  const centerline = new Uint8Array(cellCount)
  const corridor = new Uint8Array(cellCount)
  centerline[3 * width + 3] = 1
  corridor[3 * width + 2] = 1
  corridor[3 * width + 3] = 1
  corridor[3 * width + 4] = 1
  const flowDirection = new Int16Array(cellCount).fill(-1)
  const flowAccumulation = new Float32Array(cellCount).fill(0.1)
  const graph = { nodes: [], edges: [] }
  const network = assembleRiverNetwork({
    centerline,
    corridor,
    flowDirection,
    flowAccumulation,
    graph,
    width,
    height,
  })

  const rgba = buildRiverOverlayRgba({
    geographySeed: 1,
    prevailingWindDegrees: 0,
    gridWidth: width,
    gridHeight: height,
    fields: {
      elevation: new Float32Array(cellCount).fill(0.5),
      temperature: new Float32Array(cellCount),
      rainfall: new Float32Array(cellCount),
      drainage: flowAccumulation,
      salinity: new Float32Array(cellCount),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    biomeCatalog: [],
    generatedAt: '',
    pipelineStage: 'derivedGeography',
    riverNetworkMask: network.centerline,
    riverCorridorMask: network.corridor,
    flowDirection,
    riverGraph: graph,
  })

  assert.ok(rgba)
  assert.ok(rgba[(3 * width + 3) * 4 + 3] > 0)
  assert.equal(rgba[(0 * width + 0) * 4 + 3], 0)
})
