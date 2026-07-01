import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../core/biomeIds.js'
import { biomeColorForId } from './biomePalette.js'
import { crispRiverEdgeStrength } from './riverCorridorOverlayRgba.js'
import {
  computeRiverOutlineMaskFromBiomes,
  computeRiverOverlayAlpha,
  smoothRiverBiomeEdgesInRgba,
} from './smoothRiverBiomeEdgesInRgba.js'

test('crispRiverEdgeStrength steepens mid-range alpha versus raw blur', () => {
  const blurred = 0.5
  const wideBlurred = 0.45
  const crisp = crispRiverEdgeStrength(blurred, wideBlurred)
  assert.ok(crisp > blurred)
  assert.ok(crisp <= 1)
})

test('crispRiverEdgeStrength returns 0 below the smoothstep floor', () => {
  assert.strictEqual(crispRiverEdgeStrength(0.02, 0.02), 0)
})

test('crispRiverEdgeStrength returns 1 above the smoothstep ceiling', () => {
  assert.strictEqual(crispRiverEdgeStrength(0.9, 0.88), 1)
})

test('computeRiverOutlineMask marks land outside and water inside the feathered edge', () => {
  const width = 5
  const height = 5
  const biomes = new Uint8Array(width * height).fill(BIOMES.GRASSLAND)
  for (let y = 1; y <= 3; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      biomes[y * width + x] = BIOMES.RIVER_CORRIDOR
    }
  }

  const alpha = computeRiverOverlayAlpha(biomes, width, height)
  const outline = computeRiverOutlineMaskFromBiomes(alpha, biomes, width, height)

  assert.strictEqual(outline[2 * width + 2], 0)
  assert.strictEqual(outline[2 * width + 1], 1)
  assert.strictEqual(outline[1 * width + 2], 1)
  assert.strictEqual(outline[0], 1)
})

test('smoothRiverBiomeEdgesInRgba feathers land beside river without dulling river cells', () => {
  const width = 5
  const height = 3
  const biomes = new Uint8Array(width * height).fill(BIOMES.GRASSLAND)
  biomes[1 * width + 2] = BIOMES.RIVER_CORRIDOR

  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < biomes.length; i += 1) {
    const [r, g, b, a] = biomeColorForId(biomes[i])
    const offset = i * 4
    rgba[offset] = r
    rgba[offset + 1] = g
    rgba[offset + 2] = b
    rgba[offset + 3] = a
  }

  const riverIdx = 1 * width + 2
  const landIdx = 1 * width + 1
  const riverBlueBefore = rgba[riverIdx * 4 + 2]
  const landBlueBefore = rgba[landIdx * 4 + 2]

  smoothRiverBiomeEdgesInRgba(rgba, biomes, width, height)

  assert.strictEqual(rgba[riverIdx * 4 + 2], riverBlueBefore)
  assert.ok(rgba[landIdx * 4 + 2] > landBlueBefore)
  assert.ok(rgba[landIdx * 4 + 2] < riverBlueBefore)
})
