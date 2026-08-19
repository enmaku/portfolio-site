import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useTimeTrackerSettingsStore } from '../../stores/timeTrackerSettings.js'
import { DEFAULT_TIMER_COLOR } from './timerAccent.js'

const settingsStoreSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../stores/timeTrackerSettings.js'),
  'utf8',
)

test('timer color ignores invalid values instead of resetting to orange', () => {
  setActivePinia(createPinia())
  const store = useTimeTrackerSettingsStore()
  assert.equal(store.timerColor, DEFAULT_TIMER_COLOR)
  store.setTimerColor('#5C6BC0')
  assert.equal(store.timerColor, '#5c6bc0')
  store.setTimerColor('')
  store.setTimerColor(null)
  store.setTimerColor('nope')
  assert.equal(store.timerColor, '#5c6bc0')
})

test('owner prefs persist issuer name, tab, selection, and color together', () => {
  setActivePinia(createPinia())
  const store = useTimeTrackerSettingsStore()
  store.patchOwnerPrefs('uid-1', {
    issuerName: 'Jane',
    activeSurface: 'history',
    selectedProjectId: 'p1',
    description: 'notes',
    timerColor: '#26a69a',
  })
  assert.equal(store.prefsFor('uid-1')?.issuerName, 'Jane')
  assert.equal(store.prefsFor('uid-1')?.activeSurface, 'history')
  assert.equal(store.prefsFor('uid-1')?.selectedProjectId, 'p1')
  assert.equal(store.prefsFor('uid-1')?.timerColor, '#26a69a')
  assert.equal(store.timerColor, '#26a69a')
  assert.equal(store.prefsFor('uid-2'), null)
})

test('pinia persist keeps the full settings store without a pick list', () => {
  assert.match(settingsStoreSource, /key:\s*['"]portfolio-time-tracker['"]/)
  assert.doesNotMatch(settingsStoreSource, /pick:/)
  assert.match(settingsStoreSource, /prefsByOwner/)
  assert.match(settingsStoreSource, /timerColor/)
})
