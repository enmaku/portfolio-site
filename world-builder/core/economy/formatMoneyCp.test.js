import assert from 'node:assert/strict'
import test from 'node:test'
import { CP_PER_GP, CP_PER_SP } from './commodityCatalog.js'
import { formatCommodityPriceCp, formatMoneyCp, roundMoneyCp } from './formatMoneyCp.js'

test('roundMoneyCp uses whole copper pieces and kills signed zero', () => {
  assert.equal(roundMoneyCp(1.4), 1)
  assert.equal(roundMoneyCp(1.5), 2)
  assert.equal(roundMoneyCp(-0.4), 0)
  assert.equal(roundMoneyCp(-1e-12), 0)
  assert.equal(Object.is(roundMoneyCp(-0.1), -0), false)
})

test('formatMoneyCp uses gp / sp / cp thresholds', () => {
  assert.strictEqual(formatMoneyCp(5), '5 cp')
  assert.strictEqual(formatMoneyCp(25), '2.5 sp')
  assert.strictEqual(formatMoneyCp(250), '2.5 gp')
})

test('formatMoneyCp does not render signed zero from float dust', () => {
  assert.strictEqual(formatMoneyCp(-1e-15), '0 cp')
  assert.strictEqual(formatMoneyCp(-0.004), '0 cp')
  assert.strictEqual(formatMoneyCp(-0), '0 cp')
})

test('formatMoneyCp compact abbreviates thousands and millions', () => {
  assert.strictEqual(formatMoneyCp(1_177_945.33 * CP_PER_GP, { compact: true }), '1.18M gp')
  assert.strictEqual(formatMoneyCp(-10_813.93 * CP_PER_GP, { compact: true }), '-10.81k gp')
  assert.strictEqual(formatMoneyCp(812.5 * CP_PER_GP, { compact: true }), '812.5 gp')
  assert.strictEqual(formatMoneyCp(1.44, { compact: true }), '1.44 cp')
})

test('formatCommodityPriceCp appends catalog units', () => {
  assert.strictEqual(formatCommodityPriceCp(5, 'salt', { compact: true }), '5 cp/lb')
  assert.strictEqual(formatCommodityPriceCp(CP_PER_SP, 'baseMetals', { compact: true }), '1 sp/lb')
  assert.strictEqual(
    formatCommodityPriceCp(5000 * CP_PER_GP, 'diamonds', { compact: true }),
    '5k gp/gem',
  )
  assert.strictEqual(formatCommodityPriceCp(0.5, 'timber', { compact: true }), '0.5 cp/lb')
})
