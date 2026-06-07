/**
 * Game Timer facade room exit survival contracts — distinct from Movie Vote semantics.
 *
 * Run: node --experimental-test-module-mocks --test src/features/game-timer/p2p/sessionFacadeRoomExit.test.js
 *
 * Unit-level leaveSession / MSG_HOST_ENDED contracts live in sessionRoomLifecycle.test.js
 * (no RTDB mocks). This file covers RTDB wire paths and cross-feature survival contrast.
 */
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { HOST_PARTICIPANT_ID } from '../../movie-vote/core.js'
import { useGameTimerStore } from '../../../stores/gameTimer.js'
import { useGameTimerRoomSessionStore } from '../../../stores/gameTimerRoomSession.js'
import { useMovieVoteStore } from '../../../stores/movieVote.js'
import { useMovieVoteRoomSessionStore } from '../../../stores/movieVoteRoomSession.js'
import { encodeHostSnapshot, MSG_HOST_ENDED } from './protocol.js'
import {
  createRtdbLifecycleAfterEach,
  importGameTimerSession,
  installRtdbLifecycleMocks,
  withFirebaseEnv,
} from './sessionRtdbLifecycleHarness.js'

const facadeRoomExitTests = { skip: !mock.module }
const rtdbAfterEach = createRtdbLifecycleAfterEach(mock)

/** @type {import('../types.js').GameTimerSyncPayload} */
const JOINABLE_HOST_STATE = encodeHostSnapshot(
  {
    players: [{ id: 'p1', name: 'Host', color: '#111111' }],
    activePlayerId: 'p1',
    turnStartedAt: null,
    turnStartedRound: null,
    round: 1,
    playerOrderByRound: {},
  },
  1,
)

/**
 * @param {{
 *   phase: { value: string },
 *   suffix: { value: string | null },
 *   room: ReturnType<typeof useGameTimerRoomSessionStore>,
 *   store: ReturnType<typeof useGameTimerStore>,
 *   expectedCount: number,
 *   expectedIds?: string[],
 *   expectedNames?: string[],
 *   expectedSessionOptions?: {
 *     hardPassEnabled: boolean,
 *     hardPassOrderNextRound: boolean,
 *     fullscreenEnabled: boolean,
 *     timingStripMode: string,
 *   },
 * }} ctx
 */
