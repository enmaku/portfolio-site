/**
 * Run: node --test src/features/movie-vote/p2p/guestOnlineWire.test.js
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMovieVoteWireState } from './movieVoteWireState.js'
import { createGuestOnlineWire } from './guestOnlineWire.js'

/** @param {object} [overrides] */
function baseDeps(overrides = {}) {
  const wireState = createMovieVoteWireState()
  return {
    wireState,
    roomChild: () => ({}),
    setRtdb: async () => {},
    onDisconnect: () => ({ set: () => Promise.resolve() }),
    onChildAdded: () => () => {},
    onValue: () => () => {},
    trackFeatureUnsub: () => {},
    isHostRole: () => true,
    getSessionPhase: () => 'hosting',
    tryCompileBallot: () => {},
    tryFinishVoting: () => {},
    hostBroadcastState: () => {},
    removeParticipantFromVote: () => {},
    scheduleTimer: (fn) => {
      fn()
      return 0
    },
    cancelTimer: () => {},
    ...overrides,
  }
}

test('scheduleParticipantRemoval calls removeParticipantFromVote after grace when hosting', () => {
  /** @type {string[]} */
  const removed = []
  const deps = baseDeps({
    removeParticipantFromVote: (pid) => removed.push(pid),
  })
  const wire = createGuestOnlineWire(deps)
  deps.wireState.stableIdToParticipant.set('stable-1', 'guest-1')
  deps.wireState.guestDrafts.set('guest-1', { picks: [], ready: true })

  wire.scheduleParticipantRemoval('guest-1')

  assert.deepEqual(removed, ['guest-1'])
  assert.equal(deps.wireState.guestDrafts.has('guest-1'), false)
})

test('scheduleParticipantRemoval skips removal while guest stable id is still online', () => {
  let removed = 0
  const deps = baseDeps({
    removeParticipantFromVote: () => {
      removed += 1
    },
  })
  const wire = createGuestOnlineWire(deps)
  deps.wireState.stableIdToParticipant.set('stable-1', 'guest-1')
  deps.wireState.activeGuestStableIds.add('stable-1')
  deps.wireState.guestDrafts.set('guest-1', { picks: [], ready: true })

  wire.scheduleParticipantRemoval('guest-1')

  assert.equal(removed, 0)
  assert.equal(deps.wireState.guestDrafts.has('guest-1'), true)
})

test('cancelParticipantRemoval clears pending grace timer', () => {
  /** @type {number[]} */
  const cancelled = []
  const deps = baseDeps({
    scheduleTimer: (fn) => {
      void fn
      return 42
    },
    cancelTimer: (id) => cancelled.push(id),
  })
  const wire = createGuestOnlineWire(deps)
  deps.wireState.stableIdToParticipant.set('stable-1', 'guest-1')
  deps.wireState.guestDrafts.set('guest-1', { picks: [], ready: true })

  wire.scheduleParticipantRemoval('guest-1')
  wire.cancelParticipantRemoval('guest-1')

  assert.deepEqual(cancelled, [42])
  assert.equal(deps.wireState.pendingRemovalTimers.has('guest-1'), false)
})
