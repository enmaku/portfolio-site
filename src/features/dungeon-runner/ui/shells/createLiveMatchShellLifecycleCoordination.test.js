import assert from 'node:assert/strict'
import test from 'node:test'
import { ref } from 'vue'
import { createLiveMatchShellLifecycleCoordination } from './createLiveMatchShellLifecycleCoordination.js'

function createStorage() {
  const map = new Map()
  return {
    setItem(key, value) {
      map.set(key, value)
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null
    },
  }
}

function createLifecycle(overrides = {}) {
  const calls = []
  const match = ref(null)
  const deferredPostDungeonState = ref(null)
  const debugMode = ref(false)
  let autoResolveTimerId = null
  let lifecycleUnsubscribe = null
  let lifecyclePresentationTimerId = null
  /** @type {(() => void) | null} */
  let matchStateStopHandle = null
  /** @type {Parameters<typeof import('./liveMatchShellLifecycle.js').activateLiveMatchShellLifecycle>[0] | null} */
  let lastActivateOptions = null
  /** @type {Parameters<typeof import('./liveMatchShellLifecycle.js').deactivateLiveMatchShellLifecycle>[0] | null} */
  let lastDeactivateState = null

  const deps = {
    match,
    debugMode,
    deferredPostDungeonState,
    dungeonRunnerSettingsStore: {
      setAnimationPace: (pace) => {
        calls.push(['setAnimationPace', pace])
      },
    },
    liveMatchPageSessionSink: { id: 'session-sink' },
    preparePresentationOnMount: () => {
      calls.push('preparePresentationOnMount')
    },
    resetPresentationForBootstrap: (pace) => {
      calls.push(['resetPresentationForBootstrap', pace])
    },
    setNnModelsWarmPromise: (promise) => {
      calls.push(['setNnModelsWarmPromise', promise != null])
    },
    presentationOrchestrator: { id: 'orchestrator' },
    syncPresentationLabel: () => {
      calls.push('syncPresentationLabel')
    },
    presentationTraceEnabled: () => false,
    nnRecovery: { subscribe: () => () => {} },
    onRecoveryChanged: () => {
      calls.push('onRecoveryChanged')
    },
    scheduleAiTurnOnPresentationTick: () => {
      calls.push('scheduleAiTurnOnPresentationTick')
    },
    scheduleHumanAutoResolveIfReady: () => {
      calls.push('scheduleHumanAutoResolveIfReady')
    },
    scheduleAiTurnIfReady: () => {
      calls.push('scheduleAiTurnIfReady')
    },
    storage: createStorage(),
    bootstrapRecoveryState: () => {
      calls.push('bootstrapRecoveryState')
    },
    cancelAiTurnPrefetch: () => {
      calls.push('cancelAiTurnPrefetch')
    },
    getAiTurnTimerId: () => 99,
    runOpponentHeadlessCompletion: async () => {
      calls.push('runOpponentHeadlessCompletion')
      return overrides.headlessResult ?? { kind: 'idle' }
    },
    logNnRecoveryTrace: (...args) => {
      calls.push(['logNnRecoveryTrace', ...args])
    },
    openNeuralRefreshTerminal: () => {
      calls.push('openNeuralRefreshTerminal')
    },
    getConfirmationDialogResolve: () => overrides.confirmationDialogResolve ?? null,
    getAutoResolveTimerId: () => autoResolveTimerId,
    subscribeMatchState: () => {
      calls.push('subscribeMatchState')
      matchStateStopHandle = () => {
        calls.push('stopMatchStateSubscription')
      }
      return matchStateStopHandle
    },
    unsubscribeMatchState: (stopHandle) => {
      calls.push(['unsubscribeMatchState', stopHandle === matchStateStopHandle])
      if (typeof stopHandle === 'function') stopHandle()
    },
    matchNeuralLoadGateInFlight: ref(false),
    neuralLoadGateTerminalOpen: ref(false),
    setup: { id: 'setup-default' },
    cloneSetup: (source) => ({ ...(source ?? { id: 'setup-default' }), cloned: true }),
    setAutoResolveTimerId: (id) => {
      autoResolveTimerId = id
    },
    activateLifecycle: (options) => {
      lastActivateOptions = options
      calls.push(['activateLifecycle', options.presentationOrchestrator.id])
      lifecycleUnsubscribe = () => {
        calls.push('lifecycleUnsubscribe')
      }
      lifecyclePresentationTimerId = 42
      return {
        unsubscribe: lifecycleUnsubscribe,
        presentationTimerId: lifecyclePresentationTimerId,
      }
    },
    deactivateLifecycle: (state) => {
      lastDeactivateState = state
      calls.push([
        'deactivateLifecycle',
        state.presentationTimerId,
        state.aiTurnTimerId,
        state.autoResolveTimerId,
        state.confirmationDialogResolve != null,
      ])
    },
    resetLiveMatchPageState: (sink, options) => {
      calls.push(['resetLiveMatchPageState', sink.id, options])
    },
    handleLivePlayNeuralRecoveryTerminalError: (options) => {
      calls.push(['handleLivePlayNeuralRecoveryTerminalError', options.error?.code ?? null])
      return overrides.neuralRecoveryResult ?? { handled: false }
    },
    runMatchEntryNeuralLoadGateForPage: async (...args) => {
      calls.push(['runMatchEntryNeuralLoadGateForPage', args[1]?.setupSnapshot?.id ?? null])
      return overrides.gateResult ?? { kind: 'ready' }
    },
    createMatchPageOrchestrationContext: (options) => {
      calls.push(['createMatchPageOrchestrationContext'])
      return {
        ctx: true,
        onSetupTerminal: options.onSetupTerminal,
        applySetupTerminal: (snapshot) => {
          calls.push(['applySetupTerminal', snapshot?.id ?? null])
          options.onSetupTerminal?.()
        },
      }
    },
    ...overrides.deps,
  }

  const lifecycle = createLiveMatchShellLifecycleCoordination(deps)

  return {
    lifecycle,
    calls,
    match,
    deferredPostDungeonState,
    debugMode,
    deps,
    lastActivateOptions: () => lastActivateOptions,
    lastDeactivateState: () => lastDeactivateState,
    setAutoResolveTimerId: (id) => {
      autoResolveTimerId = id
    },
  }
}

