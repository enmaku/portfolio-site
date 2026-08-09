import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildNewPersonDraft,
  personMatchSuggestionsForTypedName,
  withSavedFlag,
} from './peopleViewModel.js'

test('buildNewPersonDraft can persist to roster', () => {
  const person = buildNewPersonDraft({ name: 'Ada', persistToRoster: true, id: 'p1' })
  assert.equal(person.id, 'p1')
  assert.equal(person.saved, true)
  assert.ok(person.color)
})

test('personMatchSuggestionsForTypedName surfaces exact name matches', () => {
  const people = [buildNewPersonDraft({ name: 'Joe', id: 'j1' })]
  const hits = personMatchSuggestionsForTypedName(people, 'joe')
  assert.equal(hits.length, 1)
  assert.equal(hits[0].id, 'j1')
})

test('withSavedFlag pins and unpins without changing id', () => {
  let person = buildNewPersonDraft({ name: 'Ada', id: 'a1', persistToRoster: false })
  person = withSavedFlag(person, true)
  assert.equal(person.saved, true)
  person = withSavedFlag(person, false)
  assert.equal(person.saved, false)
  assert.equal(person.id, 'a1')
})
