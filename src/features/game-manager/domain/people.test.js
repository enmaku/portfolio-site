import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyPersonDeletionToSessions,
  createRecordedPlayer,
  matchPeopleByName,
  pinSavedPlayer,
  suggestPersonMatches,
  unpinSavedPlayer,
} from './people.js'

test('suggestPersonMatches offers existing people without silent auto-merge', () => {
  const people = [
    createRecordedPlayer({ id: 'a', name: 'Joe', color: '#111111', saved: false }),
    createRecordedPlayer({ id: 'b', name: 'Joan', color: '#222222', saved: true }),
  ]
  const suggestions = suggestPersonMatches(people, 'joe')
  assert.equal(suggestions.length, 1)
  assert.equal(suggestions[0].id, 'a')
  assert.equal(matchPeopleByName(people, 'joe').length, 1)
})

test('pin and unpin saved player does not remove recorded identity', () => {
  let person = createRecordedPlayer({ id: 'a', name: 'Ada', color: '#abcdef', saved: false })
  person = pinSavedPlayer(person)
  assert.equal(person.saved, true)
  person = unpinSavedPlayer(person)
  assert.equal(person.saved, false)
  assert.equal(person.id, 'a')
  assert.equal(person.name, 'Ada')
})

test('person deletion replaces seats with removed player placeholders', () => {
  const sessions = [
    {
      id: 's1',
      presentPlayers: [
        { recordedPlayerId: 'a', name: 'Ada', color: '#111111' },
        { recordedPlayerId: 'b', name: 'Bob', color: '#222222' },
      ],
    },
  ]
  const next = applyPersonDeletionToSessions(sessions, 'a')
  assert.equal(next[0].presentPlayers[0].removed, true)
  assert.equal(next[0].presentPlayers[0].recordedPlayerId, null)
  assert.equal(next[0].presentPlayers[1].recordedPlayerId, 'b')
})
