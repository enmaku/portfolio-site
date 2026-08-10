/**
 * Run: node --experimental-test-module-mocks --test src/features/movie-vote/p2p/sessionFacadeHostInbox.test.js
 *
 * Host inbox domain wire — guest hello participant remap and draft aggregation at the
 * session facade boundary (separate from posture tests).
 */
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { HOST_PARTICIPANT_ID } from '../core.js'
import { useMovieVoteStore } from '../../../stores/movieVote.js'
import { encodeDraft, encodeHello, parseState, parseWelcome } from './protocol.js'
import {
  maxStateSeq,
  parseStateBroadcasts,
  simulateHostInboxMessage,
} from '../../p2p/test/hostInboxHarness.js'
import {
  createRtdbLifecycleAfterEach,
  importMovieVoteSession,
  installRtdbLifecycleMocks,
  withFirebaseEnv,
} from './sessionRtdbLifecycleHarness.js'

const hostInboxTests = { skip: !mock.module }
const rtdbAfterEach = createRtdbLifecycleAfterEach(mock)

/** @param {Array<{ path: string, value: unknown }>} sets */
function mvStateBroadcasts(sets) {
  return parseStateBroadcasts(sets, parseState, 'payload')
}

/** @param {Array<{ path: string, value: unknown }>} sets */
function mvMaxStateSeq(sets) {
  return maxStateSeq(sets, parseState, 'payload')
}

/**
 * @param {Array<{ path: string, value: unknown }>} sets
 * @param {string} guestStableId
 * @returns {Array<{ participantId: string, resumed: boolean }>}
 */
function parseWelcomeWrites(sets, guestStableId) {
  return sets
    .filter((entry) => entry.path.endsWith(`/welcome/${guestStableId}`))
    .map((entry) => {
      const parsed = parseWelcome(entry.value)
      assert.ok(parsed, 'welcome write must be a welcome message')
      return parsed
    })
}

/**
 * @param {ReturnType<typeof useMovieVoteStore>} store
 * @returns {string[]}
 */
function guestParticipantIds(store) {
  return store.participants
    .filter((p) => p.id !== HOST_PARTICIPANT_ID)
    .map((p) => p.id)
}

/**
 * @param {Awaited<ReturnType<typeof importMovieVoteSession>>} sessionMod
 */
function bindHostStoreHandlers(sessionMod) {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  const outbound = sessionMod.bindMovieVoteP2PHandlers({
    applyPublicPayload: (payload) => {
      store.applyPublicPayload(payload)
    },
    onWireTeardown: () => {},
  })
  return { store, outbound }
}

/** @param {ReturnType<typeof bindHostStoreHandlers>['outbound']} outbound */
function hostSyncParticipantsFromRoom(outbound) {
  outbound.hostLocalChanged()
}

test(
  'guest hello remaps participant id via stable client identity on reconnect',
  hostInboxTests,
  async () => {
    mock.reset()

    const hostStableId = 'MVHOSTHELLO1'
    const guestStableId = 'MVGUESTHELLO'
    const suffix = 'HELLO1'

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => hostStableId,
        deriveStableHostSuffix: () => suffix,
      },
    })

    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getEnded: () => null,
      getHostClientId: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`hello-remap-${Date.now()}`)
      const { startAsHost, sessionPhase } = sessionMod
      const { store, outbound } = bindHostStoreHandlers(sessionMod)

      await startAsHost({ participantName: 'Host', maxAttempts: 3 })
      assert.equal(sessionPhase.value, 'hosting')

      const guestOnlineRoot = `movieVoteRooms/${suffix}/guestOnline`

      simulateHostInboxMessage(harness, 'movieVoteRooms', suffix, guestStableId, encodeHello(guestStableId))
      harness.emitChildAdded(guestOnlineRoot, guestStableId)
      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, true)
      hostSyncParticipantsFromRoom(outbound)

      const welcomesAfterFirst = parseWelcomeWrites(harness.sets, guestStableId)
      assert.equal(welcomesAfterFirst.length, 1)
      assert.equal(welcomesAfterFirst[0].resumed, false)
      const firstPid = welcomesAfterFirst[0].participantId
      assert.ok(firstPid)
      assert.deepEqual(guestParticipantIds(store), [firstPid])

      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, false)

      const setsBeforeReconnectHello = harness.sets.length
      simulateHostInboxMessage(harness, 'movieVoteRooms', suffix, guestStableId, encodeHello(guestStableId))
      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, true)
      hostSyncParticipantsFromRoom(outbound)

      const welcomesAfterReconnect = parseWelcomeWrites(
        harness.sets.slice(setsBeforeReconnectHello),
        guestStableId,
      )
      assert.equal(welcomesAfterReconnect.length, 1)
      assert.equal(welcomesAfterReconnect[0].participantId, firstPid)
      assert.equal(welcomesAfterReconnect[0].resumed, true)
      assert.deepEqual(guestParticipantIds(store), [firstPid])
    })
  },
)

