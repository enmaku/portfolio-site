/**
 * Run: node --experimental-test-module-mocks --test src/features/movie-vote/p2p/sessionFacadeVoteAuthority.test.js
 *
 * Host inbox vote validation and election results-entry authority at the session
 * facade boundary (separate from posture and guest inbound domain wire tests).
 */
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { HOST_PARTICIPANT_ID } from '../core.js'
import { runElection } from '../election.js'
import { useMovieVoteStore } from '../../../stores/movieVote.js'
import { encodeHello, encodeState, encodeVote, MSG_MV_DRAFT, parseState, encodeWelcome } from './protocol.js'
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

const voteAuthorityTests = { skip: !mock.module }
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

/**
 * @param {ReturnType<typeof installRtdbLifecycleMocks> extends Promise<infer T> ? T : never} harness
 * @param {string} suffix
 * @param {string} guestStableId
 * @param {Awaited<ReturnType<typeof importMovieVoteSession>>} sessionMod
 */
async function bootstrapHostVotingWithGuest(harness, suffix, guestStableId, sessionMod) {
  const { startAsHost, sessionPhase } = sessionMod
  const { store, outbound } = bindHostStoreHandlers(sessionMod)

  await startAsHost(3)
  assert.equal(sessionPhase.value, 'hosting')

  store.addDraftPick({
    localId: 'h1',
    source: 'custom',
    tmdbId: null,
    customKey: 'alpha',
    title: 'Alpha',
    posterPath: null,
    overview: '',
  })
  store.addDraftPick({
    localId: 'h2',
    source: 'custom',
    tmdbId: null,
    customKey: 'beta',
    title: 'Beta',
    posterPath: null,
    overview: '',
  })

  const guestOnlineRoot = `movieVoteRooms/${suffix}/guestOnline`

  simulateHostInboxMessage(harness, 'movieVoteRooms', suffix, guestStableId, encodeHello(guestStableId))
  harness.emitChildAdded(guestOnlineRoot, guestStableId)
  harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, true)
  hostSyncParticipantsFromRoom(outbound)

  const guestPid = guestParticipantIds(store)[0]
  assert.ok(guestPid)

  simulateHostInboxMessage(harness, 'movieVoteRooms', suffix, guestStableId, {
    v: 1,
    type: MSG_MV_DRAFT,
    participantId: guestPid,
    ready: true,
  })

  store.setReadyToVote(true)
  hostSyncParticipantsFromRoom(outbound)

  assert.equal(store.phase, 'voting')
  assert.ok(store.ballotOrderIds.length >= 2)

  return { store, outbound, guestPid, ballotOrderIds: [...store.ballotOrderIds] }
}

test(
  'valid vote during voting phase merges into authority and advances broadcast seq',
  voteAuthorityTests,
  async () => {
    mock.reset()

    const hostStableId = 'MVHOSTVOTE1'
    const guestStableId = 'MVGUESTVOTE1'
    const suffix = 'VOTEOK1'

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
      const sessionMod = await importMovieVoteSession(`vote-valid-${Date.now()}`)
      const { store, guestPid, ballotOrderIds } = await bootstrapHostVotingWithGuest(
        harness,
        suffix,
        guestStableId,
        sessionMod,
      )

      const baselineSeq = mvMaxStateSeq(harness.sets)
      const setsBeforeVote = harness.sets.length

      simulateHostInboxMessage(
        harness,
        'movieVoteRooms',
        suffix,
        guestStableId,
        encodeVote(guestPid, ballotOrderIds),
      )

      const voteBroadcasts = mvStateBroadcasts(harness.sets.slice(setsBeforeVote))
      assert.ok(voteBroadcasts.length >= 1, 'valid vote should rebroadcast room authority')
      const latest = voteBroadcasts[voteBroadcasts.length - 1]
      assert.ok(latest.seq > baselineSeq, 'monotonic authority broadcast seq must increase after vote merge')
      assert.equal(latest.payload.phase, 'voting')
      assert.equal(latest.payload.voteProgress?.submitted, 1)
      assert.equal(latest.payload.voteProgress?.total, 2)
      assert.ok(guestPid in store.votesByParticipant)
      assert.deepEqual(store.votesByParticipant[guestPid], ballotOrderIds)
    })
  },
)

