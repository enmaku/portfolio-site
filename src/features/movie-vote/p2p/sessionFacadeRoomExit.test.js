/**
 * Movie Vote facade room exit survival contracts — distinct from Game Timer semantics.
 *
 * Run: node --experimental-test-module-mocks --test src/features/movie-vote/p2p/sessionFacadeRoomExit.test.js
 *
 * Unit-level leaveSession contracts live in sessionRoomLifecycle.test.js (no RTDB mocks).
 * This file covers RTDB wire paths and cross-feature survival contrast.
 */
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { HOST_PARTICIPANT_ID } from '../core.js'
import { DEFAULT_VOTING_METHOD } from '../votingMethod.js'
import { useGameTimerStore } from '../../../stores/gameTimer.js'
import { useGameTimerRoomSessionStore } from '../../../stores/gameTimerRoomSession.js'
import { useMovieVoteStore } from '../../../stores/movieVote.js'
import { useMovieVoteRoomSessionStore } from '../../../stores/movieVoteRoomSession.js'
import { encodeState } from './protocol.js'
import { buildMovieVotePublicPayload } from '../publicPayload.js'
import {
  createRtdbLifecycleAfterEach,
  importMovieVoteSession,
  installRtdbLifecycleMocks,
  withFirebaseEnv,
} from './sessionRtdbLifecycleHarness.js'

const facadeRoomExitTests = { skip: !mock.module }
const rtdbAfterEach = createRtdbLifecycleAfterEach(mock)

/** @type {import('../types.js').MovieVotePublicPayload} */
const JOINABLE_SUGGEST_PAYLOAD = buildMovieVotePublicPayload(
  {
    phase: 'suggest',
    readyToVote: false,
    myDraftPicks: [],
    ballotMovies: [],
    ballotOrderIds: [],
    voteProgress: null,
    irvResult: null,
    votingMethod: 'irv',
  },
  new Map(),
)

const JOINABLE_HOST_STATE = encodeState(JOINABLE_SUGGEST_PAYLOAD, 1)

/** @returns {import('../types.js').MoviePick} */
function customPick(localId, title) {
  return {
    localId,
    source: 'custom',
    tmdbId: null,
    customKey: title.toLowerCase(),
    title,
    posterPath: null,
    overview: '',
  }
}

/** @param {string} publicId */
function ballotMovie(publicId) {
  return {
    publicId,
    source: /** @type {const} */ ('custom'),
    tmdbId: null,
    customKey: publicId,
    title: publicId,
    posterPath: null,
    overview: '',
  }
}

/**
 * @param {ReturnType<typeof useMovieVoteStore>} store
 */
function seedCollaborationState(store) {
  store.phase = 'voting'
  store.readyToVote = true
  store.setMyParticipantId('guest-1')
  store.setParticipants([
    { id: HOST_PARTICIPANT_ID, ready: true, pickCount: 2 },
    { id: 'guest-1', ready: true, pickCount: 1 },
  ])
  store.setVotingMethod('borda')
  store.setVotingState(
    [ballotMovie('m-a'), ballotMovie('m-b')],
    ['m-a', 'm-b'],
    [HOST_PARTICIPANT_ID, 'guest-1'],
  )
  store.myRanking = ['m-a', 'm-b']
  store.myVoteSubmitted = true
  store.votesByParticipant = {
    [HOST_PARTICIPANT_ID]: ['m-a', 'm-b'],
    'guest-1': ['m-b', 'm-a'],
  }
  store.voteProgress = { submitted: 2, total: 2 }
  store.uniqueSuggestedMovieCount = 3
  store.phase = 'results'
  store.irvResult = {
    winnerId: 'm-a',
    tieWinnerIds: null,
    rounds: [{ activeIds: ['m-a', 'm-b'], ballotsWithVote: 2, eliminatedIds: [] }],
    votingMethod: 'borda',
  }
}

