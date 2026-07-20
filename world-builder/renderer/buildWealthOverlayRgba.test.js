import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildWealthOverlayRgba,
  computeSettlementWealthSignals,
  WEALTH_CLAIM_OUTLINE_RGBA,
  WEALTH_OVERLAY_MAX_ALPHA,
  WEALTH_OVERLAY_MIN_ALPHA,
  wealthTintRgb,
} from './buildWealthOverlayRgba.js'

const MAX_ALPHA_BYTE = Math.round(WEALTH_OVERLAY_MAX_ALPHA * 255)

function cellOffset(x, y, gridWidth) {
  return (y * gridWidth + x) * 4
}

function luminance(rgb) {
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
}

test('paints claimed cells with surplus green and deficit red', () => {
  const worldDocument = {
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
  }
  const rgba = buildWealthOverlayRgba(worldDocument)
  assert.ok(rgba)
  const signals = computeSettlementWealthSignals(worldDocument)
  const surplusTint = wealthTintRgb(signals.find((s) => s.id === 'a').normalized)
  const deficitTint = wealthTintRgb(signals.find((s) => s.id === 'b').normalized)
  const aClaim = cellOffset(3, 0, 8)
  const aPin = cellOffset(0, 0, 8)
  const bClaim = cellOffset(3, 7, 8)
  const unclaimed = cellOffset(1, 0, 8)
  assert.strictEqual(rgba[aClaim], surplusTint[0])
  assert.strictEqual(rgba[aClaim + 1], surplusTint[1])
  assert.ok(rgba[aClaim + 3] > 0)
  assert.strictEqual(rgba[aPin + 3], 0)
  assert.strictEqual(rgba[unclaimed + 3], 0)
  assert.strictEqual(rgba[bClaim], deficitTint[0])
  assert.strictEqual(rgba[bClaim + 1], deficitTint[1])
  assert.ok(rgba[bClaim + 3] > 0)
  assert.ok(surplusTint[1] > surplusTint[0])
  assert.ok(deficitTint[0] > deficitTint[1])
})

test('higher tooltip balances paint darker than lower peers', () => {
  const rgba = buildWealthOverlayRgba({
    gridWidth: 8,
    gridHeight: 8,
    settlements: [
      { id: 'mild', x: 1, y: 1 },
      { id: 'rich', x: 6, y: 6 },
    ],
    primaryClaim: {
      mild: [{ x: 1, y: 1 }],
      rich: [{ x: 6, y: 6 }],
    },
    lastTradeEpochResult: {
      realmBalancesCp: { mild: 300, rich: 5000 },
    },
  })
  assert.ok(rgba)
  const mild = [
    rgba[cellOffset(1, 1, 8)],
    rgba[cellOffset(1, 1, 8) + 1],
    rgba[cellOffset(1, 1, 8) + 2],
  ]
  const rich = [
    rgba[cellOffset(6, 6, 8)],
    rgba[cellOffset(6, 6, 8) + 1],
    rgba[cellOffset(6, 6, 8) + 2],
  ]
  assert.ok(luminance(rich) < luminance(mild))
  assert.strictEqual(rgba[cellOffset(6, 6, 8) + 3], MAX_ALPHA_BYTE)
})

