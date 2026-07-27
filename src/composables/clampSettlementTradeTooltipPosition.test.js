import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TOOLTIP_ANCHOR_OFFSET,
  TOOLTIP_VIEWPORT_MARGIN,
  clampSettlementTradeTooltipPosition,
} from './clampSettlementTradeTooltipPosition.js'

test('prefers below-right of the anchor when space allows', () => {
  const placed = clampSettlementTradeTooltipPosition({
    anchorX: 100,
    anchorY: 80,
    width: 160,
    height: 200,
    viewportWidth: 800,
    viewportHeight: 600,
  })
  assert.deepEqual(placed, {
    left: 100 + TOOLTIP_ANCHOR_OFFSET,
    top: 80 + TOOLTIP_ANCHOR_OFFSET,
  })
})

test('flips left and above when below-right would overflow', () => {
  const placed = clampSettlementTradeTooltipPosition({
    anchorX: 780,
    anchorY: 560,
    width: 160,
    height: 200,
    viewportWidth: 800,
    viewportHeight: 600,
  })
  assert.deepEqual(placed, {
    left: 780 - TOOLTIP_ANCHOR_OFFSET - 160,
    top: 560 - TOOLTIP_ANCHOR_OFFSET - 200,
  })
})

test('clamps into the viewport when flipped placement still overflows', () => {
  const placed = clampSettlementTradeTooltipPosition({
    anchorX: 10,
    anchorY: 10,
    width: 300,
    height: 400,
    viewportWidth: 200,
    viewportHeight: 200,
    margin: TOOLTIP_VIEWPORT_MARGIN,
  })
  assert.equal(placed.left, TOOLTIP_VIEWPORT_MARGIN)
  assert.equal(placed.top, TOOLTIP_VIEWPORT_MARGIN)
})

test('clamps near the bottom-right corner without leaving the viewport', () => {
  const placed = clampSettlementTradeTooltipPosition({
    anchorX: 190,
    anchorY: 190,
    width: 120,
    height: 80,
    viewportWidth: 200,
    viewportHeight: 200,
  })
  assert.equal(placed.left, 190 - TOOLTIP_ANCHOR_OFFSET - 120)
  assert.equal(placed.top, 190 - TOOLTIP_ANCHOR_OFFSET - 80)
  assert.ok(placed.left >= TOOLTIP_VIEWPORT_MARGIN)
  assert.ok(placed.top >= TOOLTIP_VIEWPORT_MARGIN)
  assert.ok(placed.left + 120 <= 200 - TOOLTIP_VIEWPORT_MARGIN)
  assert.ok(placed.top + 80 <= 200 - TOOLTIP_VIEWPORT_MARGIN)
})
