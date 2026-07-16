import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildWealthOverlayRgba,
  computeSettlementWealthSignals,
  WEALTH_DEFICIT_RGB,
  WEALTH_OVERLAY_MARKER_RADIUS,
  WEALTH_OVERLAY_MAX_ALPHA,
  WEALTH_SURPLUS_RGB,
} from './buildWealthOverlayRgba.js'

const MAX_ALPHA_BYTE = Math.round(WEALTH_OVERLAY_MAX_ALPHA * 255)

function cellOffset(x, y, gridWidth) {
  return (y * gridWidth + x) * 4
}

test('paints surplus settlements green and deficit settlements red', () => {
  const rgba = buildWealthOverlayRgba({
    gridWidth: 8,
    gridHeight: 8,
    settlements: [
      { id: 'a', x: 2, y: 2 },
      { id: 'b', x: 6, y: 6 },
    ],
    lastTradeEpochResult: {
      realmBalancesCp: { a: 500, b: -800 },
      obligationDeltas: [
        { toSettlementId: 'a', amountCp: 1000, kind: 'goods' },
        { toSettlementId: 'b', amountCp: 1000, kind: 'goods' },
      ],
    },
  })
  assert.ok(rgba)
  const a = cellOffset(2, 2, 8)
  const b = cellOffset(6, 6, 8)
  assert.strictEqual(rgba[a], WEALTH_SURPLUS_RGB[0])
  assert.strictEqual(rgba[a + 1], WEALTH_SURPLUS_RGB[1])
  assert.strictEqual(rgba[b], WEALTH_DEFICIT_RGB[0])
  assert.strictEqual(rgba[b + 1], WEALTH_DEFICIT_RGB[1])
})

test('zero-income wealth saturates alpha above a normalizable settlement', () => {
  const rgba = buildWealthOverlayRgba({
    gridWidth: 8,
    gridHeight: 8,
    settlements: [
      { id: 'normalizable', x: 1, y: 1 },
      { id: 'saturated', x: 6, y: 6 },
    ],
    lastTradeEpochResult: {
      realmBalancesCp: { normalizable: 300, saturated: 300 },
      obligationDeltas: [{ toSettlementId: 'normalizable', amountCp: 1000, kind: 'goods' }],
    },
  })
  assert.ok(rgba)
  const normalizableAlpha = rgba[cellOffset(1, 1, 8) + 3]
  const saturatedAlpha = rgba[cellOffset(6, 6, 8) + 3]
  assert.strictEqual(saturatedAlpha, MAX_ALPHA_BYTE)
  assert.ok(saturatedAlpha > normalizableAlpha)
})

test('external port credit contributes to net wealth', () => {
  const signals = computeSettlementWealthSignals({
    settlements: [{ id: 'port', x: 0, y: 0 }],
    lastTradeEpochResult: { realmBalancesCp: { port: -100 } },
    externalTradeAccounts: { port: 400 },
  })
  assert.strictEqual(signals.length, 1)
  assert.strictEqual(signals[0].netWealthCp, 300)
})

test('does not paint cells beyond the marker radius', () => {
  const rgba = buildWealthOverlayRgba({
    gridWidth: 8,
    gridHeight: 8,
    settlements: [{ id: 'a', x: 4, y: 4 }],
    lastTradeEpochResult: {
      realmBalancesCp: { a: 100 },
      obligationDeltas: [{ toSettlementId: 'a', amountCp: 1000, kind: 'goods' }],
    },
  })
  assert.ok(rgba)
  const edge = cellOffset(4 + WEALTH_OVERLAY_MARKER_RADIUS, 4, 8)
  const beyond = cellOffset(4 + WEALTH_OVERLAY_MARKER_RADIUS + 1, 4, 8)
  assert.ok(rgba[edge + 3] > 0)
  assert.strictEqual(rgba[beyond + 3], 0)
})

test('returns null without settlements', () => {
  assert.strictEqual(
    buildWealthOverlayRgba({ gridWidth: 4, gridHeight: 4, settlements: [] }),
    null,
  )
})
