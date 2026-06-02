import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDungeonOutcomeSummary,
  countCenterEquipmentRemaining,
  dismissDungeonRunForOutcomeDialog,
  isDungeonOutcomeDialogOpen,
  resolveLastDungeonRunWatcherUpdate,
  shouldShowDungeonOutcomeDialog,
} from './dungeonOutcomeDialog.js'

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

test('outcome dialog waits for presentation queue to settle before opening', () => {
  const run = { runnerSeatId: 'seat-1', result: 'success' }
  assert.equal(
    shouldShowDungeonOutcomeDialog({
      gameplayInputLocked: true,
      lastDungeonRun: run,
      dismissedDungeonRun: null,
    }),
    false,
  )
  assert.equal(
    shouldShowDungeonOutcomeDialog({
      headlessCompletionInFlight: true,
      lastDungeonRun: run,
      dismissedDungeonRun: null,
    }),
    false,
  )
  assert.equal(
    shouldShowDungeonOutcomeDialog({
      lastDungeonRun: run,
      dismissedDungeonRun: null,
    }),
    true,
  )
})

test('last dungeon run watcher clears dismiss state when run resets to null', () => {
  assert.deepEqual(resolveLastDungeonRunWatcherUpdate(null, ['axe']), {
    dismissedDungeonRun: null,
    equipmentRemainingAtResolution: null,
  })
})

test('last dungeon run watcher snapshots center equipment count at resolution', () => {
  assert.deepEqual(resolveLastDungeonRunWatcherUpdate({ result: 'success' }, ['axe', 'shield']), {
    equipmentRemainingAtResolution: 2,
  })
  assert.equal(countCenterEquipmentRemaining(null), 0)
})

test('continue dismisses outcome dialog by run reference identity', () => {
  const run = { runnerSeatId: 'seat-1', result: 'failure' }
  assert.equal(dismissDungeonRunForOutcomeDialog(run), run)
  assert.equal(
    isDungeonOutcomeDialogOpen({ lastDungeonRun: run, dismissedDungeonRun: run }),
    false,
  )
})

test('buildDungeonOutcomeSummary uses equipment remaining snapshot when provided', () => {
  const run = { runnerSeatId: 'seat-1', result: 'success', heroLoadoutSize: 5 }
  const summary = buildDungeonOutcomeSummary({
    lastDungeonRun: run,
    seats: [{ id: 'seat-1', label: 'You' }],
    equipmentRemainingAtResolution: 2,
  })
  assert.equal(summary.equipmentSpentLabel, '3 spent')
})