test(
  'guest hello allocates a new participant seat when stable client identity has no prior mapping',
  hostInboxTests,
  async () => {
    mock.reset()

    const hostStableId = 'MVHOSTNEW1'
    const guestStableA = 'MVGUESTNEWA'
    const guestStableB = 'MVGUESTNEWB'
    const suffix = 'NEWSEAT1'

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => hostStableId,
        deriveStableHostSuffix: () => suffix,
      },
    })

    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getEnded: () => null,
      getHostClientId: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`hello-new-seat-${Date.now()}`)
      const { startAsHost, sessionPhase } = sessionMod
      const { store, outbound } = bindHostStoreHandlers(sessionMod)

      await startAsHost({ participantName: 'Host', maxAttempts: 3 })
      assert.equal(sessionPhase.value, 'hosting')

      const guestOnlineRoot = `movieVoteRooms/${suffix}/guestOnline`

      simulateHostInboxMessage(harness, 'movieVoteRooms', suffix, guestStableA, encodeHello(guestStableA))
      harness.emitChildAdded(guestOnlineRoot, guestStableA)
      harness.emitValue(`${guestOnlineRoot}/${guestStableA}`, true)
      hostSyncParticipantsFromRoom(outbound)

      const welcomeA = parseWelcomeWrites(harness.sets, guestStableA)
      assert.equal(welcomeA.length, 1)
      assert.equal(welcomeA[0].resumed, false)
      const pidA = welcomeA[0].participantId
      assert.ok(pidA)

      const setsBeforeSecondGuest = harness.sets.length
      simulateHostInboxMessage(harness, 'movieVoteRooms', suffix, guestStableB, encodeHello(guestStableB))
      harness.emitChildAdded(guestOnlineRoot, guestStableB)
      harness.emitValue(`${guestOnlineRoot}/${guestStableB}`, true)
      hostSyncParticipantsFromRoom(outbound)

      const welcomeB = parseWelcomeWrites(harness.sets.slice(setsBeforeSecondGuest), guestStableB)
      assert.equal(welcomeB.length, 1)
      assert.equal(welcomeB[0].resumed, false)
      const pidB = welcomeB[0].participantId
      assert.ok(pidB)
      assert.notEqual(pidA, pidB)
      assert.deepEqual(guestParticipantIds(store).sort(), [pidA, pidB].sort())
    })
  },
)

test(
  'draft inbox aggregates into room authority and rebroadcasts with increasing seq',
  hostInboxTests,
  async () => {
    mock.reset()

    const hostStableId = 'MVHOSTDRAFT1'
    const guestStableId = 'MVGUESTDRAFT'
    const suffix = 'DRAFT1'

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => hostStableId,
        deriveStableHostSuffix: () => suffix,
      },
    })

    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getEnded: () => null,
      getHostClientId: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`draft-agg-${Date.now()}`)
      const { startAsHost, sessionPhase } = sessionMod
      const { store, outbound } = bindHostStoreHandlers(sessionMod)

      await startAsHost({ participantName: 'Host', maxAttempts: 3 })
      assert.equal(sessionPhase.value, 'hosting')
      assert.ok(mvMaxStateSeq(harness.sets) >= 1, 'host start should publish initial room authority')

      const guestOnlineRoot = `movieVoteRooms/${suffix}/guestOnline`

      simulateHostInboxMessage(harness, 'movieVoteRooms', suffix, guestStableId, encodeHello(guestStableId))
      harness.emitChildAdded(guestOnlineRoot, guestStableId)
      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, true)
      hostSyncParticipantsFromRoom(outbound)

      const guestPid = guestParticipantIds(store)[0]
      assert.ok(guestPid)

      const baselineSeq = mvMaxStateSeq(harness.sets)

      const guestPick = {
        localId: 'g1',
        source: 'custom',
        tmdbId: null,
        customKey: 'gamma',
        title: 'Gamma',
        posterPath: null,
        overview: '',
      }

      const setsBeforeDraft = harness.sets.length
      simulateHostInboxMessage(
        harness,
        'movieVoteRooms',
        suffix,
        guestStableId,
        encodeDraft([guestPick], false, guestPid),
      )

      const draftBroadcasts = mvStateBroadcasts(harness.sets.slice(setsBeforeDraft))
      assert.ok(draftBroadcasts.length >= 1, 'draft inbox should rebroadcast room authority')
      const latestDraft = draftBroadcasts[draftBroadcasts.length - 1]
      assert.ok(
        latestDraft.seq > baselineSeq,
        'monotonic authority broadcast seq must increase after draft aggregation',
      )

      const guestRow = latestDraft.payload.participants.find((p) => p.id === guestPid)
      assert.ok(guestRow)
      assert.equal(guestRow.pickCount, 1)
      assert.equal(latestDraft.payload.uniqueSuggestedMovieCount, 1)
    })
  },
)