test('overlay magnitude tracks the tooltip combined balance directly', () => {
  const worldDocument = {
    settlements: [
      { id: 'small', x: 0, y: 0 },
      { id: 'mid', x: 1, y: 0 },
      { id: 'huge', x: 2, y: 0 },
    ],
    lastTradeEpochResult: {
      realmBalancesCp: { small: 14_000, mid: 55_000, huge: 380_000 },
    },
  }
  const signals = computeSettlementWealthSignals(worldDocument)
  const byId = Object.fromEntries(signals.map((s) => [s.id, s]))
  assert.strictEqual(byId.small.netWealthCp, 14_000)
  assert.strictEqual(byId.mid.netWealthCp, 55_000)
  assert.strictEqual(byId.huge.netWealthCp, 380_000)
  assert.strictEqual(byId.huge.normalized, 1)
  assert.strictEqual(byId.mid.normalized, 55_000 / 380_000)
  assert.strictEqual(byId.small.normalized, 14_000 / 380_000)
  assert.ok(luminance(wealthTintRgb(byId.huge.normalized)) < luminance(wealthTintRgb(byId.mid.normalized)))
  assert.ok(luminance(wealthTintRgb(byId.mid.normalized)) < luminance(wealthTintRgb(byId.small.normalized)))
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

test('does not paint wealth fill outside primary claim cells', () => {
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
  assert.strictEqual(rgba[pin], wealthTintRgb(1)[0])
  assert.strictEqual(rgba[neighbor], WEALTH_CLAIM_OUTLINE_RGBA[0])
  assert.strictEqual(rgba[neighbor + 3], WEALTH_CLAIM_OUTLINE_RGBA[3])
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

test('wealth overlay alpha stays in the stained-glass band', () => {
  assert.ok(WEALTH_OVERLAY_MIN_ALPHA >= 0.5)
  assert.ok(WEALTH_OVERLAY_MAX_ALPHA <= 0.9)
  assert.ok(WEALTH_OVERLAY_MIN_ALPHA < WEALTH_OVERLAY_MAX_ALPHA)
})

test('wealth alpha uses sqrt magnitude so mid balances read stronger than linear', () => {
  const worldDocument = {
    gridWidth: 4,
    gridHeight: 4,
    settlements: [
      { id: 'mid', x: 1, y: 1 },
      { id: 'rich', x: 2, y: 2 },
    ],
    primaryClaim: {
      mid: [{ x: 1, y: 1 }],
      rich: [{ x: 2, y: 2 }],
    },
    lastTradeEpochResult: {
      realmBalancesCp: { mid: 500, rich: 20_000 },
      obligationDeltas: [
        { toSettlementId: 'mid', amountCp: 1000, kind: 'goods' },
        { toSettlementId: 'rich', amountCp: 1000, kind: 'goods' },
      ],
    },
  }
  const rgba = buildWealthOverlayRgba(worldDocument)
  assert.ok(rgba)
  const midNorm = Math.abs(computeSettlementWealthSignals(worldDocument).find((s) => s.id === 'mid').normalized)
  const alpha = rgba[cellOffset(1, 1, 4) + 3]
  const linearMid =
    WEALTH_OVERLAY_MIN_ALPHA + (WEALTH_OVERLAY_MAX_ALPHA - WEALTH_OVERLAY_MIN_ALPHA) * midNorm
  const sqrtMid =
    WEALTH_OVERLAY_MIN_ALPHA +
    (WEALTH_OVERLAY_MAX_ALPHA - WEALTH_OVERLAY_MIN_ALPHA) * Math.sqrt(midNorm)
  assert.strictEqual(alpha, Math.round(sqrtMid * 255))
  assert.ok(alpha > Math.round(linearMid * 255))
})

test('stronger surplus and deficit tints are darker than mild ones', () => {
  assert.ok(luminance(wealthTintRgb(1)) < luminance(wealthTintRgb(0.2)))
  assert.ok(luminance(wealthTintRgb(-1)) < luminance(wealthTintRgb(-0.2)))
})

test('mild surplus stays bright lime while full surplus reaches dark hunter', () => {
  const mild = wealthTintRgb(0.15)
  const full = wealthTintRgb(1)
  assert.ok(mild[1] > mild[0], 'mild surplus should be green-dominant')
  assert.ok(full[1] > full[0], 'full surplus should stay green-dominant')
  assert.ok(mild[1] > full[1], 'full surplus green channel drops as brightness mixes toward black')
})

test('paints a thin black outline between abutting primary claims', () => {
  const rgba = buildWealthOverlayRgba({
    gridWidth: 8,
    gridHeight: 8,
    settlements: [
      { id: 'a', x: 1, y: 1 },
      { id: 'b', x: 6, y: 1 },
    ],
    primaryClaim: {
      a: [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
      ],
      b: [
        { x: 4, y: 1 },
        { x: 5, y: 1 },
      ],
    },
    lastTradeEpochResult: {
      realmBalancesCp: { a: 500, b: 500 },
      obligationDeltas: [
        { toSettlementId: 'a', amountCp: 1000, kind: 'goods' },
        { toSettlementId: 'b', amountCp: 1000, kind: 'goods' },
      ],
    },
  })
  assert.ok(rgba)
  const aEdge = cellOffset(3, 1, 8)
  const bEdge = cellOffset(4, 1, 8)
  const aInterior = cellOffset(2, 1, 8)
  const peerTint = wealthTintRgb(1)
  assert.strictEqual(rgba[aEdge], WEALTH_CLAIM_OUTLINE_RGBA[0])
  assert.strictEqual(rgba[aEdge + 3], WEALTH_CLAIM_OUTLINE_RGBA[3])
  assert.strictEqual(rgba[bEdge], WEALTH_CLAIM_OUTLINE_RGBA[0])
  assert.strictEqual(rgba[bEdge + 3], WEALTH_CLAIM_OUTLINE_RGBA[3])
  assert.strictEqual(rgba[aInterior], peerTint[0])
  assert.ok(rgba[aInterior + 3] > 0)
})

test('paints a thin black outline on dry land beside an isolated claim', () => {
  const rgba = buildWealthOverlayRgba({
    gridWidth: 8,
    gridHeight: 8,
    settlements: [{ id: 'a', x: 3, y: 3 }],
    primaryClaim: {
      a: [
        { x: 3, y: 3 },
        { x: 4, y: 3 },
      ],
    },
    lastTradeEpochResult: {
      realmBalancesCp: { a: 500 },
      obligationDeltas: [{ toSettlementId: 'a', amountCp: 1000, kind: 'goods' }],
    },
  })
  assert.ok(rgba)
  const fill = cellOffset(3, 3, 8)
  const beside = cellOffset(2, 3, 8)
  const loneTint = wealthTintRgb(1)
  assert.strictEqual(rgba[fill], loneTint[0])
  assert.ok(rgba[fill + 3] > 0)
  assert.strictEqual(rgba[beside], WEALTH_CLAIM_OUTLINE_RGBA[0])
  assert.strictEqual(rgba[beside + 3], WEALTH_CLAIM_OUTLINE_RGBA[3])
})