test('mountLiveMatchShell activates lifecycle once and marks active', () => {
  const { lifecycle, calls } = createLifecycle()

  lifecycle.mountLiveMatchShell()
  lifecycle.mountLiveMatchShell()

  assert.equal(lifecycle.isLifecycleActive(), true)
  assert.equal(calls.filter((entry) => entry === 'preparePresentationOnMount').length, 1)
  assert.ok(calls.includes('subscribeMatchState'))
  assert.ok(calls.some((entry) => Array.isArray(entry) && entry[0] === 'activateLifecycle'))
})

test('unmountLiveMatchShell tears down timers and clears active flag', () => {
  const { lifecycle, calls, setAutoResolveTimerId } = createLifecycle()

  lifecycle.mountLiveMatchShell()
  setAutoResolveTimerId(7)
  lifecycle.unmountLiveMatchShell()
  lifecycle.unmountLiveMatchShell()

  assert.equal(lifecycle.isLifecycleActive(), false)
  assert.deepEqual(calls.at(-1), ['deactivateLifecycle', 42, 99, 7, false])
  assert.ok(calls.includes('cancelAiTurnPrefetch'))
  assert.ok(calls.some((entry) => Array.isArray(entry) && entry[0] === 'unsubscribeMatchState'))
  assert.ok(calls.includes('stopMatchStateSubscription'))
})

test('processBootstrappedSession no-ops for no-saved-match', () => {
  const { lifecycle, calls, match } = createLifecycle()

  lifecycle.processBootstrappedSession({ kind: 'no-saved-match' })

  assert.equal(match.value, null)
  assert.ok(!calls.some((entry) => Array.isArray(entry) && entry[0] === 'resetLiveMatchPageState'))
  assert.ok(!calls.includes('bootstrapRecoveryState'))
})

test('processBootstrappedSession setup-terminal resets page state', () => {
  const { lifecycle, calls } = createLifecycle()

  lifecycle.processBootstrappedSession({ kind: 'setup-terminal' })

  assert.deepEqual(calls.at(-1), [
    'resetLiveMatchPageState',
    'session-sink',
    { clearMatch: true, openNeuralLoadGateTerminal: true },
  ])
})

test('processBootstrappedSession applies session and kicks headless completion', async () => {
  const { lifecycle, calls, match, deferredPostDungeonState } = createLifecycle({
    headlessResult: { kind: 'completed', match: { id: 'after-headless' } },
  })

  lifecycle.processBootstrappedSession({
    kind: 'resume',
    match: { id: 'bootstrapped' },
    presentationSpeedProfile: 'fast',
  })

  await Promise.resolve()

  assert.deepEqual(match.value, { id: 'after-headless' })
  assert.equal(deferredPostDungeonState.value, null)
  assert.ok(calls.includes('bootstrapRecoveryState'))
  assert.ok(calls.includes('runOpponentHeadlessCompletion'))
})