test(
  'vote outside voting phase is rejected without tally corruption',
  voteAuthorityTests,
  async () => {
    mock.reset()

    const hostStableId = 'MVHOSTPHASE1'
    const guestStableId = 'MVGUESTPHASE'
    const suffix = 'VOTEPH1'

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
      const sessionMod = await importMovieVoteSession(`vote-phase-${Date.now()}`)
      const { startAsHost, sessionPhase } = sessionMod
      const { store, outbound } = bindHostStoreHandlers(sessionMod)

      await startAsHost(3)
      assert.equal(sessionPhase.value, 'hosting')
      assert.equal(store.phase, 'suggest')

      const guestOnlineRoot = `movieVoteRooms/${suffix}/guestOnline`

      simulateHostInboxMessage(harness, 'movieVoteRooms', suffix, guestStableId, encodeHello(guestStableId))
      harness.emitChildAdded(guestOnlineRoot, guestStableId)
      harness.emitValue(`${guestOnlineRoot}/${guestStableId}`, true)
      hostSyncParticipantsFromRoom(outbound)

      const guestPid = guestParticipantIds(store)[0]
      assert.ok(guestPid)

      const baselineSeq = mvMaxStateSeq(harness.sets)
      const setsBeforeVote = harness.sets.length

      simulateHostInboxMessage(
        harness,
        'movieVoteRooms',
        suffix,
        guestStableId,
        encodeVote(guestPid, ['fake-a', 'fake-b']),
      )

      const strayBroadcasts = mvStateBroadcasts(harness.sets.slice(setsBeforeVote))
      assert.equal(strayBroadcasts.length, 0, 'suggest-phase vote must not rebroadcast authority')
      assert.equal(mvMaxStateSeq(harness.sets), baselineSeq)
      assert.equal(Object.keys(store.votesByParticipant).length, 0)
      assert.equal(store.phase, 'suggest')
    })
  },
)

test(
  'invalid ranking shape is rejected without tally corruption',
  voteAuthorityTests,
  async () => {
    mock.reset()

    const hostStableId = 'MVHOSTBAD1'
    const guestStableId = 'MVGUESTBAD1'
    const suffix = 'VOTEBAD1'

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
      const sessionMod = await importMovieVoteSession(`vote-invalid-${Date.now()}`)
      const { store, guestPid, ballotOrderIds, outbound } = await bootstrapHostVotingWithGuest(
        harness,
        suffix,
        guestStableId,
        sessionMod,
      )

      /** @type {string[][]} */
      const invalidRankings = [
        ballotOrderIds.slice(0, -1),
        [...ballotOrderIds, 'extra-id'],
        [ballotOrderIds[0], ballotOrderIds[0]],
        ['not-on-ballot', ...ballotOrderIds.slice(1)],
      ]

      for (const ranking of invalidRankings) {
        const baselineSeq = mvMaxStateSeq(harness.sets)
        const setsBefore = harness.sets.length

        simulateHostInboxMessage(harness, 'movieVoteRooms', suffix, guestStableId, encodeVote(guestPid, ranking))

        const broadcasts = mvStateBroadcasts(harness.sets.slice(setsBefore))
        assert.equal(broadcasts.length, 0, `invalid ranking must not rebroadcast (${ranking.join(',')})`)
        assert.equal(mvMaxStateSeq(harness.sets), baselineSeq)
        assert.equal(Object.keys(store.votesByParticipant).length, 0)
        assert.equal(store.voteProgress?.submitted, 0)
      }

      const validSeq = mvMaxStateSeq(harness.sets)
      const setsBeforeValid = harness.sets.length
      simulateHostInboxMessage(
        harness,
        'movieVoteRooms',
        suffix,
        guestStableId,
        encodeVote(guestPid, ballotOrderIds),
      )
      const validBroadcasts = mvStateBroadcasts(harness.sets.slice(setsBeforeValid))
      assert.ok(validBroadcasts.length >= 1, 'valid vote after rejects should still merge')
      assert.ok(validBroadcasts[validBroadcasts.length - 1].seq > validSeq)
      assert.equal(store.voteProgress?.submitted, 1)

      store.submitMyVoteLocal([...ballotOrderIds])
      outbound.hostAfterVoteSubmit()
      const resultsBroadcast = mvStateBroadcasts(harness.sets).find((b) => b.payload.phase === 'results')
      assert.ok(resultsBroadcast, 'complete valid votes commit via hostAfterVoteSubmit path')
    })
  },
)

