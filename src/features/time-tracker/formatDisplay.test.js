import assert from 'node:assert/strict'
import test from 'node:test'
import {
  centsToUsdInput,
  formatLocalDateTimeLabel,
  parseLocalDateTimeInput,
  toLocalDateTimeInput,
  usdInputToCents,
} from './formatDisplay.js'

test('parseLocalDateTimeInput reads wall time from the local input string', () => {
  const ms = parseLocalDateTimeInput('2026-08-17T10:10')
  const date = new Date(ms)
  assert.equal(date.getFullYear(), 2026)
  assert.equal(date.getMonth(), 7)
  assert.equal(date.getDate(), 17)
  assert.equal(date.getHours(), 10)
  assert.equal(date.getMinutes(), 10)
})

test('toLocalDateTimeInput round-trips with parseLocalDateTimeInput', () => {
  const ms = new Date(2026, 7, 17, 10, 10).getTime()
  assert.equal(toLocalDateTimeInput(ms), '2026-08-17T10:10')
  assert.equal(parseLocalDateTimeInput(toLocalDateTimeInput(ms)), ms)
})

test('usdInputToCents and centsToUsdInput round-trip blank and zero', () => {
  assert.equal(usdInputToCents(''), null)
  assert.equal(usdInputToCents('12.50'), 1_250)
  assert.equal(usdInputToCents('0'), 0)
  assert.equal(centsToUsdInput(null), '')
  assert.equal(centsToUsdInput(0), '0.00')
  assert.equal(centsToUsdInput(1_250), '12.50')
})

test('formatLocalDateTimeLabel is a 12-hour label without a T separator', () => {
  const label = formatLocalDateTimeLabel('2026-08-17T22:05')
  assert.equal(label.includes('T'), false)
  assert.match(label, /PM/)
  assert.match(label, /10:05/)
})