function assertGameTimerRoomExitSurvival(ctx) {
  assert.equal(ctx.phase.value, 'idle', 'connection posture should be idle after room exit')
  assert.equal(ctx.suffix.value, null, 'session suffix should clear after room exit')
  assert.equal(ctx.room.role, null, 'persisted room role should clear after room exit')
  assert.equal(ctx.room.suffix, null, 'persisted room suffix should clear after room exit')
  assert.equal(ctx.store.players.length, ctx.expectedCount, 'player roster should survive room exit')
  if (ctx.expectedIds) {
    assert.deepEqual(
      ctx.store.players.map((p) => p.id),
      ctx.expectedIds,
      'player roster ids should be unchanged',
    )
  }
  if (ctx.expectedNames) {
    assert.deepEqual(
      ctx.store.players.map((p) => p.name),
      ctx.expectedNames,
      'player roster names should be unchanged',
    )
  }
  if (ctx.expectedSessionOptions) {
    const o = ctx.expectedSessionOptions
    assert.equal(ctx.store.hardPassEnabled, o.hardPassEnabled, 'hardPassEnabled should survive room exit')
    assert.equal(
      ctx.store.hardPassOrderNextRound,
      o.hardPassOrderNextRound,
      'hardPassOrderNextRound should survive room exit',
    )
    assert.equal(ctx.store.fullscreenEnabled, o.fullscreenEnabled, 'fullscreenEnabled should survive room exit')
    assert.equal(ctx.store.timingStripMode, o.timingStripMode, 'timingStripMode should survive room exit')
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
 * @param {Awaited<ReturnType<typeof importGameTimerSession>>} sessionMod
 */
function bindFacadeHandlers(sessionMod) {
  sessionMod.bindGameTimerP2PHandlers({
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
}

test(
  'host leaveSession writes deliberate end wire paths and keeps roster',
  facadeRoomExitTests,
  async () => {
    mock.reset()

    const hostStableId = 'GTEXITHOST1'
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
      const sessionMod = await importGameTimerSession(`host-exit-${Date.now()}`)
      const { startAsHost, leaveSession: hostLeave, sessionPhase, sessionSuffix } = sessionMod
      bindFacadeHandlers(sessionMod)

      setActivePinia(createPinia())
      const store = useGameTimerStore()
      const room = useGameTimerRoomSessionStore()
      store.addPlayer({ name: 'Facilitator', color: '#aaaaaa' })
      store.addPlayer({ name: 'Player Two', color: '#bbbbbb' })
      const ids = store.players.map((p) => p.id)
      const names = store.players.map((p) => p.name)
      store.setHardPassEnabled(true)
      store.setHardPassOrderNextRound(true)
      store.setFullscreenEnabled(true)
      store.setTimingStripMode('non-player')
      const sessionOptions = {
        hardPassEnabled: true,
        hardPassOrderNextRound: true,
        fullscreenEnabled: true,
        timingStripMode: 'non-player',
      }

      await startAsHost(3)
      assert.equal(sessionPhase.value, 'hosting')
      activeRtdbSetsClear(harness)

      hostLeave()

      assertDeliberateHostEndWirePaths(harness, suffix)
      assertGameTimerRoomExitSurvival({
        phase: sessionPhase,
        suffix: sessionSuffix,
        room,
        store,
        expectedCount: 2,
        expectedIds: ids,
        expectedNames: names,
        expectedSessionOptions: sessionOptions,
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
      const sessionMod = await importGameTimerSession(`guest-ended-${Date.now()}`)
      const { joinRoom, sessionPhase, sessionSuffix } = sessionMod
      bindFacadeHandlers(sessionMod)

      setActivePinia(createPinia())
      const store = useGameTimerStore()
      const room = useGameTimerRoomSessionStore()
      store.addPlayer({ name: 'Guest', color: '#444444' })
      const ids = store.players.map((p) => p.id)
      const names = store.players.map((p) => p.name)

      await joinRoom('END123')
      assert.equal(sessionPhase.value, 'guest_connected')

      listenerAt(harness.listeners, 'ended')(1_700_000_000_000)

      assertGameTimerRoomExitSurvival({
        phase: sessionPhase,
        suffix: sessionSuffix,
        room,
        store,
        expectedCount: 1,
        expectedIds: ids,
        expectedNames: names,
      })
    })
  },
)

test(
  'guest leaveSession after join clears persistence and keeps roster',
  facadeRoomExitTests,
  async () => {
    mock.reset()
    await installRtdbLifecycleMocks({
      getHostPing: () => Date.now(),
      getState: () => JOINABLE_HOST_STATE,
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const sessionMod = await importGameTimerSession(`guest-leave-${Date.now()}`)
      const { joinRoom, leaveSession: guestLeave, sessionPhase, sessionSuffix } = sessionMod
      bindFacadeHandlers(sessionMod)

      setActivePinia(createPinia())
      const store = useGameTimerStore()
      const room = useGameTimerRoomSessionStore()
      store.addPlayer({ name: 'Leaver', color: '#555555' })
      const ids = store.players.map((p) => p.id)
      const names = store.players.map((p) => p.name)

      await joinRoom('LEAVE1')
      assert.equal(sessionPhase.value, 'guest_connected')

      guestLeave()

      assertGameTimerRoomExitSurvival({
        phase: sessionPhase,
        suffix: sessionSuffix,
        room,
        store,
        expectedCount: 1,
        expectedIds: ids,
        expectedNames: names,
      })
    })
  },
)

test(
  'room exit survival keeps game timer roster but clears movie vote participants',
  facadeRoomExitTests,
  async () => {
    mock.reset()
    await installRtdbLifecycleMocks({
      getHostPing: () => Date.now(),
      getState: () => JOINABLE_HOST_STATE,
      getEnded: () => null,
    })

    await withFirebaseEnv(async () => {
      const gt = await importGameTimerSession(`gt-exit-contrast-${Date.now()}`)
      bindFacadeHandlers(gt)

      setActivePinia(createPinia())
      const gtStore = useGameTimerStore()
      const gtRoom = useGameTimerRoomSessionStore()
      gtStore.addPlayer({ name: 'Timer Player', color: '#111111' })
      const gtIds = gtStore.players.map((p) => p.id)
      const gtNames = gtStore.players.map((p) => p.name)

      await gt.joinRoom('GTROOM')
      assert.equal(gt.sessionPhase.value, 'guest_connected')

      gt.handleGuestInbound({ type: MSG_HOST_ENDED })

      assertGameTimerRoomExitSurvival({
        phase: gt.sessionPhase,
        suffix: gt.sessionSuffix,
        room: gtRoom,
        store: gtStore,
        expectedCount: 1,
        expectedIds: gtIds,
        expectedNames: gtNames,
      })

      const mv = await import(`../../movie-vote/p2p/session.js?mv-exit-contrast=${Date.now()}`)

      setActivePinia(createPinia())
      const mvStore = useMovieVoteStore()
      const mvRoom = useMovieVoteRoomSessionStore()
      mvStore.setParticipants([
        { id: HOST_PARTICIPANT_ID, ready: true, pickCount: 2 },
        { id: 'guest-1', ready: false, pickCount: 1 },
      ])
      mvStore.phase = 'voting'
      mvRoom.setGuest('MVROOM')
      mv.sessionPhase.value = 'guest_connected'

      mv.leaveSession()

      assert.equal(mv.sessionPhase.value, 'idle')
      assert.equal(mvRoom.role, null)
      assert.equal(mvStore.participants.length, 0, 'movie vote room exit should clear participants')
      assert.equal(mvStore.phase, 'suggest')
    })
  },
)

/**
 * @param {{ sets: Array<{ path: string, value: unknown }> }} harness
 */
function activeRtdbSetsClear(harness) {
  harness.sets.length = 0
  harness.removes.length = 0
}

afterEach(rtdbAfterEach)
