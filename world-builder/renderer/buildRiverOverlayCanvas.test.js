import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../core/biomeIds.js'
import { buildRiverOverlayRgba } from './buildRiverOverlayCanvas.js'

test('buildRiverOverlayRgba returns null when no river cells exist', () => {
  const rgba = buildRiverOverlayRgba({
    gridWidth: 4,
    gridHeight: 4,
    biomes: new Uint8Array(16).fill(BIOMES.GRASSLAND),
  })
  assert.equal(rgba, null)
})

test('buildRiverOverlayRgba returns opaque river pixels when river cells exist', () => {
  const biomes = new Uint8Array(16).fill(BIOMES.GRASSLAND)
  biomes[5] = BIOMES.RIVER_CORRIDOR
  const rgba = buildRiverOverlayRgba({
    gridWidth: 4,
    gridHeight: 4,
    biomes,
  })
  assert.ok(rgba)
  assert.strictEqual(rgba.length, 16 * 4)
  assert.ok(rgba[5 * 4 + 3] > 200)
})