/**
 * @param {Awaited<ReturnType<typeof importMovieVoteSession>>} sessionMod
 * @param {string[]} ballotOrderIds
 */
function bindGuestMirrorHandlers(sessionMod, ballotOrderIds) {
  setActivePinia(createPinia())
  const store = useMovieVoteStore()
  /** @type {import('../types.js').MovieVotePublicPayload | null} */
  let mirror = null

  sessionMod.bindMovieVoteP2PHandlers({
    applyPublicPayload: (payload) => {
      mirror = structuredClone(payload)
    },
    onWireTeardown: () => {},
  })

  const votingPayload = {
    phase: /** @type {const} */ ('voting'),
    participants: [
      { id: HOST_PARTICIPANT_ID, ready: true, pickCount: 2 },
      { id: 'guest-seat-1', ready: true, pickCount: 0 },
    ],
    ballotMovies: ballotOrderIds.map((id) => ({
      publicId: id,
      source: /** @type {const} */ ('custom'),
      tmdbId: null,
      customKey: id,
      title: id,
      posterPath: null,
      overview: '',
    })),
    ballotOrderIds: [...ballotOrderIds],
    voteProgress: { submitted: 0, total: 2 },
    electionOutcome: null,
    uniqueSuggestedMovieCount: 0,
    votingMethod: /** @type {const} */ ('irv'),
  }

  sessionMod.handleGuestInbound(encodeWelcome('guest-seat-1', true))
  sessionMod.handleGuestInbound(encodeState(votingPayload, 1))
  store.setMyParticipantId('guest-seat-1')
  store.phase = 'voting'
  store.ballotOrderIds = [...ballotOrderIds]
  store.myRanking = [...ballotOrderIds]

  return {
    get mirror() {
      return mirror
    },
    store,
    sessionMod,
  }
}

test(
  'mismatched participant id in vote is rejected without tally corruption',
  voteAuthorityTests,
  async () => {
    mock.reset()

    const hostStableId = 'MVHOSTPID1'
    const guestStableId = 'MVGUESTPID1'
    const suffix = 'VOTEPID1'

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
      const sessionMod = await importMovieVoteSession(`vote-pid-${Date.now()}`)
      const { store, guestPid, ballotOrderIds } = await bootstrapHostVotingWithGuest(
        harness,
        suffix,
        guestStableId,
        sessionMod,
      )

      const baselineSeq = mvMaxStateSeq(harness.sets)
      const setsBefore = harness.sets.length

      simulateHostInboxMessage(
        harness,
        'movieVoteRooms',
        suffix,
        guestStableId,
        encodeVote(`${guestPid}-spoof`, ballotOrderIds),
      )

      const broadcasts = mvStateBroadcasts(harness.sets.slice(setsBefore))
      assert.equal(broadcasts.length, 0, 'mismatched participant id must not rebroadcast authority')
      assert.equal(mvMaxStateSeq(harness.sets), baselineSeq)
      assert.equal(Object.keys(store.votesByParticipant).length, 0)
      assert.equal(store.voteProgress?.submitted, 0)
    })
  },
)

