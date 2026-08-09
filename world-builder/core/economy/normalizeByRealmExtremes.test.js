import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeAroundAnchor, normalizeByRealmExtremes } from './normalizeByRealmExtremes.js'

test('normalizeByRealmExtremes maps min to -1 and max to 1', () => {
  assert.deepStrictEqual(normalizeByRealmExtremes([10, 20, 30]), [-1, 0, 1])
})

test('normalizeByRealmExtremes maps all-equal cohort to zero', () => {
  assert.deepStrictEqual(normalizeByRealmExtremes([5, 5, 5]), [0, 0, 0])
})

test('normalizeByRealmExtremes returns empty for empty input', () => {
  assert.deepStrictEqual(normalizeByRealmExtremes([]), [])
})

test('normalizeByRealmExtremes treats non-finite values as zero after scale', () => {
  assert.deepStrictEqual(normalizeByRealmExtremes([0, Number.NaN, 100]), [-1, 0, 1])
})

test('normalizeAroundAnchor is zero-centered at the anchor', () => {
  assert.deepStrictEqual(normalizeAroundAnchor([-50, 0, 100], 0), [-0.5, 0, 1])
})

test('normalizeAroundAnchor maps all-at-anchor to zero', () => {
  assert.deepStrictEqual(normalizeAroundAnchor([1, 1, 1], 1), [0, 0, 0])
})

test('normalizeAroundAnchor stretches to living extreme from catalog reference', () => {
  assert.deepStrictEqual(normalizeAroundAnchor([0.5, 1, 2], 1), [-0.5, 0, 1])
})

test('normalizeAroundAnchor defaults anchor to zero', () => {
  assert.deepStrictEqual(normalizeAroundAnchor([-10, 5]), [-1, 0.5])
})