test('processBootstrappedSession refresh-terminal opens neural refresh dialog', () => {
  const { lifecycle, calls, match } = createLifecycle()

  lifecycle.processBootstrappedSession({
    kind: 'refresh-terminal',
    match: { id: 'refresh-match' },
    presentationSpeedProfile: 'normal',
  })

  assert.deepEqual(match.value, { id: 'refresh-match' })
  assert.ok(calls.includes('openNeuralRefreshTerminal'))
})

test('reset paths delegate to resetLiveMatchPageState with expected options', () => {
  const { lifecycle, calls } = createLifecycle()

  lifecycle.resetForSetupTerminal()
  lifecycle.resetForFreshMatchEntry()
  lifecycle.resetForBackToSetup()

  const resetCalls = calls.filter((entry) => Array.isArray(entry) && entry[0] === 'resetLiveMatchPageState')

  assert.deepEqual(resetCalls[0], [
    'resetLiveMatchPageState',
    'session-sink',
    { clearMatch: true, openNeuralLoadGateTerminal: true },
  ])
  assert.deepEqual(resetCalls[1], [
    'resetLiveMatchPageState',
    'session-sink',
    { warmModelsResolved: true },
  ])
  assert.deepEqual(resetCalls[2], [
    'resetLiveMatchPageState',
    'session-sink',
    { clearMatch: true, clearPersistedMatch: true },
  ])
})

test('maybeRunHeadlessMatchCompletion maps refresh-terminal to shell-local state', async () => {
  const { lifecycle, calls, match } = createLifecycle({
    headlessResult: {
      kind: 'refresh-terminal',
      match: { id: 'refresh-after-headless' },
      modelId: 'latest',
      terminal: 'LOAD',
      failureKind: 'timeout',
    },
  })

  await lifecycle.maybeRunHeadlessMatchCompletion()

  assert.deepEqual(match.value, { id: 'refresh-after-headless' })
  assert.ok(calls.includes('openNeuralRefreshTerminal'))
  assert.deepEqual(calls.at(-1), [
    'logNnRecoveryTrace',
    'latest',
    'terminal',
    { terminal: 'LOAD', failureKind: 'timeout' },
  ])
})

test('handleNeuralRecoveryTerminalError maps refresh-dialog outcome', () => {
  const { lifecycle, calls, match } = createLifecycle({
    neuralRecoveryResult: {
      handled: true,
      action: 'refresh-dialog',
      match: { id: 'recovery-match' },
      trace: { modelId: 'm1', terminal: 'INFER', failureKind: null },
    },
  })

  const handled = lifecycle.handleNeuralRecoveryTerminalError({ code: 'terminal' })

  assert.equal(handled, true)
  assert.deepEqual(match.value, { id: 'recovery-match' })
  assert.ok(calls.includes('openNeuralRefreshTerminal'))
})

test('kickMatchAutomation schedules only while lifecycle is active', () => {
  const { lifecycle, calls } = createLifecycle()

  lifecycle.kickMatchAutomation()
  assert.equal(
    calls.filter((entry) => entry === 'scheduleHumanAutoResolveIfReady').length,
    0,
  )

  lifecycle.mountLiveMatchShell()
  lifecycle.kickMatchAutomation()

  assert.ok(calls.includes('scheduleHumanAutoResolveIfReady'))
  assert.ok(calls.includes('scheduleAiTurnIfReady'))
})

test('runLivePageMatchEntryGate delegates to match page orchestration', async () => {
  const { lifecycle, calls } = createLifecycle()

  await lifecycle.runLivePageMatchEntryGate({ id: 'setup-1' })

  assert.deepEqual(calls.at(-1), ['runMatchEntryNeuralLoadGateForPage', 'setup-1'])
})

test('matchPageOrchestrationCtx setup terminal callback resets page state', () => {
  const { lifecycle, calls } = createLifecycle()

  lifecycle.matchPageOrchestrationCtx.onSetupTerminal()

  assert.deepEqual(calls.at(-1), [
    'resetLiveMatchPageState',
    'session-sink',
    { clearMatch: true, openNeuralLoadGateTerminal: true },
  ])
})