test(
  'vote from participant not in voterIds is rejected without tally corruption',
  voteAuthorityTests,
  async () => {
    mock.reset()

    const hostStableId = 'MVHOSTVOT1'
    const guestStableId = 'MVGUESTVOT1'
    const suffix = 'VOTEVOT1'

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
      const sessionMod = await importMovieVoteSession(`vote-voter-${Date.now()}`)
      const { store, guestPid, ballotOrderIds } = await bootstrapHostVotingWithGuest(
        harness,
        suffix,
        guestStableId,
        sessionMod,
      )

      store.removeParticipantFromVote(guestPid)
      assert.ok(!store.voterIds.includes(guestPid))

      const baselineSeq = mvMaxStateSeq(harness.sets)
      const setsBefore = harness.sets.length

      simulateHostInboxMessage(
        harness,
        'movieVoteRooms',
        suffix,
        guestStableId,
        encodeVote(guestPid, ballotOrderIds),
      )

      const broadcasts = mvStateBroadcasts(harness.sets.slice(setsBefore))
      assert.equal(broadcasts.length, 0, 'departed voter vote must not rebroadcast authority')
      assert.equal(mvMaxStateSeq(harness.sets), baselineSeq)
      assert.equal(Object.keys(store.votesByParticipant).length, 0)
      assert.equal(store.voteProgress?.submitted, 0)
    })
  },
)

test(
  'guest local election recompute does not become mirror authority truth',
  voteAuthorityTests,
  async () => {
    mock.reset()

    const ballotOrderIds = ['m_a', 'm_b']
    const guestWire = bindGuestMirrorHandlers(
      await importMovieVoteSession(`vote-guest-local-${Date.now()}`),
      ballotOrderIds,
    )

    assert.equal(guestWire.mirror?.phase, 'voting')
    assert.equal(guestWire.mirror?.electionOutcome, null)

    const forgedLocal = runElection(
      'irv',
      [[ballotOrderIds[1], ballotOrderIds[0]], [ballotOrderIds[1], ballotOrderIds[0]]],
      ballotOrderIds,
    )
    guestWire.store.setElectionOutcome(forgedLocal)

    assert.equal(guestWire.store.phase, 'results')
    assert.ok(guestWire.store.electionOutcome)
    assert.equal(guestWire.mirror?.phase, 'voting', 'local recompute must not promote mirror to results')
    assert.equal(guestWire.mirror?.electionOutcome, null)

    guestWire.sessionMod.handleGuestInbound(
      encodeState(
        {
          phase: 'results',
          participants: guestWire.mirror?.participants ?? [],
          ballotMovies: guestWire.mirror?.ballotMovies ?? null,
          ballotOrderIds: [...ballotOrderIds],
          voteProgress: { submitted: 2, total: 2 },
          electionOutcome: runElection(
            'irv',
            [[ballotOrderIds[0], ballotOrderIds[1]], [ballotOrderIds[0], ballotOrderIds[1]]],
            ballotOrderIds,
          ),
          uniqueSuggestedMovieCount: 0,
          votingMethod: 'irv',
        },
        2,
      ),
    )

    assert.equal(guestWire.mirror?.phase, 'results')
    assert.ok(guestWire.mirror?.electionOutcome)
    assert.equal(guestWire.mirror?.electionOutcome?.winnerId, ballotOrderIds[0])
  },
)

