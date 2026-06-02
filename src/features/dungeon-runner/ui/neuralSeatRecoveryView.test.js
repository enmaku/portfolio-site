import assert from 'node:assert/strict'
import test from 'node:test'
import { createNeuralRuntimeRecoveryCoordinator } from '../nn/recovery.js'
import { NEURAL_RECOVERY_TERMINAL } from '../nn/recovery.js'
import {
  buildSeatRecoveryIndicators,
  isActiveNnSeatRecovering,
  resolveNeuralRecoveryTerminalUx,
  shouldBlockAiTurnScheduleForRecovery,
} from './neuralSeatRecoveryView.js'

test('buildSeatRecoveryIndicators marks only nn seats whose model is recovering', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  recovery.beginRecovery('model-a')
  const seats = [
    { id: 'human', role: { type: 'human' } },
    { id: 'nn-a', role: { type: 'nn', modelId: 'model-a' } },
    { id: 'nn-b', role: { type: 'nn', modelId: 'model-b' } },
  ]
  const rows = buildSeatRecoveryIndicators({ seats, recovery })
  assert.deepEqual(rows, [
    { seatId: 'human', recovering: false, testId: null },
    { seatId: 'nn-a', recovering: true, testId: 'neural-seat-recovery-nn-a' },
    { seatId: 'nn-b', recovering: false, testId: null },
  ])
})

test('isActiveNnSeatRecovering is true only for active nn seat in recovery', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  recovery.beginRecovery('latest')
  const state = {
    turn: { activeSeatId: 'nn-1' },
    seats: [{ id: 'nn-1', role: { type: 'nn', modelId: 'latest' } }],
  }
  assert.equal(isActiveNnSeatRecovering({ state, recovery }), true)
  assert.equal(
    isActiveNnSeatRecovering({
      state: { ...state, turn: { activeSeatId: 'human' } },
      recovery,
    }),
    false,
  )
})

test('shouldBlockAiTurnScheduleForRecovery when active nn model is recovering', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  recovery.beginRecovery('latest')
  const state = {
    turn: { activeSeatId: 'nn-1' },
    seats: [{ id: 'nn-1', role: { type: 'nn', modelId: 'latest' } }],
  }
  assert.equal(shouldBlockAiTurnScheduleForRecovery({ state, recovery }), true)
  assert.equal(
    shouldBlockAiTurnScheduleForRecovery({
      state: { ...state, turn: { activeSeatId: 'human' } },
      recovery,
    }),
    false,
  )
})

test('shouldBlockAiTurnScheduleForRecovery is false when only inactive nn seat recovers', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  recovery.beginRecovery('model-b')
  const state = {
    turn: { activeSeatId: 'human' },
    seats: [
      { id: 'human', role: { type: 'human' } },
      { id: 'nn-a', role: { type: 'nn', modelId: 'model-a' } },
      { id: 'nn-b', role: { type: 'nn', modelId: 'model-b' } },
    ],
  }
  assert.equal(shouldBlockAiTurnScheduleForRecovery({ state, recovery }), false)
})

test('resolveNeuralRecoveryTerminalUx maps coordinator terminals to play-page actions', () => {
  assert.deepEqual(
    resolveNeuralRecoveryTerminalUx({ terminal: NEURAL_RECOVERY_TERMINAL.SETUP, hasMatchSetup: true }),
    { action: 'setup-restore' },
  )
  assert.deepEqual(
    resolveNeuralRecoveryTerminalUx({ terminal: NEURAL_RECOVERY_TERMINAL.SETUP, hasMatchSetup: false }),
    { action: null },
  )
  assert.deepEqual(
    resolveNeuralRecoveryTerminalUx({ terminal: NEURAL_RECOVERY_TERMINAL.REFRESH }),
    { action: 'refresh-dialog' },
  )
  assert.deepEqual(
    resolveNeuralRecoveryTerminalUx({ terminal: NEURAL_RECOVERY_TERMINAL.NONE }),
    { action: null },
  )
})
