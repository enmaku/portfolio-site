import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDungeonOutcomeSummary,
  isDungeonOutcomeDialogOpen,
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

test('outcome summary derives spent count from snapshotted remaining equipment, not live state', () => {
  const lastDungeonRun = {
    runnerSeatId: 'seat-1',
    result: 'success',
    monsters: ['goblin', 'orc'],
    heroLoadoutSize: 5,
  }
  const seats = [{ id: 'seat-1', label: 'Alpha' }]

  const summary = buildDungeonOutcomeSummary({
    lastDungeonRun,
    seats,
    equipmentRemainingAtResolution: 3,
  })

  assert.equal(summary.runnerLabel, 'Alpha')
  assert.equal(summary.resultLabel, 'Success')
  assert.equal(summary.monstersLabel, 'goblin, orc')
  assert.equal(summary.equipmentSpentLabel, '2 spent')
})

test('outcome summary reports "none spent" when no equipment was lost', () => {
  const summary = buildDungeonOutcomeSummary({
    lastDungeonRun: {
      runnerSeatId: 'seat-2',
      result: 'failure',
      monsters: ['dragon'],
      heroLoadoutSize: 4,
    },
    seats: [{ id: 'seat-2', label: 'Beta' }],
    equipmentRemainingAtResolution: 4,
  })

  assert.equal(summary.resultLabel, 'Failure')
  assert.equal(summary.equipmentSpentLabel, 'none spent')
})

test('outcome summary falls back to "none spent" when snapshot is unavailable', () => {
  const summary = buildDungeonOutcomeSummary({
    lastDungeonRun: {
      runnerSeatId: 'seat-3',
      result: 'success',
      monsters: [],
      heroLoadoutSize: 5,
    },
    seats: [],
  })

  assert.equal(summary.runnerLabel, 'seat-3')
  assert.equal(summary.monstersLabel, 'none')
  assert.equal(summary.equipmentSpentLabel, 'none spent')
})

test('outcome summary clamps spent count at zero when remaining exceeds initial loadout', () => {
  const summary = buildDungeonOutcomeSummary({
    lastDungeonRun: {
      runnerSeatId: 'seat-1',
      result: 'success',
      monsters: ['goblin'],
      heroLoadoutSize: 3,
    },
    seats: [{ id: 'seat-1', label: 'Alpha' }],
    equipmentRemainingAtResolution: 5,
  })

  assert.equal(summary.equipmentSpentLabel, 'none spent')
})