test(
  'host removeGuestParticipant ejects seat and hello allocates a new seat',
  hostInboxTests,
  async () => {
    mock.reset()

    const hostStableId = 'MVHOSTEJECT1'
    const guestStableId = 'MVGUESTEJECT1'
    const suffix = 'EJECT1'

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => hostStableId,
        deriveStableHostSuffix: () => suffix,
      },
    })

    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getEnded: () => null,
      getHostClientId: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`eject-${Date.now()}`)
      const { startAsHost, sessionPhase, removeGuestParticipant } = sessionMod
      const { store, outbound } = bindHostStoreHandlers(sessionMod)

      await startAsHost({ participantName: 'Host', maxAttempts: 3 })
      assert.equal(sessionPhase.value, 'hosting')

      const guestOnlineRoot = `movieVoteRooms/${suffix}/guestOnline`
      simulateHostInboxMessage(harness, 'movieVoteRooms', suffix, guestStableId, encodeHello(guestStableId))
      harness.emitChildAdded(guestOnlineRoot, guestStableId)
      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, true)
      hostSyncParticipantsFromRoom(outbound)

      const firstPid = guestParticipantIds(store)[0]
      assert.ok(firstPid)

      removeGuestParticipant(firstPid)
      hostSyncParticipantsFromRoom(outbound)
      assert.deepEqual(guestParticipantIds(store), [])

      const setsBefore = harness.sets.length
      simulateHostInboxMessage(harness, 'movieVoteRooms', suffix, guestStableId, encodeHello(guestStableId))
      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, true)
      hostSyncParticipantsFromRoom(outbound)

      const welcomes = parseWelcomeWrites(harness.sets.slice(setsBefore), guestStableId)
      assert.equal(welcomes.length, 1)
      assert.equal(welcomes[0].resumed, false)
      assert.notEqual(welcomes[0].participantId, firstPid)
      assert.deepEqual(guestParticipantIds(store), [welcomes[0].participantId])
    })
  },
)

test(
  'clearGuestParticipants removes all guests and keeps host seat',
  hostInboxTests,
  async () => {
    mock.reset()

    const hostStableId = 'MVHOSTCLEAR1'
    const suffix = 'CLEAR1'

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => hostStableId,
        deriveStableHostSuffix: () => suffix,
      },
    })

    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getEnded: () => null,
      getHostClientId: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`clear-${Date.now()}`)
      const { startAsHost, clearGuestParticipants } = sessionMod
      const { store, outbound } = bindHostStoreHandlers(sessionMod)

      await startAsHost({ participantName: 'Host', maxAttempts: 3 })

      for (const guestStableId of ['GUESTA1', 'GUESTB1']) {
        const guestOnlineRoot = `movieVoteRooms/${suffix}/guestOnline`
        simulateHostInboxMessage(harness, 'movieVoteRooms', suffix, guestStableId, encodeHello(guestStableId))
        harness.emitChildAdded(guestOnlineRoot, guestStableId)
        harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, true)
      }
      hostSyncParticipantsFromRoom(outbound)
      assert.equal(guestParticipantIds(store).length, 2)

      clearGuestParticipants()
      hostSyncParticipantsFromRoom(outbound)
      assert.deepEqual(guestParticipantIds(store), [])
      assert.ok(store.participants.some((p) => p.id === HOST_PARTICIPANT_ID))
    })
  },
)

test(
  'guest hello with taken participant name is rejected without a seat',
  hostInboxTests,
  async () => {
    mock.reset()

    const hostStableId = 'MVHOSTNAME1'
    const suffix = 'NAME01'

    mock.module('../../p2p/identity.js', {
      namedExports: {
        ...(await import('../../p2p/identity.js')),
        getStableClientId: () => hostStableId,
        deriveStableHostSuffix: () => suffix,
      },
    })

    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => null,
      getEnded: () => null,
      getHostClientId: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`name-taken-${Date.now()}`)
      const { startAsHost, sessionPhase } = sessionMod
      const { store, outbound } = bindHostStoreHandlers(sessionMod)

      await startAsHost({ participantName: 'Alex', maxAttempts: 3 })
      assert.equal(sessionPhase.value, 'hosting')

      const guestOnlineRoot = `movieVoteRooms/${suffix}/guestOnline`
      simulateHostInboxMessage(
        harness,
        'movieVoteRooms',
        suffix,
        'GUESTALEX2',
        encodeHello('GUESTALEX2', 'alex'),
      )
      harness.emitChildAdded(guestOnlineRoot, 'GUESTALEX2')
      harness.emitValue(`${guestOnlineRoot}/GUESTALEX2`, true)
      hostSyncParticipantsFromRoom(outbound)

      assert.deepEqual(guestParticipantIds(store), [])
      const rejected = harness.sets.filter((e) => e.path.endsWith('/welcome/GUESTALEX2'))
      assert.ok(rejected.length >= 1)
      assert.equal(rejected[rejected.length - 1].value?.type, 'mv-nr')
    })
  },
)

afterEach(rtdbAfterEach)
