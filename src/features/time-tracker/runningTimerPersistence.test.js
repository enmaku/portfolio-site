import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearRunningTimer,
  decideSignOutRunningTimer,
  loadRunningTimer,
  runningTimerStorageKey,
  saveRunningTimer,
} from './runningTimerPersistence.js'

function memoryStorage(initial = {}) {
  const data = { ...initial }
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null
    },
    setItem(key, value) {
      data[key] = String(value)
    },
    removeItem(key) {
      delete data[key]
    },
    data,
  }
}

test('running timer persistence is keyed by account owner id', () => {
  assert.equal(runningTimerStorageKey('uid-1'), 'time-tracker:running-timer:uid-1')
  const storage = memoryStorage()
  const running = { projectId: 'p1', startedAt: 10, description: 'x' }
  saveRunningTimer({ ownerUid: 'uid-1', running, storage })
  assert.deepEqual(loadRunningTimer({ ownerUid: 'uid-1', storage }), running)
  assert.equal(loadRunningTimer({ ownerUid: 'uid-2', storage }), null)
})

test('sign-out keeps the per-owner running timer when the pause write fails', () => {
  assert.equal(decideSignOutRunningTimer({ writeSucceeded: true }), 'clear')
  assert.equal(decideSignOutRunningTimer({ writeSucceeded: false }), 'keep')
  const storage = memoryStorage()
  saveRunningTimer({
    ownerUid: 'uid-1',
    running: { projectId: 'p1', startedAt: 1, description: '' },
    storage,
  })
  if (decideSignOutRunningTimer({ writeSucceeded: false }) === 'clear') {
    clearRunningTimer({ ownerUid: 'uid-1', storage })
  }
  assert.ok(loadRunningTimer({ ownerUid: 'uid-1', storage }))
  clearRunningTimer({ ownerUid: 'uid-1', storage })
  assert.equal(loadRunningTimer({ ownerUid: 'uid-1', storage }), null)
})