/**
 * @param {{
 *   phase: { value: string },
 *   suffix: { value: string | null },
 *   room: ReturnType<typeof useMovieVoteRoomSessionStore>,
 *   store: ReturnType<typeof useMovieVoteStore>,
 *   expectedDraftLocalIds?: string[],
 *   expectedFullscreen?: boolean,
 *   expectedRoomSuffix?: string | null,
 * }} ctx
 */
function assertMovieVoteRoomExitSurvival(ctx) {
  assert.equal(ctx.phase.value, 'idle', 'connection posture should be idle after room exit')
  assert.equal(ctx.suffix.value, null, 'session suffix should clear after room exit')
  assert.equal(ctx.room.role, null, 'persisted room role should clear after room exit')
  if (ctx.expectedRoomSuffix === undefined) {
    assert.equal(ctx.room.suffix, null, 'persisted room suffix should clear after room exit')
  } else {
    assert.equal(
      ctx.room.suffix,
      ctx.expectedRoomSuffix,
      'persisted room suffix should match host reuse contract',
    )
  }
  assert.equal(ctx.store.phase, 'suggest', 'collaboration phase should reset to suggest')
  assert.equal(ctx.store.readyToVote, false, 'ready flag should clear after room exit')
  assert.equal(ctx.store.myParticipantId, null, 'participant seat should clear after room exit')
  assert.equal(ctx.store.participants.length, 0, 'participants should clear after room exit')
  assert.equal(ctx.store.ballotMovies.length, 0, 'ballot movies should clear after room exit')
  assert.equal(ctx.store.ballotOrderIds.length, 0, 'ballot order should clear after room exit')
  assert.equal(ctx.store.myVoteSubmitted, false, 'vote submission should clear after room exit')
  assert.equal(ctx.store.voterIds.length, 0, 'voter ids should clear after room exit')
  assert.equal(
    Object.keys(ctx.store.votesByParticipant).length,
    0,
    'votes by participant should clear after room exit',
  )
  assert.equal(ctx.store.myRanking.length, 0, 'personal ranking should clear after room exit')
  assert.equal(ctx.store.irvResult, null, 'election results should clear after room exit')
  assert.equal(ctx.store.voteProgress, null, 'vote progress should clear after room exit')
  assert.equal(
    ctx.store.uniqueSuggestedMovieCount,
    0,
    'suggested movie count should clear after room exit',
  )
  assert.equal(
    ctx.store.votingMethod,
    DEFAULT_VOTING_METHOD,
    'voting method should reset to default after room exit',
  )
  if (ctx.expectedDraftLocalIds) {
    assert.deepEqual(
      ctx.store.myDraftPicks.map((p) => p.localId),
      ctx.expectedDraftLocalIds,
      'personal draft picks should survive room exit',
    )
  }
  if (ctx.expectedFullscreen !== undefined) {
    assert.equal(
      ctx.store.fullscreenEnabled,
      ctx.expectedFullscreen,
      'fullscreen preference should survive room exit',
    )
  }
}

/**
 * @param {Awaited<ReturnType<typeof installRtdbLifecycleMocks>>} harness
 * @param {string} [suffixHint]
 */
function assertDeliberateHostEndWirePaths(harness, suffixHint) {
  const endedWrite = harness.sets.find((s) => s.path.endsWith('/ended'))
  assert.ok(endedWrite, 'deliberate host end should write ended marker')
  if (suffixHint) {
    assert.ok(
      endedWrite.path.includes(suffixHint),
      `ended marker should target room suffix ${suffixHint}`,
    )
  }
  assert.ok(
    typeof endedWrite.value === 'number' && endedWrite.value > 0,
    'ended marker should be a positive timestamp',
  )
  assert.ok(
    harness.removes.some((r) => r.path.endsWith('/hostPing')),
    'deliberate host end should remove hostPing',
  )
}

/**
 * @param {Map<string, (snap: { val: () => unknown }) => void>} listeners
 * @param {string} leaf
 * @returns {(value: unknown) => void}
 */
