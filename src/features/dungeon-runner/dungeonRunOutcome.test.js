import assert from 'node:assert/strict'
import test from 'node:test'
import { DUNGEON_RUN_WIN_VIA } from './dungeonRunOutcome.js'

test('DUNGEON_RUN_WIN_VIA exposes omnipotence win metadata key', () => {
  assert.equal(DUNGEON_RUN_WIN_VIA.OMNIPOTENCE, 'omnipotence')
})
