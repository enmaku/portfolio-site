import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NEURAL_RECOVERY_TERMINAL,
  createNeuralRuntimeRecoveryCoordinator,
} from '../nn/recovery.js'
import {
  attachNeuralRecoverySnapshotToMatch,
  shouldDeferHeadlessForPersistedNeuralTerminal,
  shouldRunHeadlessMatchCompletion,
  surfacePersistedNeuralRecoveryTerminal,
} from './headlessNeuralRecoveryPersistence.js'

test('attachNeuralRecoverySnapshotToMatch omits field when no terminal is recorded', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  const match = { id: 'm-1', setup: {}, state: {}, history: [] }
  assert.deepEqual(attachNeuralRecoverySnapshotToMatch(match, recovery), match)
})

test('attachNeuralRecoverySnapshotToMatch records terminal snapshot for persistence', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator({ inferMaxAttempts: 1 })
  recovery.beginRecovery('latest')
  recovery.recordInferFailure('latest')
  const match = { id: 'm-1', setup: {}, state: {}, history: [] }
  const next = attachNeuralRecoverySnapshotToMatch(match, recovery)
  assert.equal(next.neuralRecoveryByModelId.latest.terminal, NEURAL_RECOVERY_TERMINAL.REFRESH)
})

test('surfacePersistedNeuralRecoveryTerminal opens refresh dialog for REFRESH snapshot', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  let refreshOpen = false
  const surfaced = surfacePersistedNeuralRecoveryTerminal({
    recovery,
    neuralRecoveryByModelId: {
      latest: {
        loadAttempts: 0,
        inferAttempts: 3,
        recovering: false,
        terminal: NEURAL_RECOVERY_TERMINAL.REFRESH,
      },
    },
    hasMatchSetup: true,
    openRefreshTerminal: () => {
      refreshOpen = true
    },
  })
  assert.equal(surfaced, true)
  assert.equal(refreshOpen, true)
  assert.equal(recovery.getTerminalOutcome('latest'), NEURAL_RECOVERY_TERMINAL.REFRESH)
})

test('surfacePersistedNeuralRecoveryTerminal restores setup for SETUP snapshot', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  let setupRestored = false
  const surfaced = surfacePersistedNeuralRecoveryTerminal({
    recovery,
    neuralRecoveryByModelId: {
      latest: {
        loadAttempts: 3,
        inferAttempts: 0,
        recovering: false,
        terminal: NEURAL_RECOVERY_TERMINAL.SETUP,
      },
    },
    hasMatchSetup: true,
    applySetupTerminal: () => {
      setupRestored = true
    },
  })
  assert.equal(surfaced, true)
  assert.equal(setupRestored, true)
  assert.equal(recovery.getTerminalOutcome('latest'), NEURAL_RECOVERY_TERMINAL.SETUP)
})

test('shouldRunHeadlessMatchCompletion is false when refresh terminal is persisted', () => {
  const match = {
    state: { phase: 'pick-adventurer', turn: { activeSeatId: 'seat-2' }, scoreboard: {}, seats: [] },
    neuralRecoveryByModelId: { latest: { terminal: NEURAL_RECOVERY_TERMINAL.REFRESH } },
  }
  assert.equal(shouldRunHeadlessMatchCompletion(match, 'seat-1'), false)
})

test('shouldDeferHeadlessForPersistedNeuralTerminal is true only for REFRESH snapshots', () => {
  assert.equal(
    shouldDeferHeadlessForPersistedNeuralTerminal({
      latest: { terminal: NEURAL_RECOVERY_TERMINAL.REFRESH },
    }),
    true,
  )
  assert.equal(
    shouldDeferHeadlessForPersistedNeuralTerminal({
      latest: { terminal: NEURAL_RECOVERY_TERMINAL.SETUP },
    }),
    false,
  )
})