function listenerAt(listeners, leaf) {
  const path = [...listeners.keys()].find((p) => p.endsWith(leaf))
  assert.ok(path, `expected listener on path ending with ${leaf}`)
  const handler = listeners.get(path)
  assert.ok(handler)
  return (value) => handler({ val: () => value })
}

/**
 * @param {Awaited<ReturnType<typeof importMovieVoteSession>>} sessionMod
 * @param {{ onWireTeardown?: () => void }} [opts]
 */
function bindFacadeHandlers(sessionMod, opts = {}) {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  const room = useMovieVoteRoomSessionStore()
  sessionMod.bindMovieVoteP2PHandlers({
    applyPublicPayload: (payload) => {
      store.applyPublicPayload(payload)
    },
    onWireTeardown: opts.onWireTeardown ?? (() => {}),
  })
  return { store, room }
}

/**
 * @param {{ sets: Array<{ path: string, value: unknown }> }} harness
 */
function activeRtdbSetsClear(harness) {
  harness.sets.length = 0
  harness.removes.length = 0
}

test(
  'host leaveSession writes deliberate end wire paths and resets collaboration',
  facadeRoomExitTests,
  async () => {
    mock.reset()

    const hostStableId = 'MVEXITHOST1'
    const suffix = 'EXIT01'

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
      const sessionMod = await importMovieVoteSession(`host-exit-${Date.now()}`)
      const { startAsHost, leaveSession: hostLeave, sessionPhase, sessionSuffix } = sessionMod
      let teardownCalls = 0
      const { store, room } = bindFacadeHandlers(sessionMod, {
        onWireTeardown: () => {
          teardownCalls += 1
        },
      })

      seedCollaborationState(store)
      store.addDraftPick(customPick('d1', 'Nomination One'))
      store.addDraftPick(customPick('d2', 'Nomination Two'))
      const draftLocalIds = store.myDraftPicks.map((p) => p.localId)
      store.setFullscreenEnabled(true)

      await startAsHost(3)
      assert.equal(sessionPhase.value, 'hosting')
      activeRtdbSetsClear(harness)

      hostLeave()

      assert.equal(teardownCalls, 1, 'room exit should invoke onWireTeardown handler')
      assertDeliberateHostEndWirePaths(harness, suffix)
      assertMovieVoteRoomExitSurvival({
        phase: sessionPhase,
        suffix: sessionSuffix,
        room,
        store,
        expectedDraftLocalIds: draftLocalIds,
        expectedFullscreen: true,
        expectedRoomSuffix: suffix,
      })
    })
  },
)

test(
  'guest RTDB ended marker matches deliberate host end survival contract',
  facadeRoomExitTests,
  async () => {
    mock.reset()
    const harness = await installRtdbLifecycleMocks({
      getHostPing: () => Date.now(),
      getState: () => JOINABLE_HOST_STATE,
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`guest-ended-${Date.now()}`)
      const { joinRoom, sessionPhase, sessionSuffix } = sessionMod
      let teardownCalls = 0
      const { store, room } = bindFacadeHandlers(sessionMod, {
        onWireTeardown: () => {
          teardownCalls += 1
        },
      })

      seedCollaborationState(store)
      store.addDraftPick(customPick('g1', 'Guest nomination'))
      const draftLocalIds = store.myDraftPicks.map((p) => p.localId)
      store.setFullscreenEnabled(true)

      await joinRoom('END123')
      assert.equal(sessionPhase.value, 'guest_connected')

      listenerAt(harness.listeners, 'ended')(1_700_000_000_000)

      assert.equal(teardownCalls, 1, 'host ended room should invoke onWireTeardown handler')
      assertMovieVoteRoomExitSurvival({
        phase: sessionPhase,
        suffix: sessionSuffix,
        room,
        store,
        expectedDraftLocalIds: draftLocalIds,
        expectedFullscreen: true,
      })
    })
  },
)

