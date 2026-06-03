import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MATCH_OUTCOME_BAND_LOSS_FILL,
  MATCH_OUTCOME_BAND_WIN_FILL,
  outcomeBandFillForValue,
  resolveCategoryBandHorizontalBounds,
} from './dungeonRunnerMatchOutcomeBandsPlugin.js'

test('outcomeBandFillForValue maps win and loss encodings to band colors', () => {
  assert.equal(outcomeBandFillForValue(100), MATCH_OUTCOME_BAND_WIN_FILL)
  assert.equal(outcomeBandFillForValue(0), MATCH_OUTCOME_BAND_LOSS_FILL)
})

test('resolveCategoryBandHorizontalBounds uses chart edges for first and last categories', () => {
  const chartArea = { left: 10, right: 110 }
  const xScale = {
    getPixelForValue(index) {
      return 30 + index * 20
    },
  }
  assert.deepEqual(resolveCategoryBandHorizontalBounds(xScale, 0, 3, chartArea), {
    left: 10,
    right: 40,
  })
  assert.deepEqual(resolveCategoryBandHorizontalBounds(xScale, 2, 3, chartArea), {
    left: 60,
    right: 110,
  })
  assert.deepEqual(resolveCategoryBandHorizontalBounds(xScale, 1, 3, chartArea), {
    left: 40,
    right: 60,
  })
})

test('resolveCategoryBandHorizontalBounds spans full chart area for a single category', () => {
  const chartArea = { left: 5, right: 95 }
  const xScale = { getPixelForValue: () => 50 }
  assert.deepEqual(resolveCategoryBandHorizontalBounds(xScale, 0, 1, chartArea), {
    left: 5,
    right: 95,
  })
})
