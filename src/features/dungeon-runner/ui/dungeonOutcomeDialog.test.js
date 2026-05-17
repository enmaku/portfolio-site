import assert from 'node:assert/strict'
import test from 'node:test'
import { isDungeonOutcomeDialogOpen } from './dungeonOutcomeDialog.js'

test('dialog is closed whenever there is no last dungeon run', () => {
  assert.equal(
    isDungeonOutcomeDialogOpen({ lastDungeonRun: null, dismissedDungeonRun: null }),
    false,
  )
  assert.equal(
    isDungeonOutcomeDialogOpen({ lastDungeonRun: null, dismissedDungeonRun: { result: 'success' } }),
    false,
  )
})

test('dialog opens whenever a new dungeon run reference appears, even with identical content', () => {
  const firstRun = {
    runnerSeatId: 'seat-1',
    result: 'success',
    monsters: ['goblin', 'orc'],
    heroLoadoutSize: 5,
  }
  const secondRunIdenticalContent = {
    runnerSeatId: 'seat-1',
    result: 'success',
    monsters: ['goblin', 'orc'],
    heroLoadoutSize: 5,
  }

  assert.equal(
    isDungeonOutcomeDialogOpen({ lastDungeonRun: firstRun, dismissedDungeonRun: null }),
    true,
  )
  assert.equal(
    isDungeonOutcomeDialogOpen({ lastDungeonRun: firstRun, dismissedDungeonRun: firstRun }),
    false,
  )
  assert.equal(
    isDungeonOutcomeDialogOpen({
      lastDungeonRun: secondRunIdenticalContent,
      dismissedDungeonRun: firstRun,
    }),
    true,
  )
})
