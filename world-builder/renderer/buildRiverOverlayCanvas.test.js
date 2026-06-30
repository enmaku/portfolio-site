import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../core/biomeIds.js'
import { assembleRiverNetwork } from '../core/hydrology/riverNetwork.js'
import { buildRiverOverlayRgba } from './buildRiverOverlayCanvas.js'
import { WATER_BODY_OUTLINE_RGBA } from './smoothRiverBiomeEdgesInRgba.js'

test('buildRiverOverlayRgba reads painted corridor from river-network contract', () => {
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

test('buildRiverOverlayRgba returns null without river-network contract', () => {
  const rgba = buildRiverOverlayRgba({
    gridWidth: 4,
    gridHeight: 4,
    biomes: new Uint8Array(16).fill(BIOMES.RIVER_CORRIDOR),
  })
  assert.equal(rgba, null)
})

test('buildRiverOverlayRgba returns null when contract corridor is empty', () => {
  const width = 5
  const height = 5
  const cellCount = width * height
  const centerline = new Uint8Array(cellCount)
  const corridor = new Uint8Array(cellCount)
  const flowDirection = new Int16Array(cellCount).fill(-1)
  const flowAccumulation = new Float32Array(cellCount).fill(0.1)
  const graph = { nodes: [], edges: [] }

  const rgba = buildRiverOverlayRgba({
    gridWidth: width,
    gridHeight: height,
    fields: {
      elevation: new Float32Array(cellCount),
      temperature: new Float32Array(cellCount),
      rainfall: new Float32Array(cellCount),
      drainage: flowAccumulation,
      salinity: new Float32Array(cellCount),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    riverNetworkMask: centerline,
    riverCorridorMask: corridor,
    flowDirection,
    riverGraph: graph,
  })
  assert.equal(rgba, null)
})

test('buildRiverOverlayRgba paints outline pixels beside contracted corridor', () => {
  const width = 5
  const height = 5
  const cellCount = width * height
  const centerline = new Uint8Array(cellCount)
  const corridor = new Uint8Array(cellCount)
  for (let y = 1; y <= 3; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      centerline[y * width + x] = 1
      corridor[y * width + x] = 1
    }
  }
  const flowDirection = new Int16Array(cellCount).fill(-1)
  const flowAccumulation = new Float32Array(cellCount).fill(0.5)
  const graph = { nodes: [], edges: [] }

  const rgba = buildRiverOverlayRgba({
    gridWidth: width,
    gridHeight: height,
    fields: {
      elevation: new Float32Array(cellCount),
      temperature: new Float32Array(cellCount),
      rainfall: new Float32Array(cellCount),
      drainage: flowAccumulation,
      salinity: new Float32Array(cellCount),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    riverNetworkMask: centerline,
    riverCorridorMask: corridor,
    flowDirection,
    riverGraph: graph,
  })
  assert.ok(rgba)

  const landOutlineOffset = 0 * 4
  assert.deepEqual(
    [
      rgba[landOutlineOffset],
      rgba[landOutlineOffset + 1],
      rgba[landOutlineOffset + 2],
      rgba[landOutlineOffset + 3],
    ],
    WATER_BODY_OUTLINE_RGBA,
  )

  const riverFillOffset = (2 * width + 2) * 4
  assert.ok(rgba[riverFillOffset + 3] > 200)
})

test('buildRiverOverlayRgba ignores biome-painted rivers without contract', () => {
  const width = 5
  const height = 5
  const biomes = new Uint8Array(width * height).fill(BIOMES.GRASSLAND)
  for (let y = 1; y <= 3; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      biomes[y * width + x] = BIOMES.RIVER_CORRIDOR
    }
  }
  const rgba = buildRiverOverlayRgba({
    gridWidth: width,
    gridHeight: height,
    biomes,
  })
  assert.equal(rgba, null)
})
