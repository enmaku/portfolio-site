import assert from 'node:assert/strict'
import test from 'node:test'
import { isDebugModeEnabledForLocation, shouldEnableDebugOnBoot } from './mode.js'

test('debug mode requires localhost host and query flag', () => {
  assert.equal(isDebugModeEnabledForLocation('http://localhost:9000/#/projects/dungeon-runner?debug=true'), true)
  assert.equal(isDebugModeEnabledForLocation('http://localhost:9000/?debug=true#/projects/dungeon-runner'), true)
  assert.equal(isDebugModeEnabledForLocation('http://127.0.0.1:9000/#/projects/dungeon-runner?debug=true'), true)
  assert.equal(isDebugModeEnabledForLocation('http://localhost:9000/#/projects/dungeon-runner'), false)
  assert.equal(isDebugModeEnabledForLocation('https://example.com/#/projects/dungeon-runner?debug=true'), false)
})

test('debug mode does not persist without query param on next boot', () => {
  assert.equal(shouldEnableDebugOnBoot('http://localhost:9000/#/projects/dungeon-runner?debug=true'), true)
  assert.equal(shouldEnableDebugOnBoot('http://localhost:9000/#/projects/dungeon-runner'), false)
})
