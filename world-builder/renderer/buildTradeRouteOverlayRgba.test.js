import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTradeRouteOverlayRgba,
  TRADE_ROUTE_ACTIVE_ALPHA,
  TRADE_ROUTE_DORMANT_ALPHA,
  TRADE_ROUTE_OPEN_SEA_RGB,
  TRADE_ROUTE_ROAD_RGB,
} from './buildTradeRouteOverlayRgba.js'

const DORMANT_ALPHA_BYTE = Math.round(TRADE_ROUTE_DORMANT_ALPHA * 255)
const ACTIVE_ALPHA_BYTE = Math.round(TRADE_ROUTE_ACTIVE_ALPHA * 255)

function cellOffset(x, y, gridWidth) {
  return (y * gridWidth + x) * 4
}

function roadCandidateDoc(overrides = {}) {
  return {
    gridWidth: 8,
    gridHeight: 8,
    settlements: [
      { id: 'a', x: 1, y: 1 },
      { id: 'b', x: 6, y: 1 },
    ],
    tradeRouteState: {
      candidates: [{ id: 'a::b::road', fromSettlementId: 'a', toSettlementId: 'b', mode: 'road' }],
      activeFlows: [],
    },
    ...overrides,
  }
}

test('draws a dormant candidate edge faintly between its endpoints', () => {
  const rgba = buildTradeRouteOverlayRgba(roadCandidateDoc())
  assert.ok(rgba)
  const mid = cellOffset(3, 1, 8)
  assert.strictEqual(rgba[mid], TRADE_ROUTE_ROAD_RGB[0])
  assert.strictEqual(rgba[mid + 3], DORMANT_ALPHA_BYTE)
})

test('draws an edge with realized flow at strong alpha', () => {
  const rgba = buildTradeRouteOverlayRgba(
    roadCandidateDoc({
      tradeRouteState: {
        candidates: [
          { id: 'a::b::road', fromSettlementId: 'a', toSettlementId: 'b', mode: 'road' },
        ],
        activeFlows: [{ edgeId: 'a::b::road', amount: 120 }],
      },
    }),
  )
  assert.ok(rgba)
  const mid = cellOffset(3, 1, 8)
  assert.strictEqual(rgba[mid + 3], ACTIVE_ALPHA_BYTE)
})

test('falls back to last clearing flows when activeFlows is empty', () => {
  const rgba = buildTradeRouteOverlayRgba(
    roadCandidateDoc({
      lastTradeEpochResult: { flows: [{ edgeId: 'a::b::road', amount: 50 }] },
    }),
  )
  assert.ok(rgba)
  assert.strictEqual(rgba[cellOffset(3, 1, 8) + 3], ACTIVE_ALPHA_BYTE)
})

test('uses distinct colors for different transport modes', () => {
  const rgba = buildTradeRouteOverlayRgba({
    gridWidth: 8,
    gridHeight: 8,
    settlements: [
      { id: 'a', x: 1, y: 1 },
      { id: 'b', x: 6, y: 1 },
      { id: 'c', x: 1, y: 6 },
      { id: 'd', x: 6, y: 6 },
    ],
    tradeRouteState: {
      candidates: [
        { id: 'a::b::road', fromSettlementId: 'a', toSettlementId: 'b', mode: 'road' },
        { id: 'c::d::openSea', fromSettlementId: 'c', toSettlementId: 'd', mode: 'openSea' },
      ],
      activeFlows: [],
    },
  })
  assert.ok(rgba)
  const road = cellOffset(3, 1, 8)
  const openSea = cellOffset(3, 6, 8)
  assert.strictEqual(rgba[road], TRADE_ROUTE_ROAD_RGB[0])
  assert.strictEqual(rgba[openSea], TRADE_ROUTE_OPEN_SEA_RGB[0])
  assert.notStrictEqual(rgba[road], rgba[openSea])
})

test('returns null without candidate edges', () => {
  assert.strictEqual(
    buildTradeRouteOverlayRgba({
      gridWidth: 4,
      gridHeight: 4,
      settlements: [],
      tradeRouteState: { candidates: [], activeFlows: [] },
    }),
    null,
  )
})
