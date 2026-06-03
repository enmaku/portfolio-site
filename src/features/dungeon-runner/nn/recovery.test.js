import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NEURAL_RECOVERY_TERMINAL,
  createNeuralRuntimeRecoveryCoordinator,
} from './recovery.js'

test('recovery coordinator isolates state per modelId', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  recovery.beginRecovery('latest')
  recovery.recordLoadFailure('latest')
  assert.equal(recovery.isRecovering('v1.0.0'), false)
  assert.equal(recovery.getTerminalOutcome('v1.0.0'), NEURAL_RECOVERY_TERMINAL.NONE)
})

test('load failures increment load counter only', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator({ loadMaxAttempts: 3 })
  recovery.beginRecovery('latest')
  recovery.recordLoadFailure('latest')
  recovery.recordLoadFailure('latest')
  assert.equal(recovery.getLoadAttempts('latest'), 2)
  assert.equal(recovery.getInferAttempts('latest'), 0)
  assert.equal(recovery.getTerminalOutcome('latest'), NEURAL_RECOVERY_TERMINAL.NONE)
})

test('infer failures increment infer counter only', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator({ inferMaxAttempts: 3 })
  recovery.beginRecovery('latest')
  recovery.recordInferFailure('latest')
  recovery.recordInferFailure('latest')
  assert.equal(recovery.getInferAttempts('latest'), 2)
  assert.equal(recovery.getLoadAttempts('latest'), 0)
  assert.equal(recovery.getTerminalOutcome('latest'), NEURAL_RECOVERY_TERMINAL.NONE)
})

test('third load failure reaches SETUP terminal', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator({ loadMaxAttempts: 3 })
  recovery.beginRecovery('latest')
  recovery.recordLoadFailure('latest')
  recovery.recordLoadFailure('latest')
  recovery.recordLoadFailure('latest')
  assert.equal(recovery.getTerminalOutcome('latest'), NEURAL_RECOVERY_TERMINAL.SETUP)
  assert.equal(recovery.shouldBlockTurn('latest'), false)
})

test('third infer failure reaches REFRESH terminal', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator({ inferMaxAttempts: 3 })
  recovery.beginRecovery('latest')
  recovery.recordInferFailure('latest')
  recovery.recordInferFailure('latest')
  recovery.recordInferFailure('latest')
  assert.equal(recovery.getTerminalOutcome('latest'), NEURAL_RECOVERY_TERMINAL.REFRESH)
  assert.equal(recovery.shouldBlockTurn('latest'), false)
})

test('load backend escalation uses webgl for attempts 1-2 and cpu on attempt 3+', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator({ loadMaxAttempts: 3 })
  recovery.beginRecovery('latest')
  assert.equal(recovery.getBackendPreference('latest', 'load'), 'webgl')
  recovery.recordLoadFailure('latest')
  assert.equal(recovery.getBackendPreference('latest', 'load'), 'webgl')
  recovery.recordLoadFailure('latest')
  assert.equal(recovery.getBackendPreference('latest', 'load'), 'cpu')
  recovery.recordLoadFailure('latest')
  assert.equal(recovery.getBackendPreference('latest', 'load'), 'cpu')
})

test('infer backend escalation uses webgl for attempts 1-2 and cpu on attempt 3+', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator({ inferMaxAttempts: 3 })
  recovery.beginRecovery('latest')
  assert.equal(recovery.getBackendPreference('latest', 'infer'), 'webgl')
  recovery.recordInferFailure('latest')
  assert.equal(recovery.getBackendPreference('latest', 'infer'), 'webgl')
  recovery.recordInferFailure('latest')
  assert.equal(recovery.getBackendPreference('latest', 'infer'), 'cpu')
  recovery.recordInferFailure('latest')
  assert.equal(recovery.getBackendPreference('latest', 'infer'), 'cpu')
})

test('exportSnapshot and importSnapshot round-trip terminal state', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator({ inferMaxAttempts: 1 })
  recovery.beginRecovery('latest')
  recovery.recordInferFailure('latest')
  const snapshot = recovery.exportSnapshot()
  const restored = createNeuralRuntimeRecoveryCoordinator()
  restored.importSnapshot(snapshot)
  assert.equal(restored.getTerminalOutcome('latest'), NEURAL_RECOVERY_TERMINAL.REFRESH)
  assert.equal(restored.getInferAttempts('latest'), 1)
})

test('recordSuccess clears recovering state and counters', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  recovery.beginRecovery('latest')
  recovery.recordLoadFailure('latest')
  recovery.recordSuccess('latest')
  assert.equal(recovery.isRecovering('latest'), false)
  assert.equal(recovery.getLoadAttempts('latest'), 0)
  assert.equal(recovery.getInferAttempts('latest'), 0)
  assert.equal(recovery.getTerminalOutcome('latest'), NEURAL_RECOVERY_TERMINAL.NONE)
})

test('shouldBlockTurn while recovering before terminal', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  recovery.beginRecovery('latest')
  assert.equal(recovery.shouldBlockTurn('latest'), true)
  recovery.recordInferFailure('latest')
  assert.equal(recovery.shouldBlockTurn('latest'), true)
})

