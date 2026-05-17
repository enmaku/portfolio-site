import assert from 'node:assert/strict'
import test from 'node:test'
import { getMovieVoteSettingsModel } from './settingsModel.js'

test('host can edit voting method during suggest phase', () => {
  const model = getMovieVoteSettingsModel({ isGuest: false, phase: 'suggest' })
  assert.equal(model.votingMethodEditable, true)
  assert.equal(model.votingMethodReadOnly, false)
})

test('host cannot edit voting method during voting or results', () => {
  for (const phase of ['voting', 'results']) {
    const model = getMovieVoteSettingsModel({ isGuest: false, phase })
    assert.equal(model.votingMethodEditable, false, phase)
    assert.equal(model.votingMethodReadOnly, true, phase)
  }
})

test('guest always sees voting method read-only', () => {
  for (const phase of ['suggest', 'voting', 'results']) {
    const model = getMovieVoteSettingsModel({ isGuest: true, phase })
    assert.equal(model.votingMethodEditable, false, phase)
    assert.equal(model.votingMethodReadOnly, true, phase)
  }
})
