import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_TIMER_COLOR, normalizeTimerColor, timerAccentVars } from './timerAccent.js'

test('normalizeTimerColor defaults to orange and lowercases valid hex', () => {
  assert.equal(normalizeTimerColor(undefined), DEFAULT_TIMER_COLOR)
  assert.equal(normalizeTimerColor('not-a-color'), DEFAULT_TIMER_COLOR)
  assert.equal(normalizeTimerColor('#fff'), DEFAULT_TIMER_COLOR)
  assert.equal(normalizeTimerColor('#5C6BC0'), '#5c6bc0')
  assert.equal(normalizeTimerColor('26a69a'), '#26a69a')
  assert.equal(normalizeTimerColor('#5c6bc0ff'), '#5c6bc0')
})

test('timerAccentVars uses the chosen hex as the button fill', () => {
  const vars = timerAccentVars('#5c6bc0', true)
  assert.equal(vars['--tt-accent-btn'], '#5c6bc0')
  assert.match(vars['--tt-accent-track'], /^rgba\(92, 107, 192, /)
  assert.equal(vars['--tt-accent-ink'], '#fff4e5')
})

test('timerAccentVars uses dark ink on a light button color', () => {
  const vars = timerAccentVars('#ffe082', false)
  assert.equal(vars['--tt-accent-ink'], '#3e2723')
})
