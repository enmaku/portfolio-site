import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildLaunchConfigFromPresentPlayers,
  buildLaunchConfigFromTimerExport,
  normalizeTimerExport,
} from './timerHandoff.js'

test('buildLaunchConfigFromPresentPlayers maps present players to ordered seats', () => {
  const config = buildLaunchConfigFromPresentPlayers([
    { recordedPlayerId: 'rp-a', name: 'Ada', color: '#a' },
    { recordedPlayerId: 'rp-b', name: 'Bob', color: '#b' },
  ])
  assert.deepEqual(config, {
    seats: [
      { recordedPlayerId: 'rp-a', name: 'Ada', color: '#a' },
      { recordedPlayerId: 'rp-b', name: 'Bob', color: '#b' },
    ],
  })
})

test('buildLaunchConfigFromTimerExport restores bankedMs and durationMs', () => {
  const config = buildLaunchConfigFromTimerExport({
    durationMs: 12_000,
    seats: [
      { recordedPlayerId: 'rp-a', name: 'Ada', color: '#a', bankedMs: 4_000 },
      { name: 'Guest', color: '#c', bankedMs: 0 },
    ],
  })
  assert.deepEqual(config, {
    durationMs: 12_000,
    seats: [
      { recordedPlayerId: 'rp-a', name: 'Ada', color: '#a', bankedMs: 4_000 },
      { name: 'Guest', color: '#c', bankedMs: 0 },
    ],
  })
})

test('buildLaunchConfigFromTimerExport rejects invalid exports', () => {
  assert.equal(buildLaunchConfigFromTimerExport(null), null)
  assert.equal(buildLaunchConfigFromTimerExport({ durationMs: 1 }), null)
})

test('normalizeTimerExport keeps durationMs and seats with bankedMs', () => {
  const raw = {
    durationMs: 12_000,
    seats: [
      { recordedPlayerId: 'rp-a', name: 'Ada', color: '#a', bankedMs: 4_000 },
      { name: 'Guest', color: '#c', bankedMs: 0 },
    ],
  }
  const normalized = normalizeTimerExport(raw)
  assert.deepEqual(normalized, {
    durationMs: 12_000,
    seats: [
      { recordedPlayerId: 'rp-a', name: 'Ada', color: '#a', bankedMs: 4_000 },
      { name: 'Guest', color: '#c', bankedMs: 0 },
    ],
  })
})

test('normalizeTimerExport rejects invalid payloads', () => {
  assert.equal(normalizeTimerExport(null), null)
  assert.equal(normalizeTimerExport({ durationMs: 'x', seats: [] }), null)
  assert.equal(normalizeTimerExport({ durationMs: 1 }), null)
})
