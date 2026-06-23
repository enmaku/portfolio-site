import assert from 'node:assert/strict'
import test from 'node:test'
import { fillPolygonMask } from './fillPolygonMask.js'

test('fillPolygonMask fills a solid axis-aligned rectangle', () => {
  const width = 7
  const height = 5
  const mask = new Uint8Array(width * height)
  fillPolygonMask(mask, width, height, [
    { x: 1.5, y: 1.5 },
    { x: 4.5, y: 1.5 },
    { x: 4.5, y: 4.5 },
    { x: 1.5, y: 4.5 },
  ])

  for (let y = 1; y <= 3; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      assert.strictEqual(mask[y * width + x], 1, `expected fill at ${x},${y}`)
    }
  }
  assert.strictEqual(mask[1 * width + 4], 0)
})
