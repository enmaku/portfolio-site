import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { reconnectDelayMs } from './reconnect.js'
import { starRoomReconnectDelayMs } from './starRoomReconnectDelay.js'
import { RECONNECT_BASE_DELAY_MS, RECONNECT_MAX_DELAY_MS } from './starRoomTiming.js'

afterEach(() => {
  mock.restoreAll()
})

test('starRoomReconnectDelayMs delegates with star-room timing constants', () => {
  mock.method(Math, 'random', () => 0.25)

  const attempt = 2
  const expected = reconnectDelayMs(attempt, {
    baseMs: RECONNECT_BASE_DELAY_MS,
    maxMs: RECONNECT_MAX_DELAY_MS,
  })

  assert.equal(starRoomReconnectDelayMs(attempt), expected)
})

test('starRoomReconnectDelayMs grows exponentially before star-room cap', () => {
  mock.method(Math, 'random', () => 0)

  assert.equal(starRoomReconnectDelayMs(0), RECONNECT_BASE_DELAY_MS)
  assert.equal(starRoomReconnectDelayMs(1), RECONNECT_BASE_DELAY_MS * 2)
  assert.equal(starRoomReconnectDelayMs(2), RECONNECT_BASE_DELAY_MS * 4)
})

test('starRoomReconnectDelayMs caps at star-room max delay', () => {
  mock.method(Math, 'random', () => 0)

  assert.equal(starRoomReconnectDelayMs(3), RECONNECT_MAX_DELAY_MS)
  assert.equal(starRoomReconnectDelayMs(10), RECONNECT_MAX_DELAY_MS)
})

test('starRoomReconnectDelayMs applies deterministic jitter from Math.random', () => {
  mock.method(Math, 'random', () => 0.5)

  const attempt = 1
  const expected = reconnectDelayMs(attempt, {
    baseMs: RECONNECT_BASE_DELAY_MS,
    maxMs: RECONNECT_MAX_DELAY_MS,
  })

  assert.equal(starRoomReconnectDelayMs(attempt), expected)
})

test('starRoomReconnectDelayMs jitter matches generic helper for any random draw', () => {
  const attempt = 2
  const starRoomOpts = {
    baseMs: RECONNECT_BASE_DELAY_MS,
    maxMs: RECONNECT_MAX_DELAY_MS,
  }

  for (const fraction of [0, 0.25, 0.5, 0.75, 0.9999999]) {
    mock.restoreAll()
    mock.method(Math, 'random', () => fraction)
    assert.equal(starRoomReconnectDelayMs(attempt), reconnectDelayMs(attempt, starRoomOpts))
  }
})

test('starRoomReconnectDelayMs stays capped at max with jitter applied', () => {
  mock.method(Math, 'random', () => 0.9999999)
  const attempt = 10
  const starRoomOpts = {
    baseMs: RECONNECT_BASE_DELAY_MS,
    maxMs: RECONNECT_MAX_DELAY_MS,
  }

  const delay = starRoomReconnectDelayMs(attempt)
  assert.equal(delay, reconnectDelayMs(attempt, starRoomOpts))
  assert.ok(delay >= RECONNECT_MAX_DELAY_MS)
})
