import assert from 'node:assert/strict'
import test from 'node:test'
import { NEURAL_RECOVERY_TERMINAL } from './nn/recovery.js'
import {
  resolveNeuralRecoveryTerminalUx,
  selectPersistedNeuralRecoveryTerminal,
} from './neuralRecoveryTerminalPolicy.js'

test('resolveNeuralRecoveryTerminalUx maps coordinator terminals to play-page actions', () => {
  assert.deepEqual(
    resolveNeuralRecoveryTerminalUx({
      terminal: NEURAL_RECOVERY_TERMINAL.SETUP,
      hasMatchSetup: true,
    }),
    { action: 'setup-restore' },
  )
  assert.deepEqual(
    resolveNeuralRecoveryTerminalUx({
      terminal: NEURAL_RECOVERY_TERMINAL.SETUP,
      hasMatchSetup: false,
    }),
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

test('selectPersistedNeuralRecoveryTerminal prefers REFRESH over SETUP regardless of key order', () => {
  const refreshFirst = {
    'model-a': { terminal: NEURAL_RECOVERY_TERMINAL.REFRESH },
    'model-z': { terminal: NEURAL_RECOVERY_TERMINAL.SETUP },
  }
  const setupFirst = {
    'model-z': { terminal: NEURAL_RECOVERY_TERMINAL.SETUP },
    'model-a': { terminal: NEURAL_RECOVERY_TERMINAL.REFRESH },
  }
  assert.deepEqual(selectPersistedNeuralRecoveryTerminal(refreshFirst), {
    modelId: 'model-a',
    terminal: NEURAL_RECOVERY_TERMINAL.REFRESH,
  })
  assert.deepEqual(selectPersistedNeuralRecoveryTerminal(setupFirst), {
    modelId: 'model-a',
    terminal: NEURAL_RECOVERY_TERMINAL.REFRESH,
  })
})

test('selectPersistedNeuralRecoveryTerminal tie-breaks same terminal by modelId lexicographic order', () => {
  assert.deepEqual(
    selectPersistedNeuralRecoveryTerminal({
      'v1.0.0': { terminal: NEURAL_RECOVERY_TERMINAL.REFRESH },
      latest: { terminal: NEURAL_RECOVERY_TERMINAL.REFRESH },
    }),
    { modelId: 'latest', terminal: NEURAL_RECOVERY_TERMINAL.REFRESH },
  )
})

test('selectPersistedNeuralRecoveryTerminal prefers preferredModelId within same terminal tier', () => {
  assert.deepEqual(
    selectPersistedNeuralRecoveryTerminal(
      {
        'model-a': { terminal: NEURAL_RECOVERY_TERMINAL.REFRESH },
        'model-b': { terminal: NEURAL_RECOVERY_TERMINAL.REFRESH },
      },
      { preferredModelId: 'model-b' },
    ),
    { modelId: 'model-b', terminal: NEURAL_RECOVERY_TERMINAL.REFRESH },
  )
})

test('selectPersistedNeuralRecoveryTerminal keeps REFRESH priority when preferredModelId is SETUP-only', () => {
  assert.deepEqual(
    selectPersistedNeuralRecoveryTerminal(
      {
        'model-setup': { terminal: NEURAL_RECOVERY_TERMINAL.SETUP },
        'model-refresh': { terminal: NEURAL_RECOVERY_TERMINAL.REFRESH },
      },
      { preferredModelId: 'model-setup' },
    ),
    { modelId: 'model-refresh', terminal: NEURAL_RECOVERY_TERMINAL.REFRESH },
  )
})

test('selectPersistedNeuralRecoveryTerminal tie-breaks multiple SETUP terminals by modelId', () => {
  assert.deepEqual(
    selectPersistedNeuralRecoveryTerminal({
      'v1.0.0': { terminal: NEURAL_RECOVERY_TERMINAL.SETUP },
      latest: { terminal: NEURAL_RECOVERY_TERMINAL.SETUP },
    }),
    { modelId: 'latest', terminal: NEURAL_RECOVERY_TERMINAL.SETUP },
  )
})

test('selectPersistedNeuralRecoveryTerminal returns null when no terminal entries', () => {
  assert.equal(selectPersistedNeuralRecoveryTerminal(undefined), null)
  assert.equal(
    selectPersistedNeuralRecoveryTerminal({
      latest: { terminal: NEURAL_RECOVERY_TERMINAL.NONE },
    }),
    null,
  )
})
