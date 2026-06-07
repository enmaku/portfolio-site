/**
 * Run: node --test src/features/movie-vote/p2p/guestInboundWire.test.js
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ref } from 'vue'
import { encodeWelcome } from './protocol.js'
import { createGuestInboundWire } from './guestInboundWire.js'

function baseDeps(overrides = {}) {
  return {
    remoteHostTabVisible: ref(true),
    getLastSeenSeq: () => 0,
    setLastSeenSeq: () => {},
    applyPublicPayload: () => {},
    onGuestHostEnded: () => {},
    setMyParticipantId: () => {},
    ...overrides,
  }
}

test('handleGuestWelcome sets participant id via injected callback', () => {
  /** @type {string | null} */
  let captured = null
  const wire = createGuestInboundWire(
    baseDeps({
      setMyParticipantId: (id) => {
        captured = id
      },
    }),
  )

  wire.handleGuestWelcome(encodeWelcome('guest-participant-1', false))
  assert.equal(captured, 'guest-participant-1')
})

test('handleGuestWelcome ignores invalid welcome payloads', () => {
  let callCount = 0
  const wire = createGuestInboundWire(
    baseDeps({
      setMyParticipantId: () => {
        callCount += 1
      },
    }),
  )

  wire.handleGuestWelcome(null)
  wire.handleGuestWelcome({ type: 'mv-wrong' })
  assert.equal(callCount, 0)
})
