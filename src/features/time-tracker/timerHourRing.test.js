import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MS_PER_HOUR,
  TIMER_RING_CENTER,
  TIMER_RING_RADIUS,
  ringCircumference,
  ringPoint,
  timerHourRing,
} from './timerHourRing.js'

test('hour ring fills from 12:00 over one hour then stays full', () => {
  assert.deepEqual(timerHourRing(0), {
    fillFraction: 0,
    markerFraction: 0,
    completedHours: 0,
  })
  assert.deepEqual(timerHourRing(MS_PER_HOUR / 2), {
    fillFraction: 0.5,
    markerFraction: 0.5,
    completedHours: 0,
  })
  assert.deepEqual(timerHourRing(MS_PER_HOUR), {
    fillFraction: 1,
    markerFraction: 0,
    completedHours: 1,
  })
  assert.deepEqual(timerHourRing(MS_PER_HOUR * 1.25), {
    fillFraction: 1,
    markerFraction: 0.25,
    completedHours: 1,
  })
  assert.equal(timerHourRing(-10).fillFraction, 0)
})

test('ring points start at 12:00 and travel clockwise', () => {
  assert.deepEqual(ringPoint(0), { x: TIMER_RING_CENTER, y: TIMER_RING_CENTER - TIMER_RING_RADIUS })
  assert.deepEqual(ringPoint(0.25), { x: TIMER_RING_CENTER + TIMER_RING_RADIUS, y: TIMER_RING_CENTER })
  assert.deepEqual(ringPoint(0.5), { x: TIMER_RING_CENTER, y: TIMER_RING_CENTER + TIMER_RING_RADIUS })
  assert.equal(ringCircumference(), 2 * Math.PI * TIMER_RING_RADIUS)
})
