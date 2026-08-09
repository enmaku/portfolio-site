import assert from 'node:assert/strict'
import test from 'node:test'
import { generatePhysicalTerrainBaseline } from '../core/generatePhysicalTerrainBaseline.js'
import { biomeIndicesToRgba } from './biomeIndicesToRgba.js'

test('biomeIndicesToRgba returns RGBA buffer sized width*height*4', () => {
  const doc = generatePhysicalTerrainBaseline({
    geographySeed: 7,
    prevailingWindDegrees: 180,
    width: 8,
    height: 4,
  })

  const rgba = biomeIndicesToRgba(doc)
  assert.strictEqual(rgba.length, 8 * 4 * 4)
  assert.ok(rgba[3] === 255)
})
