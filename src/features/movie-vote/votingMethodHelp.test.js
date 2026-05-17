import assert from 'node:assert/strict'
import test from 'node:test'
import { VOTING_METHOD_IDS, VOTING_METHOD_OPTIONS } from './votingMethod.js'
import { getVotingMethodHelpEntries } from './votingMethodHelp.js'

const FORBIDDEN_COPY = [
  /tiebreak/i,
  /tie.?break/i,
  /switch methods/i,
  /ballot order/i,
  /ranked-points/i,
  /Black'?s method/i,
  /Schulze method/i,
  /algorithmic tiebreak/i,
]

const MAX_CHOOSE_THIS_LENGTH = 220

test('getVotingMethodHelpEntries lists every registered voting method', () => {
  const entries = getVotingMethodHelpEntries()
  assert.equal(entries.length, VOTING_METHOD_IDS.length)
  assert.deepEqual(
    entries.map((e) => e.method),
    VOTING_METHOD_OPTIONS.map((o) => o.value),
  )
})

test('each voting method help entry has chooseThis and a Wikipedia link', () => {
  for (const entry of getVotingMethodHelpEntries()) {
    assert.equal(entry.label, VOTING_METHOD_OPTIONS.find((o) => o.value === entry.method)?.label)
    assert.match(entry.chooseThis, /\.\s*$/u, `${entry.method} chooseThis should be one sentence`)
    assert.ok(entry.chooseThis.length <= MAX_CHOOSE_THIS_LENGTH, entry.method)
    assert.match(
      entry.wikipediaUrl,
      /^https:\/\/en\.wikipedia\.org\/wiki\//u,
      entry.method,
    )
  }
})

test('voting method help copy avoids tiebreak and method-switch language', () => {
  const text = getVotingMethodHelpEntries()
    .flatMap((e) => [e.chooseThis])
    .join('\n')
  for (const pattern of FORBIDDEN_COPY) {
    assert.doesNotMatch(text, pattern, pattern.toString())
  }
})

test('voting method help covers all seven registry methods', () => {
  assert.equal(VOTING_METHOD_IDS.length, 7)
  assert.equal(getVotingMethodHelpEntries().length, 7)
})

test('each chooseThis starts with a pick-this cue for movie night', () => {
  for (const entry of getVotingMethodHelpEntries()) {
    assert.match(entry.chooseThis, /^Pick this when /u, entry.method)
  }
})
