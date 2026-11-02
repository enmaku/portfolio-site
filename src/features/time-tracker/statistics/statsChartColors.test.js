import assert from 'node:assert/strict'
import test from 'node:test'
import { STATS_CHART_COLORS, statsRowColor } from './statsChartColors.js'

test('statsRowColor walks the palette from the given offset', () => {
  assert.equal(statsRowColor(0), STATS_CHART_COLORS[0])
  assert.equal(statsRowColor(3, 4), STATS_CHART_COLORS[7])
})

test('statsRowColor wraps once the palette runs out', () => {
  assert.equal(statsRowColor(0, STATS_CHART_COLORS.length), STATS_CHART_COLORS[0])
  assert.equal(statsRowColor(2, STATS_CHART_COLORS.length - 1), STATS_CHART_COLORS[1])
})

test('client colors avoid project colors while the palette has room', () => {
  const projectCount = 4
  const projectColors = Array.from({ length: projectCount }, (_, index) => statsRowColor(index))
  const clientColors = Array.from({ length: 3 }, (_, index) => statsRowColor(index, projectCount))
  for (const color of clientColors) assert.ok(!projectColors.includes(color))
})
