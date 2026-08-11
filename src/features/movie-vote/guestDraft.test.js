import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyGuestInboxUpdate,
  createGuestDraft,
  isQuorumRequired,
  resetGuestDraftsForSuggestRound,
  withGuestQuorum,
} from './guestDraft.js'

test('createGuestDraft defaults quorum on and ready false', () => {
  assert.deepEqual(createGuestDraft({ name: 'Sam' }), {
    picks: [],
    ready: false,
    name: 'Sam',
    quorumRequired: true,
  })
})

test('createGuestDraft forces ready false when optional', () => {
  assert.equal(createGuestDraft({ quorumRequired: false, ready: true }).ready, false)
})

test('isQuorumRequired defaults missing to true', () => {
  assert.equal(isQuorumRequired(undefined), true)
  assert.equal(isQuorumRequired({ quorumRequired: false }), false)
})

test('withGuestQuorum clears ready when turning optional', () => {
  const next = withGuestQuorum(
    createGuestDraft({ name: 'Sam', ready: true, quorumRequired: true }),
    false,
  )
  assert.equal(next.quorumRequired, false)
  assert.equal(next.ready, false)
  assert.equal(next.name, 'Sam')
})

test('applyGuestInboxUpdate ignores crafted quorum and name on entry', () => {
  const prev = createGuestDraft({ name: 'Sam', quorumRequired: true, ready: false })
  const crafted = {
    picks: [{ localId: '1', source: 'custom', tmdbId: null, title: 'A', posterPath: null, overview: '' }],
    ready: true,
    name: 'Hacker',
    quorumRequired: false,
  }
  const next = applyGuestInboxUpdate(prev, crafted)
  assert.equal(next.name, 'Sam')
  assert.equal(next.quorumRequired, true)
  assert.equal(next.ready, true)
  assert.equal(next.picks.length, 1)
})

test('applyGuestInboxUpdate keeps optional seats non-ready', () => {
  const prev = createGuestDraft({ name: 'Sam', quorumRequired: false })
  const next = applyGuestInboxUpdate(prev, { picks: [], ready: true })
  assert.equal(next.ready, false)
  assert.equal(next.quorumRequired, false)
})

test('resetGuestDraftsForSuggestRound clears picks and ready, keeps name/quorum', () => {
  /** @type {Map<string, import('./types.js').MovieVoteGuestDraft>} */
  const guestDrafts = new Map([
    [
      'g1',
      createGuestDraft({
        name: 'Sam',
        quorumRequired: false,
        ready: true,
        picks: [
          { localId: '1', source: 'custom', tmdbId: null, title: 'A', posterPath: null, overview: '' },
        ],
      }),
    ],
  ])
  resetGuestDraftsForSuggestRound(guestDrafts)
  assert.deepEqual(guestDrafts.get('g1'), {
    picks: [],
    ready: false,
    name: 'Sam',
    quorumRequired: false,
  })
})
