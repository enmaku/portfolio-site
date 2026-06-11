import assert from 'node:assert/strict'
import test from 'node:test'
import { migrateLegacyPersistedElectionOutcome } from './electionOutcomePersistMigration.js'

test('migrateLegacyPersistedElectionOutcome maps irvResult to electionOutcome', () => {
  const legacyOutcome = {
    votingMethod: 'irv',
    winnerId: 'm_a',
    tieWinnerIds: null,
    rounds: [],
  }
  const store = { irvResult: legacyOutcome, electionOutcome: null }
  migrateLegacyPersistedElectionOutcome(store)
  assert.deepEqual(store.electionOutcome, legacyOutcome)
  assert.equal(store.irvResult, undefined)
})

test('migrateLegacyPersistedElectionOutcome is a no-op when electionOutcome already set', () => {
  const current = { votingMethod: 'borda', winnerId: 'x', tieWinnerIds: null, rounds: [] }
  const store = { irvResult: { winnerId: 'old' }, electionOutcome: current }
  migrateLegacyPersistedElectionOutcome(store)
  assert.deepEqual(store.electionOutcome, current)
})