test(
  'election results enter authority only via hostAfterVoteSubmit, not partial votes or state replay',
  voteAuthorityTests,
  async () => {
    mock.reset()

    const hostStableId = 'MVHOSTRES1'
    const guestStableId = 'MVGUESTRES1'
    const suffix = 'VOTERES1'

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
      const sessionMod = await importMovieVoteSession(`vote-results-${Date.now()}`)
      const { store, outbound, guestPid, ballotOrderIds } = await bootstrapHostVotingWithGuest(
        harness,
        suffix,
        guestStableId,
        sessionMod,
      )

      const setsBeforeGuestVote = harness.sets.length
      simulateHostInboxMessage(
        harness,
        'movieVoteRooms',
        suffix,
        guestStableId,
        encodeVote(guestPid, ballotOrderIds),
      )
      assert.equal(store.phase, 'voting')
      assert.equal(store.voteProgress?.submitted, 1)

      const guestVoteBroadcasts = mvStateBroadcasts(harness.sets.slice(setsBeforeGuestVote))
      assert.ok(
        guestVoteBroadcasts.every((b) => b.payload.phase === 'voting'),
        'partial votes must not commit results',
      )
      assert.ok(guestVoteBroadcasts.every((b) => b.payload.electionOutcome == null))

      const guestWire = bindGuestMirrorHandlers(
        await importMovieVoteSession(`vote-results-guest-${Date.now()}`),
        ballotOrderIds,
      )
      guestWire.sessionMod.handleGuestInbound(
        encodeState(
          {
            phase: 'voting',
            participants: guestWire.mirror?.participants ?? [],
            ballotMovies: guestWire.mirror?.ballotMovies ?? null,
            ballotOrderIds: [...ballotOrderIds],
            voteProgress: { submitted: 1, total: 2 },
            electionOutcome: null,
            uniqueSuggestedMovieCount: 0,
            votingMethod: 'irv',
          },
          2,
        ),
      )
      assert.equal(guestWire.mirror?.phase, 'voting')

      const forgedResults = {
        phase: /** @type {const} */ ('results'),
        participants: guestWire.mirror?.participants ?? [],
        ballotMovies: guestWire.mirror?.ballotMovies ?? null,
        ballotOrderIds: [...ballotOrderIds],
        voteProgress: { submitted: 2, total: 2 },
        electionOutcome: { winnerId: ballotOrderIds[0], rounds: [], declaredTie: false },
        uniqueSuggestedMovieCount: 0,
        votingMethod: /** @type {const} */ ('irv'),
      }
      guestWire.sessionMod.handleGuestInbound(encodeState(forgedResults, 1))
      assert.equal(
        guestWire.mirror?.phase,
        'voting',
        'regressive results replay must not overwrite voting mirror',
      )
      assert.equal(guestWire.mirror?.electionOutcome, null)

      store.submitMyVoteLocal([...ballotOrderIds])
      const setsBeforeCommit = harness.sets.length
      outbound.hostAfterVoteSubmit()

      const commitBroadcasts = mvStateBroadcasts(harness.sets.slice(setsBeforeCommit))
      assert.ok(commitBroadcasts.length >= 1, 'hostAfterVoteSubmit should rebroadcast committed results')
      const committed = commitBroadcasts[commitBroadcasts.length - 1]
      assert.equal(committed.payload.phase, 'results')
      assert.ok(committed.payload.electionOutcome)
      assert.equal(store.phase, 'results')
      assert.ok(store.electionOutcome)
    })
  },
)

test(
  'last guest vote via inbox auto-commits results when host vote already recorded',
  voteAuthorityTests,
  async () => {
    mock.reset()

    const hostStableId = 'MVHOSTAUTO1'
    const guestStableId = 'MVGUESTAUTO1'
    const suffix = 'VOTEAUTO1'

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
      const sessionMod = await importMovieVoteSession(`vote-auto-${Date.now()}`)
      const { store, guestPid, ballotOrderIds } = await bootstrapHostVotingWithGuest(
        harness,
        suffix,
        guestStableId,
        sessionMod,
      )

      store.submitMyVoteLocal([...ballotOrderIds])
      assert.equal(store.voteProgress?.submitted, 1)

      const setsBeforeGuestVote = harness.sets.length
      simulateHostInboxMessage(
        harness,
        'movieVoteRooms',
        suffix,
        guestStableId,
        encodeVote(guestPid, ballotOrderIds),
      )

      const commitBroadcasts = mvStateBroadcasts(harness.sets.slice(setsBeforeGuestVote))
      assert.ok(commitBroadcasts.length >= 1, 'final inbox vote should auto-commit via host tally path')
      const committed = commitBroadcasts[commitBroadcasts.length - 1]
      assert.equal(committed.payload.phase, 'results')
      assert.ok(committed.payload.electionOutcome)
      assert.equal(store.phase, 'results')
      assert.ok(store.electionOutcome)
    })
  },
)

afterEach(rtdbAfterEach)
