import assert from 'node:assert/strict'
import test from 'node:test'
import {
  activateLiveMatchShellLifecycle,
  deactivateLiveMatchShellLifecycle,
} from './liveMatchShellLifecycle.js'

test('activateLiveMatchShellLifecycle subscribes to recovery and starts presentation interval', () => {
  let subscribed = false
  let intervalCallback = null
  const recovery = {
    subscribe(listener) {
      subscribed = true
      listener()
      return () => {
        subscribed = false
      }
    },
  }
  const presentationOrchestrator = { tick: true }
  const tickCallbacks = { syncPresentationLabel: () => {} }

  const { unsubscribe, presentationTimerId } = activateLiveMatchShellLifecycle({
    recovery,
    onRecoveryChanged: () => {},
    presentationOrchestrator,
    tickCallbacks,
    setInterval: (cb) => {
      intervalCallback = cb
      return 42
    },
  })

  assert.equal(subscribed, true)
  assert.equal(presentationTimerId, 42)
  assert.equal(typeof intervalCallback, 'function')
  unsubscribe()
  assert.equal(subscribed, false)
})

test('deactivateLiveMatchShellLifecycle clears timers and settles confirmation', () => {
  let intervalCleared = false
  let aiTurnCleared = false
  let autoResolveCleared = false
  let confirmationResult = null

  deactivateLiveMatchShellLifecycle({
    unsubscribe: () => {},
    presentationTimerId: 1,
    aiTurnTimerId: 2,
    autoResolveTimerId: 3,
    confirmationDialogResolve: (value) => {
      confirmationResult = value
    },
    clearInterval: (id) => {
      if (id === 1) intervalCleared = true
    },
    clearTimeout: (id) => {
      if (id === 2) aiTurnCleared = true
      if (id === 3) autoResolveCleared = true
    },
  })

  assert.equal(intervalCleared, true)
  assert.equal(aiTurnCleared, true)
  assert.equal(autoResolveCleared, true)
  assert.equal(confirmationResult, false)
})
