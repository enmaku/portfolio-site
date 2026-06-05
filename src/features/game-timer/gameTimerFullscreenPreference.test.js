import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useGameTimerStore } from '../../stores/gameTimer.js'

const gameTimerStoreSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../stores/gameTimer.js'),
  'utf8',
)

test('clearAllPlayers keeps fullscreenEnabled preference', () => {
  setActivePinia(createPinia())
  const store = useGameTimerStore()
  store.addPlayer({ name: 'A' })
  store.setFullscreenEnabled(true)
  store.clearAllPlayers()
  assert.equal(store.fullscreenEnabled, true)
})

test('pinia persist pick includes fullscreenEnabled', () => {
  const pickBlock = gameTimerStoreSource.match(/pick:\s*\[([\s\S]*?)\],/)
  assert.ok(pickBlock, 'expected game timer persist pick list')
  assert.match(pickBlock[1], /['"]fullscreenEnabled['"]/)
})
