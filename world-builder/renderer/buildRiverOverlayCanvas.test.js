import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../core/biomeIds.js'
import { buildRiverOverlayRgba } from './buildRiverOverlayCanvas.js'
import { WATER_BODY_OUTLINE_RGBA } from './smoothRiverBiomeEdgesInRgba.js'

function fillRiverBlock(biomes, width, x0, y0, size) {
  for (let y = y0; y < y0 + size; y += 1) {
    for (let x = x0; x < x0 + size; x += 1) {
      biomes[y * width + x] = BIOMES.RIVER_CORRIDOR
    }
  }
}

test('buildRiverOverlayRgba returns null when no river cells exist', () => {
  const rgba = buildRiverOverlayRgba({
    gridWidth: 4,
    gridHeight: 4,
    biomes: new Uint8Array(16).fill(BIOMES.GRASSLAND),
  })
  assert.equal(rgba, null)
})

test('buildRiverOverlayRgba returns opaque river pixels when river cells exist', () => {
  const width = 5
  const height = 5
  const biomes = new Uint8Array(width * height).fill(BIOMES.GRASSLAND)
  fillRiverBlock(biomes, width, 1, 1, 3)
  const rgba = buildRiverOverlayRgba({
    gridWidth: width,
    gridHeight: height,
    biomes,
  })
  assert.ok(rgba)
  assert.ok(rgba[(2 * width + 2) * 4 + 3] > 200)
})

test('buildRiverOverlayRgba paints outline pixels beside river cells', () => {
  const width = 5
  const height = 5
  const biomes = new Uint8Array(width * height).fill(BIOMES.GRASSLAND)
  fillRiverBlock(biomes, width, 1, 1, 3)
  const rgba = buildRiverOverlayRgba({
    gridWidth: width,
    gridHeight: height,
    biomes,
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

  const insideOutlineOffset = (2 * width + 1) * 4
  assert.deepEqual(
    [
      rgba[insideOutlineOffset],
      rgba[insideOutlineOffset + 1],
      rgba[insideOutlineOffset + 2],
      rgba[insideOutlineOffset + 3],
    ],
    WATER_BODY_OUTLINE_RGBA,
  )
})
