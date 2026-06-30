import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../core/biomeIds.js'
import { assembleRiverNetwork } from '../core/hydrology/riverNetwork.js'
import { biomeColorForId } from './biomePalette.js'
import { biomeIndicesToRgba } from './biomeIndicesToRgba.js'
import { buildLandTerrainRgba } from './buildLandTerrainRgba.js'
import { buildRiverOverlayRgba } from './buildRiverOverlayCanvas.js'

/**
 * Renderer seam (ADR-0009): generators/editors classify biomes into the world document;
 * the renderer is a pure view that tints terrain from the palette-ready `displayBiomes`
 * field and draws hydrology from presentation masks. These behavioral checks prove the
 * renderer reads those seams without re-deriving biome classification or smoothing river
 * edges into the terrain raster.
 */

/**
 * @param {Uint8ClampedArray} rgba
 * @param {number} cellIndex
 * @returns {[number, number, number, number]}
 */
function rgbaAt(rgba, cellIndex) {
  const offset = cellIndex * 4
  return [rgba[offset], rgba[offset + 1], rgba[offset + 2], rgba[offset + 3]]
}

test('terrain tint reads displayBiomes, not the simulation biome classification', () => {
  const displayBiomes = new Uint8Array([BIOMES.DESERT, BIOMES.MOUNTAIN])
  const doc = {
    gridWidth: 2,
    gridHeight: 1,
    biomes: new Uint8Array([BIOMES.GRASSLAND, BIOMES.GRASSLAND]),
    displayBiomes,
    fields: { elevation: new Float32Array(2) },
  }

  const rgba = buildLandTerrainRgba(doc)

  assert.deepStrictEqual(rgbaAt(rgba, 0), biomeColorForId(BIOMES.DESERT))
  assert.deepStrictEqual(rgbaAt(rgba, 1), biomeColorForId(BIOMES.MOUNTAIN))
})

test('terrain tint is invariant to simulation biomes when displayBiomes is unchanged', () => {
  const displayBiomes = new Uint8Array([BIOMES.TAIGA, BIOMES.TUNDRA])
  const fields = { elevation: new Float32Array(2) }

  const fromGrassland = buildLandTerrainRgba({
    gridWidth: 2,
    gridHeight: 1,
    biomes: new Uint8Array([BIOMES.GRASSLAND, BIOMES.GRASSLAND]),
    displayBiomes,
    fields,
  })
  const fromOcean = buildLandTerrainRgba({
    gridWidth: 2,
    gridHeight: 1,
    biomes: new Uint8Array([BIOMES.OCEAN, BIOMES.SWAMP]),
    displayBiomes,
    fields,
  })

  assert.deepStrictEqual(fromOcean, fromGrassland)
})

test('biomeIndicesToRgba and buildLandTerrainRgba agree on the displayBiomes palette', () => {
  const doc = {
    gridWidth: 2,
    gridHeight: 1,
    biomes: new Uint8Array([BIOMES.OCEAN, BIOMES.OCEAN]),
    displayBiomes: new Uint8Array([BIOMES.SCRUBLAND, BIOMES.HILLS]),
    fields: { elevation: new Float32Array(2) },
  }

  assert.deepStrictEqual(biomeIndicesToRgba(doc), buildLandTerrainRgba(doc))
})

test('terrain raster applies no edge smoothing across river-corridor boundaries', () => {
  const displayBiomes = new Uint8Array([BIOMES.GRASSLAND, BIOMES.RIVER_CORRIDOR, BIOMES.GRASSLAND])
  const rgba = buildLandTerrainRgba({
    gridWidth: 3,
    gridHeight: 1,
    biomes: displayBiomes,
    displayBiomes,
    fields: { elevation: new Float32Array(3) },
  })

  assert.deepStrictEqual(rgbaAt(rgba, 0), biomeColorForId(BIOMES.GRASSLAND))
  assert.deepStrictEqual(rgbaAt(rgba, 1), biomeColorForId(BIOMES.RIVER_CORRIDOR))
  assert.deepStrictEqual(rgbaAt(rgba, 2), biomeColorForId(BIOMES.GRASSLAND))
})

test('river overlay draws from the presentation corridor mask, ignoring biome-painted rivers', () => {
  const width = 5
  const height = 5
  const cellCount = width * height
  const biomePaintedRivers = new Uint8Array(cellCount).fill(BIOMES.GRASSLAND)
  for (let y = 1; y <= 3; y += 1) {
    biomePaintedRivers[y * width + 2] = BIOMES.RIVER_CORRIDOR
  }

  assert.strictEqual(
    buildRiverOverlayRgba({
      gridWidth: width,
      gridHeight: height,
      biomes: biomePaintedRivers,
      displayBiomes: biomePaintedRivers,
    }),
    null,
  )

  const centerline = new Uint8Array(cellCount)
  const corridor = new Uint8Array(cellCount)
  for (let y = 1; y <= 3; y += 1) {
    centerline[y * width + 2] = 1
    corridor[y * width + 2] = 1
  }
  const flowDirection = new Int16Array(cellCount).fill(-1)
  const flowAccumulation = new Float32Array(cellCount).fill(0.5)
  const network = assembleRiverNetwork({
    centerline,
    corridor,
    flowDirection,
    flowAccumulation,
    graph: { nodes: [], edges: [] },
    width,
    height,
  })

  const rgba = buildRiverOverlayRgba({
    gridWidth: width,
    gridHeight: height,
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    fields: {
      elevation: new Float32Array(cellCount),
      drainage: flowAccumulation,
    },
    riverNetworkMask: network.centerline,
    riverCorridorMask: network.corridor,
    flowDirection,
    riverGraph: network.graph,
  })

  assert.ok(rgba)
  assert.ok(rgba[(2 * width + 2) * 4 + 3] > 0)
})
