import assert from 'node:assert/strict'
import test from 'node:test'
import { getGameTimerSettingsModel } from './settingsModel.js'

test('guest on mobile play route sees fullscreen toggle only', () => {
  const model = getGameTimerSettingsModel({ isGuest: true, fullscreenChromeExposed: true })
  assert.equal(model.showRoundRules, false)
  assert.equal(model.showFullscreen, true)
})

test('host on mobile play route sees round rules and fullscreen toggle', () => {
  const model = getGameTimerSettingsModel({ isGuest: false, fullscreenChromeExposed: true })
  assert.equal(model.showRoundRules, true)
  assert.equal(model.showFullscreen, true)
})

test('desktop project route adapter hides fullscreen toggle for guest', () => {
  const model = getGameTimerSettingsModel({ isGuest: true, fullscreenChromeExposed: false })
  assert.equal(model.showRoundRules, false)
  assert.equal(model.showFullscreen, false)
})

test('desktop project route adapter hides fullscreen toggle for host', () => {
  const model = getGameTimerSettingsModel({ isGuest: false, fullscreenChromeExposed: false })
  assert.equal(model.showRoundRules, true)
  assert.equal(model.showFullscreen, false)
})

test('omitted route adapter hides fullscreen toggle', () => {
  const model = getGameTimerSettingsModel({ isGuest: false })
  assert.equal(model.showFullscreen, false)
})

