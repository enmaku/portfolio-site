import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { reconnectDelayMs } from './reconnect.js'

afterEach(() => {
  mock.restoreAll()
})

test('reconnectDelayMs grows exponentially with attempt index', () => {
  mock.method(Math, 'random', () => 0)

  assert.equal(reconnectDelayMs(0, { baseMs: 100, maxMs: 10_000, jitterMs: 0 }), 100)
  assert.equal(reconnectDelayMs(1, { baseMs: 100, maxMs: 10_000, jitterMs: 0 }), 200)
  assert.equal(reconnectDelayMs(2, { baseMs: 100, maxMs: 10_000, jitterMs: 0 }), 400)
  assert.equal(reconnectDelayMs(3, { baseMs: 100, maxMs: 10_000, jitterMs: 0 }), 800)
})

test('reconnectDelayMs caps exponential growth at maxMs', () => {
  mock.method(Math, 'random', () => 0)

  assert.equal(reconnectDelayMs(5, { baseMs: 800, maxMs: 5000, jitterMs: 0 }), 5000)
  assert.equal(reconnectDelayMs(10, { baseMs: 800, maxMs: 5000, jitterMs: 0 }), 5000)
})

test('reconnectDelayMs caps at the first attempt that would exceed maxMs', () => {
  mock.method(Math, 'random', () => 0)
  const opts = { baseMs: 800, maxMs: 5000, jitterMs: 0 }

  assert.equal(reconnectDelayMs(2, opts), 3200)
  assert.equal(reconnectDelayMs(3, opts), 5000)
})

test('reconnectDelayMs applies deterministic jitter from Math.random', () => {
  mock.method(Math, 'random', () => 0.5)

  assert.equal(reconnectDelayMs(1, { baseMs: 800, maxMs: 5000, jitterMs: 400 }), 1800)
})

test('reconnectDelayMs keeps jitter within configured bounds', () => {
  const opts = { baseMs: 800, maxMs: 5000, jitterMs: 400 }
  const exp = 3200

  mock.method(Math, 'random', () => 0)
  assert.equal(reconnectDelayMs(2, opts), exp)

  mock.restoreAll()
  mock.method(Math, 'random', () => 0.9999999)
  assert.equal(reconnectDelayMs(2, opts), exp + opts.jitterMs - 1)
})

test('reconnectDelayMs jitter stays within bounds for any random draw', () => {
  const attempt = 1
  const opts = { baseMs: 800, maxMs: 5000, jitterMs: 400 }
  const exp = 1600

  for (const fraction of [0, 0.25, 0.5, 0.75, 0.9999999]) {
    mock.restoreAll()
    mock.method(Math, 'random', () => fraction)
    const delay = reconnectDelayMs(attempt, opts)
    assert.ok(delay >= exp)
    assert.ok(delay < exp + opts.jitterMs)
  }
})

test('reconnectDelayMs uses default base, max, and jitter when opts omitted', () => {
  mock.method(Math, 'random', () => 0)

  assert.equal(reconnectDelayMs(0), 800)
  assert.equal(reconnectDelayMs(3), 5000)
})
