import assert from 'node:assert/strict'
import test from 'node:test'
import { ref } from 'vue'
import { createLiveMatchPageSessionSink } from './createLiveMatchPageSessionSink.js'
import { resetLiveMatchPageState } from './resetLiveMatchPageState.js'

function createTestDeps(overrides = {}) {
  const match = ref({ id: 'm1' })
  const deferredPostDungeonState = ref({ foo: 1 })
  const nnDebugTraceText = ref('trace')
  const nnDebugTraceHistory = ref(['a'])
  const neuralLoadGateTerminalOpen = ref(false)
  let nnModelsWarmPromise = 'initial'
  let lastAppliedAiTurnToken = 'token'
  let presentationInputWasLocked = true
  const calls = []
  const presentationOrchestrator = {
    clear: () => {
      calls.push('clearPresentation')
    },
  }

  const deps = {
    match,
    setNnModelsWarmPromise: (promise) => {
      nnModelsWarmPromise = promise
      calls.push(['setNnModelsWarmPromise', promise === null ? null : 'promise'])
    },
    resetAiTurnPrefetch: () => {
      calls.push('resetAiTurnPrefetch')
    },
    setLastAppliedAiTurnTokenNull: () => {
      lastAppliedAiTurnToken = null
      calls.push('setLastAppliedAiTurnTokenNull')
    },
    setPresentationInputWasLockedFalse: () => {
      presentationInputWasLocked = false
      calls.push('setPresentationInputWasLockedFalse')
    },
    deferredPostDungeonState,
    nnDebugTraceText,
    nnDebugTraceHistory,
    presentationOrchestrator,
    syncPresentationLabel: () => {
      calls.push('syncPresentationLabel')
    },
    neuralLoadGateTerminalOpen,
    clearCurrentMatch: (storage) => {
      calls.push(['clearPersistedMatch', storage])
    },
    storage: { kind: 'mock-storage' },
    ...overrides,
  }

  return {
    deps,
    calls,
    match,
    deferredPostDungeonState,
    nnDebugTraceText,
    nnDebugTraceHistory,
    neuralLoadGateTerminalOpen,
    get nnModelsWarmPromise() {
      return nnModelsWarmPromise
    },
    get lastAppliedAiTurnToken() {
      return lastAppliedAiTurnToken
    },
    get presentationInputWasLocked() {
      return presentationInputWasLocked
    },
  }
}

test('createLiveMatchPageSessionSink wires all reset policy handlers', () => {
  const ctx = createTestDeps()
  const sink = createLiveMatchPageSessionSink(ctx.deps)

  sink.setMatchNull()
  sink.setNnModelsWarmPromise(Promise.resolve())
  sink.resetAiTurnPrefetch()
  sink.setLastAppliedAiTurnTokenNull()
  sink.setPresentationInputWasLockedFalse()
  sink.setDeferredPostDungeonStateNull()
  sink.clearDebugTraces()
  sink.clearPresentation()
  sink.syncPresentationLabel()
  sink.setNeuralLoadGateTerminalOpen(true)
  sink.clearPersistedMatch()

  assert.equal(ctx.match.value, null)
  assert.equal(ctx.deferredPostDungeonState.value, null)
  assert.equal(ctx.nnDebugTraceText.value, '')
  assert.deepEqual(ctx.nnDebugTraceHistory.value, [])
  assert.equal(ctx.neuralLoadGateTerminalOpen.value, true)
  assert.equal(ctx.lastAppliedAiTurnToken, null)
  assert.equal(ctx.presentationInputWasLocked, false)
  assert.deepEqual(ctx.calls.at(-1), ['clearPersistedMatch', ctx.deps.storage])
})

test('createLiveMatchPageSessionSink integrates with resetLiveMatchPageState for fresh match entry', () => {
  const ctx = createTestDeps()
  const sink = createLiveMatchPageSessionSink(ctx.deps)

  resetLiveMatchPageState(sink, { warmModelsResolved: true })

  assert.deepEqual(ctx.calls, [
    'setLastAppliedAiTurnTokenNull',
    'resetAiTurnPrefetch',
    ['setNnModelsWarmPromise', 'promise'],
    'setPresentationInputWasLockedFalse',
    'clearPresentation',
    'syncPresentationLabel',
  ])
  assert.equal(ctx.deferredPostDungeonState.value, null)
  assert.equal(ctx.nnDebugTraceText.value, '')
  assert.deepEqual(ctx.nnDebugTraceHistory.value, [])
})
