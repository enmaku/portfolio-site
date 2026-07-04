import assert from 'node:assert/strict'
import test from 'node:test'
import { appendRoadSegment } from '../core/colonization/roads/roadNetwork.js'
import { buildRoadOverlayRgba } from './buildRoadOverlayRgba.js'

test('buildRoadOverlayRgba paints road cells', () => {
  const roads = appendRoadSegment([], [{ x: 1, y: 1 }, { x: 2, y: 1 }])
  const rgba = buildRoadOverlayRgba({ gridWidth: 4, gridHeight: 4, roads })
  assert.ok(rgba)
  assert.ok(rgba[((1 * 4) + 1) * 4 + 3] > 0)
  assert.strictEqual(rgba[0 + 3], 0)
})

test('buildRoadOverlayRgba returns null without roads', () => {
  assert.strictEqual(buildRoadOverlayRgba({ gridWidth: 2, gridHeight: 2, roads: [] }), null)
})