test('applyBootstrappedMatchSession maps envelope pace and clears deferred state', () => {
  const { lifecycle, calls, match, deferredPostDungeonState } = createLifecycle()

  deferredPostDungeonState.value = { phase: 'dungeon' }
  lifecycle.applyBootstrappedMatchSession({ id: 'bootstrapped' }, 'fast')

  assert.deepEqual(match.value, { id: 'bootstrapped' })
  assert.equal(deferredPostDungeonState.value, null)
  assert.deepEqual(calls.at(-1), ['setNnModelsWarmPromise', true])
  assert.ok(calls.includes('bootstrapRecoveryState'))
  assert.deepEqual(calls.find((entry) => Array.isArray(entry) && entry[0] === 'setAnimationPace'), [
    'setAnimationPace',
    'fast',
  ])
  assert.deepEqual(
    calls.find((entry) => Array.isArray(entry) && entry[0] === 'resetPresentationForBootstrap'),
    ['resetPresentationForBootstrap', 'fast'],
  )
})

test('maybeRunHeadlessMatchCompletion completed updates match without refresh dialog', async () => {
  const { lifecycle, calls, match } = createLifecycle({
    headlessResult: { kind: 'completed', match: { id: 'completed-match' } },
  })

  match.value = { id: 'before' }
  await lifecycle.maybeRunHeadlessMatchCompletion()

  assert.deepEqual(match.value, { id: 'completed-match' })
  assert.ok(!calls.includes('openNeuralRefreshTerminal'))
  assert.ok(!calls.some((entry) => Array.isArray(entry) && entry[0] === 'logNnRecoveryTrace'))
})

test('maybeRunHeadlessMatchCompletion idle leaves match unchanged', async () => {
  const { lifecycle, calls, match } = createLifecycle({
    headlessResult: { kind: 'idle' },
  })

  match.value = { id: 'unchanged' }
  await lifecycle.maybeRunHeadlessMatchCompletion()

  assert.deepEqual(match.value, { id: 'unchanged' })
  assert.ok(!calls.includes('openNeuralRefreshTerminal'))
})

test('handleNeuralRecoveryTerminalError returns false when terminal handler does not handle', () => {
  const { lifecycle, calls } = createLifecycle({
    neuralRecoveryResult: { handled: false },
  })

  const handled = lifecycle.handleNeuralRecoveryTerminalError({ code: 'ignored' })

  assert.equal(handled, false)
  assert.ok(!calls.includes('openNeuralRefreshTerminal'))
})

test('handleNeuralRecoveryTerminalError setup-restore routes through orchestration ctx', () => {
  const { lifecycle, calls } = createLifecycle({
    neuralRecoveryResult: { handled: true, action: 'setup-restore' },
  })

  const handled = lifecycle.handleNeuralRecoveryTerminalError({ code: 'terminal' })

  assert.equal(handled, true)
  assert.ok(
    calls.some(
      (entry) => Array.isArray(entry) && entry[0] === 'handleLivePlayNeuralRecoveryTerminalError',
    ),
  )
  assert.ok(!calls.includes('openNeuralRefreshTerminal'))
})

test('unmountLiveMatchShell forwards confirmation dialog resolve to deactivate', () => {
  const resolve = () => {}
  const { lifecycle, lastDeactivateState } = createLifecycle({
    confirmationDialogResolve: resolve,
  })

  lifecycle.mountLiveMatchShell()
  lifecycle.unmountLiveMatchShell()

  assert.equal(lastDeactivateState()?.confirmationDialogResolve, resolve)
})

test('mountLiveMatchShell wires presentation tick callbacks from lifecycle deps', () => {
  const { lifecycle, lastActivateOptions, calls } = createLifecycle()

  lifecycle.mountLiveMatchShell()

  const tickCallbacks = lastActivateOptions()?.tickCallbacks
  assert.ok(tickCallbacks)
  tickCallbacks.scheduleAiTurnIfReady()
  tickCallbacks.scheduleHumanAutoResolveIfReady()
  tickCallbacks.syncPresentationLabel()

  assert.ok(calls.includes('scheduleAiTurnOnPresentationTick'))
  assert.ok(calls.includes('scheduleHumanAutoResolveIfReady'))
  assert.ok(calls.includes('syncPresentationLabel'))
  assert.equal(calls.filter((entry) => entry === 'scheduleAiTurnIfReady').length, 0)
})
