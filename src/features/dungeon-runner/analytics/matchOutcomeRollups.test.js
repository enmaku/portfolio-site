import assert from 'node:assert/strict'
import test from 'node:test'
import { ACTION_TYPES } from '../engine/kernel.js'
import {
  buildHistoryRollups,
  buildOpponentRollups,
  countEquipmentSacrifices,
  normalizeOutcomeSeats,
  parseMatchIdEpochMs,
} from './matchOutcomeRollups.js'

test('buildOpponentRollups collects nn model ids and type counts', () => {
  const rollups = buildOpponentRollups({
    opponents: [
      { type: 'nn', modelId: 'b' },
      { type: 'randombot' },
      { type: 'nn', modelId: 'a' },
    ],
  })
  assert.deepEqual(rollups.opponentModelIds, ['a', 'b'])
  assert.deepEqual(rollups.opponentCountByType, { nn: 2, randombot: 1 })
})

test('buildHistoryRollups aggregates steps by seat role and final rng', () => {
  const seats = [
    { seatId: 'seat-1', role: { type: 'human' }, label: 'You' },
    { seatId: 'seat-2', role: { type: 'nn', modelId: 'm1' }, label: 'Bot' },
  ]
  const history = [
    {
      action: { type: ACTION_TYPES.PASS, modelId: 'm1' },
      actorSeatId: 'seat-2',
      rngStepBefore: 0,
      rngStepAfter: 1,
    },
    {
      action: { type: ACTION_TYPES.SACRIFICE, equipmentId: 'W_AXE' },
      actorSeatId: 'seat-1',
      rngStepBefore: 1,
      rngStepAfter: 3,
    },
  ]
  const rollups = buildHistoryRollups(history, seats)
  assert.equal(rollups.historyStepCount, 2)
  assert.equal(rollups.historyActionStepCount, 2)
  assert.deepEqual(rollups.historyStepsBySeatRole, { human: 1, nn: 1, randombot: 0 })
  assert.deepEqual(rollups.historyModelIds, ['m1'])
  assert.equal(rollups.finalRngStep, 3)
  assert.equal(countEquipmentSacrifices(history), 1)
})

test('normalizeOutcomeSeats maps engine seat shape to outcome seats', () => {
  assert.deepEqual(
    normalizeOutcomeSeats([{ id: 'seat-1', label: 'You', role: { type: 'human' } }]),
    [{ seatId: 'seat-1', role: { type: 'human' }, label: 'You' }],
  )
})

test('parseMatchIdEpochMs returns null for non-matching ids', () => {
  assert.equal(parseMatchIdEpochMs(undefined), null)
})

test('buildHistoryRollups leaves finalRngStep null for empty history', () => {
  const rollups = buildHistoryRollups([], [])
  assert.equal(rollups.historyStepCount, 0)
  assert.equal(rollups.historyActionStepCount, 0)
  assert.equal(rollups.finalRngStep, null)
})
