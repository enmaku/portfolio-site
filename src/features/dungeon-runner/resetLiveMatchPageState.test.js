import assert from 'node:assert/strict'
import test from 'node:test'
import { resetLiveMatchPageState } from './resetLiveMatchPageState.js'

function createRecordingSink(overrides = {}) {
  const calls = []
  return {
    calls,
    sink: {
      setMatchNull: () => {
        calls.push('setMatchNull')
      },
      setNnModelsWarmPromise: (promise) => {
        calls.push(['setNnModelsWarmPromise', promise === null ? null : 'resolved'])
      },
      resetAiTurnPrefetch: () => {
        calls.push('resetAiTurnPrefetch')
      },
      setLastAppliedAiTurnTokenNull: () => {
        calls.push('setLastAppliedAiTurnTokenNull')
      },
      setPresentationInputWasLockedFalse: () => {
        calls.push('setPresentationInputWasLockedFalse')
      },
      setDeferredPostDungeonStateNull: () => {
        calls.push('setDeferredPostDungeonStateNull')
      },
      clearDebugTraces: () => {
        calls.push('clearDebugTraces')
      },
      clearPresentation: () => {
        calls.push('clearPresentation')
      },
      syncPresentationLabel: () => {
        calls.push('syncPresentationLabel')
      },
      setNeuralLoadGateTerminalOpen: (open) => {
        calls.push(['setNeuralLoadGateTerminalOpen', open])
      },
      clearPersistedMatch: () => {
        calls.push('clearPersistedMatch')
      },
      ...overrides,
    },
  }
}

test('resetLiveMatchPageState clears shared session artifacts for fresh match entry', () => {
  const { sink, calls } = createRecordingSink()

  resetLiveMatchPageState(sink, { warmModelsResolved: true })

  assert.deepEqual(calls, [
    'setLastAppliedAiTurnTokenNull',
    'resetAiTurnPrefetch',
    ['setNnModelsWarmPromise', 'resolved'],
    'setPresentationInputWasLockedFalse',
    'setDeferredPostDungeonStateNull',
    'clearDebugTraces',
    'clearPresentation',
    'syncPresentationLabel',
  ])
})

test('resetLiveMatchPageState exits to setup and clears persisted match', () => {
  const { sink, calls } = createRecordingSink()

  resetLiveMatchPageState(sink, {
    clearMatch: true,
    clearPersistedMatch: true,
  })

  assert.deepEqual(calls, [
    'setMatchNull',
    'setLastAppliedAiTurnTokenNull',
    'resetAiTurnPrefetch',
    ['setNnModelsWarmPromise', null],
    'setPresentationInputWasLockedFalse',
    'setDeferredPostDungeonStateNull',
    'clearDebugTraces',
    'clearPresentation',
    'syncPresentationLabel',
    'clearPersistedMatch',
  ])
})

test('resetLiveMatchPageState opens neural load gate terminal when requested', () => {
  const { sink, calls } = createRecordingSink()

  resetLiveMatchPageState(sink, {
    clearMatch: true,
    openNeuralLoadGateTerminal: true,
  })

  assert.ok(calls.includes('setMatchNull'))
  assert.deepEqual(calls.at(-1), ['setNeuralLoadGateTerminalOpen', true])
})

test('resetLiveMatchPageState back-to-setup clears match without opening load gate terminal', () => {
  const { sink, calls } = createRecordingSink()

  resetLiveMatchPageState(sink, {
    clearMatch: true,
    clearPersistedMatch: true,
  })

  assert.ok(calls.includes('setMatchNull'))
  assert.ok(calls.includes('clearPersistedMatch'))
  assert.equal(
    calls.some(
      (call) => Array.isArray(call) && call[0] === 'setNeuralLoadGateTerminalOpen',
    ),
    false,
  )
})

test('resetLiveMatchPageState skips optional sinks when flags and handlers are absent', () => {
  const calls = []
  const sink = {
    setNnModelsWarmPromise: (promise) => {
      calls.push(['setNnModelsWarmPromise', promise === null ? null : 'resolved'])
    },
    resetAiTurnPrefetch: () => {
      calls.push('resetAiTurnPrefetch')
    },
    setLastAppliedAiTurnTokenNull: () => {
      calls.push('setLastAppliedAiTurnTokenNull')
    },
    setPresentationInputWasLockedFalse: () => {
      calls.push('setPresentationInputWasLockedFalse')
    },
    setDeferredPostDungeonStateNull: () => {
      calls.push('setDeferredPostDungeonStateNull')
    },
    clearDebugTraces: () => {
      calls.push('clearDebugTraces')
    },
    clearPresentation: () => {
      calls.push('clearPresentation')
    },
    syncPresentationLabel: () => {
      calls.push('syncPresentationLabel')
    },
  }

  resetLiveMatchPageState(sink, {
    clearMatch: true,
    openNeuralLoadGateTerminal: true,
    clearPersistedMatch: true,
  })

  assert.deepEqual(calls, [
    'setLastAppliedAiTurnTokenNull',
    'resetAiTurnPrefetch',
    ['setNnModelsWarmPromise', null],
    'setPresentationInputWasLockedFalse',
    'setDeferredPostDungeonStateNull',
    'clearDebugTraces',
    'clearPresentation',
    'syncPresentationLabel',
  ])
})
