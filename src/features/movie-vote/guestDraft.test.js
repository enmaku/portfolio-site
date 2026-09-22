import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyGuestInboxUpdate,
  createGuestDraft,
  isQuorumRequired,
  resetGuestDraftsForSuggestRound,
  retainsSeatWhenOffline,
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

test('participant quorum: createGuestDraft ignores optional and keeps ready', () => {
  const draft = createGuestDraft({ quorumRequired: false, ready: true })
  assert.equal(draft.quorumRequired, true)
  assert.equal(draft.ready, true)
})

test('participant quorum: isQuorumRequired always true', () => {
  assert.equal(isQuorumRequired(), true)
  assert.equal(isQuorumRequired(undefined), true)
  assert.equal(isQuorumRequired({ quorumRequired: false }), true)
})

test('participant quorum: retainsSeatWhenOffline always true', () => {
  assert.equal(retainsSeatWhenOffline(), true)
  assert.equal(retainsSeatWhenOffline(createGuestDraft({ quorumRequired: false })), true)
})

test('participant quorum: withGuestQuorum keeps quorum and ready', () => {
  const next = withGuestQuorum(createGuestDraft({ name: 'Sam', ready: true }), false)
  assert.equal(next.quorumRequired, true)
  assert.equal(next.ready, true)
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

test('applyGuestInboxUpdate allows ready true even if prev was optional-shaped', () => {
  const prev = createGuestDraft({ name: 'Sam', quorumRequired: false })
  const next = applyGuestInboxUpdate(prev, { picks: [], ready: true })
  assert.equal(next.ready, true)
  assert.equal(next.quorumRequired, true)
})

test('resetGuestDraftsForSuggestRound clears picks and ready, keeps name, quorum always on', () => {
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
    quorumRequired: true,
  })
})
