import assert from 'node:assert/strict'
import test from 'node:test'
import { appendRoadSegment } from '../core/colonization/roads/roadNetwork.js'
import {
  buildRoutesOverlayRgba,
  LAND_ROUTE_OVERLAY_RGB,
  SAIL_ROUTE_OVERLAY_RGB,
} from './buildRoadOverlayRgba.js'

test('buildRoutesOverlayRgba paints land route cells', () => {
  const roads = appendRoadSegment([], [{ x: 1, y: 1 }, { x: 2, y: 1 }], [], 'land')
  const rgba = buildRoutesOverlayRgba({ gridWidth: 4, gridHeight: 4, roads })
  assert.ok(rgba)
  const base = ((1 * 4) + 1) * 4
  assert.ok(rgba[base + 3] > 0)
  assert.strictEqual(rgba[base], LAND_ROUTE_OVERLAY_RGB[0])
  assert.strictEqual(rgba[0 + 3], 0)
})

test('buildRoutesOverlayRgba uses distinct colors for land and sail segments', () => {
  const roads = [
    ...appendRoadSegment([], [{ x: 0, y: 0 }], [], 'land'),
    ...appendRoadSegment([], [{ x: 2, y: 0 }], [], 'sail'),
  ]
  const rgba = buildRoutesOverlayRgba({ gridWidth: 4, gridHeight: 4, roads })
  assert.ok(rgba)
  const landBase = 0
  const sailBase = (0 * 4 + 2) * 4
  assert.strictEqual(rgba[landBase], LAND_ROUTE_OVERLAY_RGB[0])
  assert.strictEqual(rgba[sailBase], SAIL_ROUTE_OVERLAY_RGB[0])
  assert.notStrictEqual(rgba[landBase], rgba[sailBase])
})

test('buildRoutesOverlayRgba returns null without route segments', () => {
  assert.strictEqual(buildRoutesOverlayRgba({ gridWidth: 2, gridHeight: 2, roads: [] }), null)
})
