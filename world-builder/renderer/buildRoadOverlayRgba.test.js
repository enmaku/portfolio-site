import assert from 'node:assert/strict'
import test from 'node:test'
import { appendRoadSegment } from '../core/colonization/roads/roadNetwork.js'
import {
  buildRoutesOverlayRgba,
  computeRouteOutlineMask,
  LAND_ROUTE_OVERLAY_RGB,
  ROUTE_OVERLAY_HALF_WIDTH,
  OPEN_SEA_ROUTE_OVERLAY_RGB,
  SAIL_ROUTE_OVERLAY_RGB,
} from './buildRoadOverlayRgba.js'
import { WATER_BODY_OUTLINE_RGBA } from './riverCorridorOverlayRgba.js'

test('buildRoutesOverlayRgba paints a thickened land route brush', () => {
  const roads = appendRoadSegment([], [{ x: 3, y: 3 }, { x: 4, y: 3 }], [], 'land')
  const rgba = buildRoutesOverlayRgba({ gridWidth: 8, gridHeight: 8, roads })
  assert.ok(rgba)
  const centerBase = ((3 * 8) + 3) * 4
  const neighborBase = ((3 * 8) + 4) * 4
  const farBase = ((0 * 8) + 0) * 4
  assert.ok(rgba[centerBase + 3] > 0)
  assert.ok(rgba[neighborBase + 3] > 0, 'route brush should extend beyond center cell')
  assert.strictEqual(rgba[centerBase], LAND_ROUTE_OVERLAY_RGB[0])
  assert.strictEqual(rgba[farBase + 3], 0)
})

test('buildRoutesOverlayRgba half-width constant matches painted neighborhood', () => {
  const roads = appendRoadSegment([], [{ x: 3, y: 3 }], [], 'land')
  const rgba = buildRoutesOverlayRgba({ gridWidth: 8, gridHeight: 8, roads })
  assert.ok(rgba)
  const edgeBase = ((3 + ROUTE_OVERLAY_HALF_WIDTH) * 8 + 3) * 4
  const beyondBase = ((0 * 8) + 0) * 4
  assert.ok(rgba[edgeBase + 3] > 0)
  assert.strictEqual(rgba[beyondBase + 3], 0)
})

test('buildRoutesOverlayRgba uses distinct colors for land and sail segments', () => {
  const roads = [
    ...appendRoadSegment([], [{ x: 1, y: 1 }], [], 'land'),
    ...appendRoadSegment([], [{ x: 6, y: 1 }], [], 'sail'),
  ]
  const rgba = buildRoutesOverlayRgba({ gridWidth: 8, gridHeight: 8, roads })
  assert.ok(rgba)
  const landBase = ((1 * 8) + 1) * 4
  const sailBase = ((1 * 8) + 6) * 4
  assert.strictEqual(rgba[landBase], LAND_ROUTE_OVERLAY_RGB[0])
  assert.strictEqual(rgba[sailBase], SAIL_ROUTE_OVERLAY_RGB[0])
  assert.notStrictEqual(rgba[landBase], rgba[sailBase])
})

test('buildRoutesOverlayRgba renders open_sea segments with spline presentation color', () => {
  const roads = appendRoadSegment(
    [],
    [{ x: 1, y: 1 }, { x: 6, y: 5 }],
    ['port-a', 'port-b'],
    'open_sea',
  )
  const rgba = buildRoutesOverlayRgba({
    gridWidth: 8,
    gridHeight: 8,
    roads,
    settlements: [
      { id: 'port-a', x: 1, y: 1 },
      { id: 'port-b', x: 6, y: 5 },
    ],
  })
  assert.ok(rgba)
  const midBase = ((3 * 8) + 3) * 4
  assert.strictEqual(rgba[midBase], OPEN_SEA_ROUTE_OVERLAY_RGB[0])
  assert.notStrictEqual(rgba[midBase], LAND_ROUTE_OVERLAY_RGB[0])
  assert.notStrictEqual(rgba[midBase], SAIL_ROUTE_OVERLAY_RGB[0])
})

test('buildRoutesOverlayRgba returns null without route segments', () => {
  assert.strictEqual(buildRoutesOverlayRgba({ gridWidth: 2, gridHeight: 2, roads: [] }), null)
})

test('buildRoutesOverlayRgba paints a thin exterior outline beside route fill', () => {
  const roads = appendRoadSegment([], [{ x: 3, y: 3 }], [], 'land')
  const rgba = buildRoutesOverlayRgba({ gridWidth: 8, gridHeight: 8, roads })
  assert.ok(rgba)
  const outlineBase = ((3 * 8) + 1) * 4
  const farBase = ((0 * 8) + 0) * 4
  assert.strictEqual(rgba[outlineBase], WATER_BODY_OUTLINE_RGBA[0])
  assert.ok(rgba[outlineBase + 3] > 0)
  assert.strictEqual(rgba[farBase + 3], 0)
})

test('computeRouteOutlineMask rings only the exterior of route fill', () => {
  const width = 5
  const height = 5
  const fill = new Uint8Array(width * height)
  fill[2 * width + 2] = 1
  const outline = computeRouteOutlineMask(fill, width, height)
  assert.strictEqual(outline[2 * width + 2], 0)
  assert.strictEqual(outline[2 * width + 1], 1)
  assert.strictEqual(outline[1 * width + 2], 1)
  assert.strictEqual(outline[0], 0)
})

test('buildRoutesOverlayRgba connects sparse stored waypoints into continuous fill', () => {
  const roads = appendRoadSegment([], [{ x: 1, y: 3 }, { x: 5, y: 3 }], [], 'land')
  const rgba = buildRoutesOverlayRgba({ gridWidth: 8, gridHeight: 8, roads })
  assert.ok(rgba)
  const gapBase = ((3 * 8) + 3) * 4
  assert.ok(rgba[gapBase + 3] > 0, 'intermediate cells between sparse waypoints should be filled')
})
