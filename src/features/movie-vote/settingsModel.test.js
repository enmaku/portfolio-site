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

test('mobile play route adapter shows fullscreen toggle for host and guest', () => {
  for (const isGuest of [false, true]) {
    for (const phase of ['suggest', 'voting', 'results']) {
      const model = getMovieVoteSettingsModel({ isGuest, phase, fullscreenChromeExposed: true })
      assert.equal(model.showFullscreen, true, `${isGuest ? 'guest' : 'host'} ${phase}`)
    }
  }
})

test('desktop project route adapter hides fullscreen toggle for host and guest', () => {
  for (const isGuest of [false, true]) {
    for (const phase of ['suggest', 'voting', 'results']) {
      const model = getMovieVoteSettingsModel({ isGuest, phase, fullscreenChromeExposed: false })
      assert.equal(model.showFullscreen, false, `${isGuest ? 'guest' : 'host'} ${phase}`)
    }
  }
})

test('omitted route adapter hides fullscreen toggle', () => {
  const model = getMovieVoteSettingsModel({ isGuest: false, phase: 'suggest' })
  assert.equal(model.showFullscreen, false)
})
