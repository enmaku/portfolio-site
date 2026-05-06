import assert from 'node:assert/strict'
import test from 'node:test'
import { getGameTimerSettingsModel } from './settingsModel.js'

test('guest settings only include fullscreen toggle', () => {
  const model = getGameTimerSettingsModel({ isGuest: true })
  assert.equal(model.showRoundRules, false)
  assert.equal(model.showFullscreen, true)
})

test('host settings include round rules and fullscreen toggle', () => {
  const model = getGameTimerSettingsModel({ isGuest: false })
  assert.equal(model.showRoundRules, true)
  assert.equal(model.showFullscreen, true)
})