test(
  'guest leaveSession after join clears persistence and collaboration state',
  facadeRoomExitTests,
  async () => {
    mock.reset()
    await installRtdbLifecycleMocks({
      getHostPing: () => Date.now(),
      getState: () => JOINABLE_HOST_STATE,
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importMovieVoteSession(`guest-leave-${Date.now()}`)
      const { joinRoom, leaveSession: guestLeave, sessionPhase, sessionSuffix } = sessionMod
      let teardownCalls = 0
      const { store, room } = bindFacadeHandlers(sessionMod, {
        onWireTeardown: () => {
          teardownCalls += 1
        },
      })

      seedCollaborationState(store)
      store.addDraftPick(customPick('l1', 'Leaver pick'))
      const draftLocalIds = store.myDraftPicks.map((p) => p.localId)

      await joinRoom('LEAVE1')
      assert.equal(sessionPhase.value, 'guest_connected')

      guestLeave()

      assert.equal(teardownCalls, 1, 'guest leave should invoke onWireTeardown handler')
      assertMovieVoteRoomExitSurvival({
        phase: sessionPhase,
        suffix: sessionSuffix,
        room,
        store,
        expectedDraftLocalIds: draftLocalIds,
      })
    })
  },
)

test(
  'room exit survival clears movie vote collaboration but keeps game timer roster',
  facadeRoomExitTests,
  async () => {
    mock.reset()
    await installRtdbLifecycleMocks({
      getHostPing: () => Date.now(),
      getState: () => JOINABLE_HOST_STATE,
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const mv = await importMovieVoteSession(`mv-exit-contrast-${Date.now()}`)
      let mvTeardownCalls = 0
      const { store: mvStore, room: mvRoom } = bindFacadeHandlers(mv, {
        onWireTeardown: () => {
          mvTeardownCalls += 1
        },
      })

      mvStore.setParticipants([
        { id: HOST_PARTICIPANT_ID, ready: true, pickCount: 2 },
        { id: 'guest-1', ready: false, pickCount: 1 },
      ])
      mvStore.phase = 'voting'
      mvStore.addDraftPick(customPick('c1', 'Contrast pick'))
      const draftLocalIds = mvStore.myDraftPicks.map((p) => p.localId)
      mvRoom.setGuest('MVROOM')
      mv.sessionPhase.value = 'guest_connected'

      mv.leaveSession()

      assert.equal(mvTeardownCalls, 1)
      assertMovieVoteRoomExitSurvival({
        phase: mv.sessionPhase,
        suffix: mv.sessionSuffix,
        room: mvRoom,
        store: mvStore,
        expectedDraftLocalIds: draftLocalIds,
      })

      const gt = await import(`../../game-timer/p2p/session.js?gt-exit-contrast=${Date.now()}`)

      setActivePinia(createPinia())
      const gtStore = useGameTimerStore()
      const gtRoom = useGameTimerRoomSessionStore()
      gtStore.addPlayer({ name: 'Timer Player', color: '#111111' })
      const gtIds = gtStore.players.map((p) => p.id)
      const gtNames = gtStore.players.map((p) => p.name)
      gtRoom.setGuest('GTROOM')
      gt.sessionPhase.value = 'guest_connected'

      gt.bindGameTimerP2PHandlers({
        getSnapshot: () => ({
          players: [],
          activePlayerId: null,
          turnStartedAt: null,
          turnStartedRound: null,
          round: 1,
          playerOrderByRound: {},
        }),
        applySnapshot: () => {},
      })

      gt.leaveSession()

      assert.equal(gt.sessionPhase.value, 'idle')
      assert.equal(gt.sessionSuffix.value, null)
      assert.equal(gtRoom.role, null)
      assert.equal(gtStore.players.length, 1, 'game timer room exit should keep player roster')
      assert.deepEqual(gtStore.players.map((p) => p.id), gtIds)
      assert.deepEqual(gtStore.players.map((p) => p.name), gtNames)
      assert.equal(mvStore.participants.length, 0, 'movie vote room exit should clear participants')
      assert.equal(mvStore.phase, 'suggest')
    })
  },
)

afterEach(rtdbAfterEach)
