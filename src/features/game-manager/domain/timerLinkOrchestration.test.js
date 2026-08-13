import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GM_SESSION_QUERY_KEY,
  buildGameTimerLinkedRoute,
  resolveLinkEntryKind,
  shouldApplyLaunchSeats,
  shouldAutoHost,
  shouldEndRoomOnTakeover,
} from './timerLinkOrchestration.js'

test('resolveLinkEntryKind begins when no active link', () => {
  assert.equal(resolveLinkEntryKind({ active: false, playSessionId: null }, 's1'), 'begin')
  assert.equal(resolveLinkEntryKind(null, 's1'), 'begin')
})

test('resolveLinkEntryKind resumes same play session', () => {
  assert.equal(
    resolveLinkEntryKind({ active: true, playSessionId: 's1' }, 's1'),
    'resume',
  )
})

test('resolveLinkEntryKind takeovers a different active link', () => {
  assert.equal(
    resolveLinkEntryKind({ active: true, playSessionId: 'old' }, 'new'),
    'takeover',
  )
})

test('shouldApplyLaunchSeats only on begin and takeover', () => {
  assert.equal(shouldApplyLaunchSeats('begin'), true)
  assert.equal(shouldApplyLaunchSeats('takeover'), true)
  assert.equal(shouldApplyLaunchSeats('resume'), false)
})

test('shouldEndRoomOnTakeover only when currently hosting', () => {
  assert.equal(shouldEndRoomOnTakeover({ isHosting: true }), true)
  assert.equal(shouldEndRoomOnTakeover({ isHosting: false }), false)
})

test('shouldAutoHost follows last sync posture', () => {
  assert.equal(shouldAutoHost('host'), true)
  assert.equal(shouldAutoHost('local'), false)
})

test('buildGameTimerLinkedRoute includes gmSession query', () => {
  const route = buildGameTimerLinkedRoute({ playSessionId: 'ps-1' })
  assert.equal(route.path, '/projects/game-timer')
  assert.equal(route.query[GM_SESSION_QUERY_KEY], 'ps-1')
})
