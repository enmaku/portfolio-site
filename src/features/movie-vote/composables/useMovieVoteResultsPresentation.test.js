import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick, ref } from 'vue'
import { useMovieVoteResultsPresentation } from './useMovieVoteResultsPresentation.js'

const irvOutcome = {
  votingMethod: 'irv',
  winnerId: 'a',
  tieWinnerIds: null,
  rounds: [
    {
      firstPreferenceCounts: { a: 2, b: 1 },
      activeIds: ['a', 'b'],
      ballotsWithVote: 3,
      eliminatedIds: ['b'],
    },
  ],
}

function mockSessionStorage() {
  /** @type {Record<string, string>} */
  const data = {}
  return {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v
    },
    removeItem: (k) => {
      delete data[k]
    },
    clear: () => {
      for (const k of Object.keys(data)) delete data[k]
    },
    data,
  }
}

/**
 * @param {import('vue').EffectScope} scope
 * @param {{
 *   electionOutcome?: typeof irvOutcome | null,
 *   roomSuffix?: string | null,
 *   roomAuthoritySeq?: number,
 * }} [overrides]
 */
function mountPresentation(scope, overrides = {}) {
  const electionOutcome = ref(overrides.electionOutcome ?? irvOutcome)
  const ballotMovies = ref([])
  const votingMethod = ref('irv')
  const roomSuffix = ref(overrides.roomSuffix ?? 'ROOM1')
  const roomAuthoritySeq = ref(overrides.roomAuthoritySeq ?? 7)

  const presentation = useMovieVoteResultsPresentation({
    electionOutcome,
    ballotMovies,
    votingMethod,
    roomSuffix,
    roomAuthoritySeq,
  })

  return {
    ...presentation,
    electionOutcome,
    roomSuffix,
    roomAuthoritySeq,
  }
}

test('fresh IRV outcome shows replay not summary', async () => {
  const storage = mockSessionStorage()
  const prev = globalThis.sessionStorage
  globalThis.sessionStorage = storage
  const scope = effectScope(true)
  try {
    const ctx = scope.run(() => mountPresentation(scope))
    await nextTick()
    assert.equal(ctx.showReplay.value, true)
    assert.equal(ctx.showFinal.value, false)
  } finally {
    scope.stop()
    globalThis.sessionStorage = prev
  }
})

test('onReplayComplete then duplicate authority apply stays on summary', async () => {
  const storage = mockSessionStorage()
  const prev = globalThis.sessionStorage
  globalThis.sessionStorage = storage
  const scope = effectScope(true)
  try {
    const ctx = scope.run(() => mountPresentation(scope))
    await nextTick()
    assert.equal(ctx.showReplay.value, true)

    ctx.onReplayComplete()
    await nextTick()
    assert.equal(ctx.showFinal.value, true)
    assert.equal(ctx.showReplay.value, false)
    assert.equal(storage.data['mv-results-replay-seq:ROOM1'], '7')

    ctx.electionOutcome.value = { ...irvOutcome }
    await nextTick()
    assert.equal(ctx.showFinal.value, true)
    assert.equal(ctx.showReplay.value, false)
  } finally {
    scope.stop()
    globalThis.sessionStorage = prev
  }
})

test('room suffix change hydrates consumed seq from sessionStorage', async () => {
  const storage = mockSessionStorage()
  storage.setItem('mv-results-replay-seq:ROOM2', '9')
  const prev = globalThis.sessionStorage
  globalThis.sessionStorage = storage
  const scope = effectScope(true)
  try {
    const ctx = scope.run(() =>
      mountPresentation(scope, { roomSuffix: 'ROOM2', roomAuthoritySeq: 9 }),
    )
    await nextTick()
    assert.equal(ctx.showReplay.value, false)
    assert.equal(ctx.showFinal.value, true)
  } finally {
    scope.stop()
    globalThis.sessionStorage = prev
  }
})
