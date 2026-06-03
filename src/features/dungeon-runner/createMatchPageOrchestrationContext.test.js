import assert from 'node:assert/strict'
import test from 'node:test'
import { applySetupSnapshot } from './setup/state.js'
import {
  clearCurrentMatch,
  loadCurrentMatch,
  persistCurrentMatch,
} from './persistence/currentMatch.js'
import { createNeuralRuntimeRecoveryCoordinator } from './nn/recovery.js'
import { createMatchPageOrchestrationContext } from './createMatchPageOrchestrationContext.js'

function createMemoryStorage() {
  const map = new Map()
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null
    },
    setItem(key, value) {
      map.set(key, String(value))
    },
    removeItem(key) {
      map.delete(key)
    },
  }
}

function createTestContext(overrides = {}) {
  const storage = overrides.storage ?? createMemoryStorage()
  const setupTarget = overrides.setupTarget ?? { totalSeats: 2, opponents: [] }
  const inFlightCalls = []
  const loadCalls = []
  const setupTerminalCalls = []
  const onSetupTerminalCalls = []

  const ctx = createMatchPageOrchestrationContext({
    storage,
    recovery: overrides.recovery ?? createNeuralRuntimeRecoveryCoordinator(),
    loadModel:
      overrides.loadModel ??
      ((modelId) => {
        loadCalls.push(modelId)
        return Promise.resolve()
      }),
    setMatchNeuralLoadGateInFlight: (inFlight) => {
      inFlightCalls.push(inFlight)
    },
    clearCurrentMatch,
    persistCurrentMatch,
    applySetupSnapshot,
    setupTarget,
    cloneSetup: overrides.cloneSetup ?? ((setup) => structuredClone(setup)),
    onSetupTerminal: () => {
      onSetupTerminalCalls.push(true)
    },
    ...overrides.factoryOverrides,
  })

  return {
    ctx,
    storage,
    setupTarget,
    inFlightCalls,
    loadCalls,
    setupTerminalCalls,
    onSetupTerminalCalls,
  }
}

test('createMatchPageOrchestrationContext exposes bundled page dependencies', () => {
  const { ctx } = createTestContext()

  assert.equal(typeof ctx.storage.getItem, 'function')
  assert.equal(typeof ctx.recovery.importSnapshot, 'function')
  assert.equal(typeof ctx.loadModel, 'function')
  assert.equal(typeof ctx.setMatchNeuralLoadGateInFlight, 'function')
  assert.equal(typeof ctx.clearCurrentMatch, 'function')
  assert.equal(typeof ctx.persistCurrentMatch, 'function')
  assert.equal(typeof ctx.applySetupSnapshot, 'function')
  assert.equal(typeof ctx.setupTarget, 'object')
  assert.equal(typeof ctx.cloneSetup, 'function')
  assert.equal(typeof ctx.resolveSetupTerminal, 'function')
  assert.equal(typeof ctx.applySetupTerminal, 'function')
})

test('createMatchPageOrchestrationContext resolveSetupTerminal restores setup and clears match', () => {
  const setupSnapshot = {
    totalSeats: 2,
    opponents: [{ type: 'nn', modelId: 'latest' }],
  }
  const { ctx, storage, setupTarget } = createTestContext({
    setupTarget: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
  })
  persistCurrentMatch(storage, {
    schemaVersion: 1,
    id: 'm-context-setup-terminal',
    setup: setupSnapshot,
    state: {},
    history: [],
  })

  ctx.resolveSetupTerminal(setupSnapshot)

  assert.deepEqual(setupTarget, setupSnapshot)
  assert.equal(loadCurrentMatch(storage).ok, false)
})

test('createMatchPageOrchestrationContext applySetupTerminal runs optional page hook', () => {
  const setupSnapshot = {
    totalSeats: 2,
    opponents: [{ type: 'nn', modelId: 'latest' }],
  }
  const { ctx, onSetupTerminalCalls } = createTestContext()

  ctx.applySetupTerminal(setupSnapshot)

  assert.deepEqual(onSetupTerminalCalls, [true])
})
