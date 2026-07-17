import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildWealthOverlayRgba,
  computeSettlementWealthSignals,
  WEALTH_DEFICIT_RGB,
  WEALTH_OVERLAY_MAX_ALPHA,
  WEALTH_OVERLAY_MIN_ALPHA,
  WEALTH_SURPLUS_RGB,
} from './buildWealthOverlayRgba.js'

const MAX_ALPHA_BYTE = Math.round(WEALTH_OVERLAY_MAX_ALPHA * 255)

function cellOffset(x, y, gridWidth) {
  return (y * gridWidth + x) * 4
}

test('paints claimed cells with surplus green and deficit red', () => {
  const rgba = buildWealthOverlayRgba({
    gridWidth: 8,
    gridHeight: 8,
    settlements: [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 7, y: 7 },
    ],
    primaryClaim: {
      a: [
        { x: 3, y: 0 },
        { x: 4, y: 0 },
      ],
      b: [
        { x: 3, y: 7 },
        { x: 4, y: 7 },
      ],
    },
    lastTradeEpochResult: {
      realmBalancesCp: { a: 500, b: -800 },
      obligationDeltas: [
        { toSettlementId: 'a', amountCp: 1000, kind: 'goods' },
        { toSettlementId: 'b', amountCp: 1000, kind: 'goods' },
      ],
    },
  })
  assert.ok(rgba)
  const aClaim = cellOffset(3, 0, 8)
  const aPin = cellOffset(0, 0, 8)
  const bClaim = cellOffset(3, 7, 8)
  const unclaimed = cellOffset(1, 0, 8)
  assert.strictEqual(rgba[aClaim], WEALTH_SURPLUS_RGB[0])
  assert.strictEqual(rgba[aClaim + 1], WEALTH_SURPLUS_RGB[1])
  assert.ok(rgba[aClaim + 3] > 0)
  assert.strictEqual(rgba[aPin + 3], 0)
  assert.strictEqual(rgba[unclaimed + 3], 0)
  assert.strictEqual(rgba[bClaim], WEALTH_DEFICIT_RGB[0])
  assert.strictEqual(rgba[bClaim + 1], WEALTH_DEFICIT_RGB[1])
  assert.ok(rgba[bClaim + 3] > 0)
})

test('zero-income wealth saturates alpha above a normalizable settlement', () => {
  const rgba = buildWealthOverlayRgba({
    gridWidth: 8,
    gridHeight: 8,
    settlements: [
      { id: 'normalizable', x: 1, y: 1 },
      { id: 'saturated', x: 6, y: 6 },
    ],
    primaryClaim: {
      normalizable: [{ x: 1, y: 1 }],
      saturated: [{ x: 6, y: 6 }],
    },
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

test('does not paint a pin blob outside primary claim cells', () => {
  const rgba = buildWealthOverlayRgba({
    gridWidth: 8,
    gridHeight: 8,
    settlements: [{ id: 'a', x: 4, y: 4 }],
    primaryClaim: {
      a: [{ x: 4, y: 4 }],
    },
    lastTradeEpochResult: {
      realmBalancesCp: { a: 100 },
      obligationDeltas: [{ toSettlementId: 'a', amountCp: 1000, kind: 'goods' }],
    },
  })
  assert.ok(rgba)
  const pin = cellOffset(4, 4, 8)
  const neighbor = cellOffset(5, 4, 8)
  assert.ok(rgba[pin + 3] > 0)
  assert.strictEqual(rgba[neighbor + 3], 0)
})

test('omits ruin settlements even when primary claim cells remain', () => {
  const rgba = buildWealthOverlayRgba({
    gridWidth: 8,
    gridHeight: 8,
    settlements: [
      { id: 'living', x: 1, y: 1 },
      { id: 'ruined', x: 6, y: 6, status: 'ruin' },
    ],
    primaryClaim: {
      living: [{ x: 1, y: 1 }],
      ruined: [
        { x: 5, y: 6 },
        { x: 6, y: 6 },
        { x: 7, y: 6 },
      ],
    },
    lastTradeEpochResult: {
      realmBalancesCp: { living: 500, ruined: -800 },
      obligationDeltas: [
        { toSettlementId: 'living', amountCp: 1000, kind: 'goods' },
        { toSettlementId: 'ruined', amountCp: 1000, kind: 'goods' },
      ],
    },
  })
  assert.ok(rgba)
  assert.ok(rgba[cellOffset(1, 1, 8) + 3] > 0)
  assert.strictEqual(rgba[cellOffset(5, 6, 8) + 3], 0)
  assert.strictEqual(rgba[cellOffset(6, 6, 8) + 3], 0)
  assert.strictEqual(rgba[cellOffset(7, 6, 8) + 3], 0)
})

test('returns null when living settlements have empty primary claim', () => {
  assert.strictEqual(
    buildWealthOverlayRgba({
      gridWidth: 4,
      gridHeight: 4,
      settlements: [{ id: 'a', x: 1, y: 1 }],
      primaryClaim: { a: [] },
      lastTradeEpochResult: {
        realmBalancesCp: { a: 100 },
        obligationDeltas: [{ toSettlementId: 'a', amountCp: 1000, kind: 'goods' }],
      },
    }),
    null,
  )
  assert.strictEqual(
    buildWealthOverlayRgba({
      gridWidth: 4,
      gridHeight: 4,
      settlements: [{ id: 'a', x: 1, y: 1 }],
      lastTradeEpochResult: {
        realmBalancesCp: { a: 100 },
        obligationDeltas: [{ toSettlementId: 'a', amountCp: 1000, kind: 'goods' }],
      },
    }),
    null,
  )
})

test('returns null without settlements', () => {
  assert.strictEqual(
    buildWealthOverlayRgba({ gridWidth: 4, gridHeight: 4, settlements: [] }),
    null,
  )
})

test('skips ocean lake and river cells inside primary claim', () => {
  const cellCount = 16
  const elevation = new Float32Array(cellCount).fill(0.5)
  elevation[1] = 0.1
  const lakeMask = new Uint8Array(cellCount)
  lakeMask[2] = 1
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[3] = 1
  const rgba = buildWealthOverlayRgba({
    gridWidth: 4,
    gridHeight: 4,
    fields: { elevation },
    lakeMask,
    riverCorridorMask,
    settlements: [{ id: 'a', x: 0, y: 0 }],
    primaryClaim: {
      a: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
    },
    lastTradeEpochResult: {
      realmBalancesCp: { a: 100 },
      obligationDeltas: [{ toSettlementId: 'a', amountCp: 1000, kind: 'goods' }],
    },
  })
  assert.ok(rgba)
  assert.ok(rgba[cellOffset(0, 0, 4) + 3] > 0)
  assert.strictEqual(rgba[cellOffset(1, 0, 4) + 3], 0)
  assert.strictEqual(rgba[cellOffset(2, 0, 4) + 3], 0)
  assert.strictEqual(rgba[cellOffset(3, 0, 4) + 3], 0)
})

test('wealth overlay alpha stays in the low translucent band', () => {
  assert.ok(WEALTH_OVERLAY_MAX_ALPHA <= 0.5)
  assert.ok(WEALTH_OVERLAY_MIN_ALPHA < WEALTH_OVERLAY_MAX_ALPHA)
})
