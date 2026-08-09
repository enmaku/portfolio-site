import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPortTollsOverlayRgba } from './buildPortTollsOverlayRgba.js'
import { buildFactionTaxOverlayRgba } from './buildFactionTaxOverlayRgba.js'
import { buildCommodityPriceOverlayRgba } from './buildCommodityPriceOverlayRgba.js'
import {
  wealthTintRgb,
} from './buildPrimaryClaimMagnitudeOverlayRgba.js'
import { referencePriceCp } from '../core/economy/commodityCatalog.js'

function cellOffset(x, y, gridWidth) {
  return (y * gridWidth + x) * 4
}

test('port tolls overlay is zero-centered: higher income greener, zero gray', () => {
  const worldDocument = {
    gridWidth: 8,
    gridHeight: 8,
    settlements: [
      { id: 'zero', x: 1, y: 1, maritimeRole: 'port' },
      { id: 'high', x: 6, y: 6, maritimeRole: 'port' },
      { id: 'inland', x: 3, y: 3, maritimeRole: 'inland' },
    ],
    primaryClaim: {
      zero: [{ x: 1, y: 1 }],
      high: [{ x: 6, y: 6 }],
      inland: [{ x: 3, y: 3 }],
    },
    lastTradeEpochResult: {
      portTollIncomeCpBySettlementId: { zero: 0, high: 100, inland: 999 },
    },
  }
  const rgba = buildPortTollsOverlayRgba(worldDocument)
  assert.ok(rgba)
  const zeroTint = wealthTintRgb(0)
  const highTint = wealthTintRgb(1)
  assert.strictEqual(rgba[cellOffset(1, 1, 8)], zeroTint[0])
  assert.strictEqual(rgba[cellOffset(1, 1, 8) + 1], zeroTint[1])
  assert.strictEqual(rgba[cellOffset(6, 6, 8)], highTint[0])
  assert.strictEqual(rgba[cellOffset(6, 6, 8) + 1], highTint[1])
  assert.ok(highTint[1] > highTint[0])
  assert.strictEqual(rgba[cellOffset(3, 3, 8) + 3], 0)
})

test('faction tax overlay is zero-centered: payments red, receipts green, zero gray', () => {
  const worldDocument = {
    gridWidth: 4,
    gridHeight: 4,
    settlements: [
      { id: 'payer', x: 0, y: 0 },
      { id: 'zero', x: 1, y: 1 },
      { id: 'collector', x: 3, y: 3 },
    ],
    primaryClaim: {
      payer: [{ x: 0, y: 0 }],
      zero: [{ x: 1, y: 1 }],
      collector: [{ x: 3, y: 3 }],
    },
    lastTradeEpochResult: {
      factionTaxNetCpBySettlementId: { payer: -40, zero: 0, collector: 80 },
    },
  }
  const rgba = buildFactionTaxOverlayRgba(worldDocument)
  assert.ok(rgba)
  const payerTint = wealthTintRgb(-0.5)
  const zeroTint = wealthTintRgb(0)
  const collectorTint = wealthTintRgb(1)
  assert.strictEqual(rgba[cellOffset(0, 0, 4)], payerTint[0])
  assert.strictEqual(rgba[cellOffset(0, 0, 4) + 1], payerTint[1])
  assert.strictEqual(rgba[cellOffset(1, 1, 4)], zeroTint[0])
  assert.strictEqual(rgba[cellOffset(1, 1, 4) + 1], zeroTint[1])
  assert.strictEqual(rgba[cellOffset(3, 3, 4)], collectorTint[0])
  assert.strictEqual(rgba[cellOffset(3, 3, 4) + 1], collectorTint[1])
  assert.ok(payerTint[0] > payerTint[1])
  assert.ok(collectorTint[1] > collectorTint[0])
})

test('commodity price overlay centers on catalog reference price', () => {
  const referenceCp = referencePriceCp('grain')
  const worldDocument = {
    gridWidth: 4,
    gridHeight: 4,
    settlements: [
      { id: 'par', x: 0, y: 0 },
      { id: 'dear', x: 3, y: 3 },
      { id: 'cheap', x: 1, y: 1 },
    ],
    primaryClaim: {
      par: [{ x: 0, y: 0 }],
      dear: [{ x: 3, y: 3 }],
      cheap: [{ x: 1, y: 1 }],
    },
    lastTradeEpochResult: {
      localPricesBySettlementId: {
        par: { grain: referenceCp },
        dear: { grain: referenceCp * 2 },
        cheap: { grain: referenceCp * 0.5 },
      },
    },
  }
  const rgba = buildCommodityPriceOverlayRgba(worldDocument, 'grain')
  assert.ok(rgba)
  const neutralTint = wealthTintRgb(0)
  const highTint = wealthTintRgb(1)
  const lowTint = wealthTintRgb(-0.5)
  assert.strictEqual(rgba[cellOffset(0, 0, 4)], neutralTint[0])
  assert.strictEqual(rgba[cellOffset(0, 0, 4) + 1], neutralTint[1])
  assert.strictEqual(rgba[cellOffset(3, 3, 4)], highTint[0])
  assert.strictEqual(rgba[cellOffset(3, 3, 4) + 1], highTint[1])
  assert.strictEqual(rgba[cellOffset(1, 1, 4)], lowTint[0])
  assert.strictEqual(rgba[cellOffset(1, 1, 4) + 1], lowTint[1])
  assert.ok(highTint[1] > highTint[0])
  assert.ok(lowTint[0] > lowTint[1])
})

test('commodity price overlay skips ruins', () => {
  const worldDocument = {
    gridWidth: 4,
    gridHeight: 4,
    settlements: [
      { id: 'alive', x: 0, y: 0 },
      { id: 'dead', x: 3, y: 3, status: 'ruin' },
    ],
    primaryClaim: {
      alive: [{ x: 0, y: 0 }],
      dead: [{ x: 3, y: 3 }],
    },
    lastTradeEpochResult: {
      localPricesBySettlementId: {
        alive: { grain: 2 },
        dead: { grain: 99 },
      },
    },
  }
  const rgba = buildCommodityPriceOverlayRgba(worldDocument, 'grain')
  assert.ok(rgba)
  assert.ok(rgba[cellOffset(0, 0, 4) + 3] > 0)
  assert.strictEqual(rgba[cellOffset(3, 3, 4) + 3], 0)
})