test('subscribe returns an unsubscribe function', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  const unsubscribe = recovery.subscribe(() => {})
  assert.equal(typeof unsubscribe, 'function')
  unsubscribe()
})

test('subscribe notifies on beginRecovery', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  let calls = 0
  recovery.subscribe(() => {
    calls += 1
  })
  recovery.beginRecovery('latest')
  assert.equal(calls, 1)
})

test('subscribe notifies on recordLoadFailure and terminal SETUP', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator({ loadMaxAttempts: 3 })
  let calls = 0
  recovery.subscribe(() => {
    calls += 1
  })
  recovery.beginRecovery('latest')
  recovery.recordLoadFailure('latest')
  recovery.recordLoadFailure('latest')
  recovery.recordLoadFailure('latest')
  assert.equal(calls, 4)
  assert.equal(recovery.getTerminalOutcome('latest'), NEURAL_RECOVERY_TERMINAL.SETUP)
})

test('subscribe notifies on recordInferFailure and terminal REFRESH', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator({ inferMaxAttempts: 3 })
  let calls = 0
  recovery.subscribe(() => {
    calls += 1
  })
  recovery.beginRecovery('latest')
  recovery.recordInferFailure('latest')
  recovery.recordInferFailure('latest')
  recovery.recordInferFailure('latest')
  assert.equal(calls, 4)
  assert.equal(recovery.getTerminalOutcome('latest'), NEURAL_RECOVERY_TERMINAL.REFRESH)
})

test('subscribe notifies on recordSuccess', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  let calls = 0
  recovery.subscribe(() => {
    calls += 1
  })
  recovery.beginRecovery('latest')
  recovery.recordLoadFailure('latest')
  recovery.recordSuccess('latest')
  assert.equal(calls, 3)
})

test('subscribe notifies on importSnapshot', () => {
  const source = createNeuralRuntimeRecoveryCoordinator({ inferMaxAttempts: 1 })
  source.beginRecovery('latest')
  source.recordInferFailure('latest')
  const snapshot = source.exportSnapshot()

  const recovery = createNeuralRuntimeRecoveryCoordinator()
  let calls = 0
  recovery.subscribe(() => {
    calls += 1
  })
  recovery.importSnapshot(snapshot)
  assert.equal(calls, 1)
  assert.equal(recovery.getTerminalOutcome('latest'), NEURAL_RECOVERY_TERMINAL.REFRESH)
})

test('subscribe does not notify on read-only queries', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  let calls = 0
  recovery.subscribe(() => {
    calls += 1
  })
  recovery.isRecovering('latest')
  recovery.getTerminalOutcome('latest')
  recovery.getLoadAttempts('latest')
  recovery.getInferAttempts('latest')
  recovery.getBackendPreference('latest', 'load')
  recovery.shouldBlockTurn('latest')
  recovery.exportSnapshot()
  assert.equal(calls, 0)
})

test('unsubscribe prevents further notifications', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  let calls = 0
  const unsubscribe = recovery.subscribe(() => {
    calls += 1
  })
  recovery.beginRecovery('latest')
  assert.equal(calls, 1)
  unsubscribe()
  recovery.recordLoadFailure('latest')
  recovery.recordSuccess('latest')
  assert.equal(calls, 1)
})

test('unsubscribe removes only the subscribed listener', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  let firstCalls = 0
  let secondCalls = 0
  const unsubscribeFirst = recovery.subscribe(() => {
    firstCalls += 1
  })
  recovery.subscribe(() => {
    secondCalls += 1
  })
  recovery.beginRecovery('latest')
  assert.equal(firstCalls, 1)
  assert.equal(secondCalls, 1)
  unsubscribeFirst()
  recovery.recordLoadFailure('latest')
  assert.equal(firstCalls, 1)
  assert.equal(secondCalls, 2)
})

test('subscribe notifies all listeners on each mutation', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  let firstCalls = 0
  let secondCalls = 0
  recovery.subscribe(() => {
    firstCalls += 1
  })
  recovery.subscribe(() => {
    secondCalls += 1
  })
  recovery.beginRecovery('latest')
  recovery.recordLoadFailure('latest')
  assert.equal(firstCalls, 2)
  assert.equal(secondCalls, 2)
})

test('importSnapshot no-op inputs do not notify subscribers', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  let calls = 0
  recovery.subscribe(() => {
    calls += 1
  })
  recovery.importSnapshot(null)
  recovery.importSnapshot(undefined)
  recovery.importSnapshot({})
  recovery.importSnapshot({ latest: null })
  recovery.importSnapshot({ latest: 'invalid' })
  assert.equal(calls, 0)
})

test('double unsubscribe is safe', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  let calls = 0
  const unsubscribe = recovery.subscribe(() => {
    calls += 1
  })
  recovery.beginRecovery('latest')
  assert.equal(calls, 1)
  unsubscribe()
  unsubscribe()
  recovery.recordLoadFailure('latest')
  assert.equal(calls, 1)
})
