import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatCardinalWindDirection,
  formatPrevailingWindDisplay,
  normalizeWindDegreesForDisplay,
} from './formatPrevailingWind.js'

test('normalizeWindDegreesForDisplay wraps to 0-359', () => {
  assert.strictEqual(normalizeWindDegreesForDisplay(0), 0)
  assert.strictEqual(normalizeWindDegreesForDisplay(359.6), 0)
  assert.strictEqual(normalizeWindDegreesForDisplay(-90), 270)
})

test('formatCardinalWindDirection maps cardinal bearings', () => {
  assert.strictEqual(formatCardinalWindDirection(0), 'N')
  assert.strictEqual(formatCardinalWindDirection(90), 'E')
  assert.strictEqual(formatCardinalWindDirection(180), 'S')
  assert.strictEqual(formatCardinalWindDirection(270), 'W')
  assert.strictEqual(formatCardinalWindDirection(122), 'ESE')
})

test('formatPrevailingWindDisplay includes degrees and label', () => {
  assert.strictEqual(formatPrevailingWindDisplay(122), '122° ESE')
  assert.strictEqual(formatPrevailingWindDisplay(270), '270° W')
})
