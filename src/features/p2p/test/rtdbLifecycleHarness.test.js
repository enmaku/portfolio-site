/**
 * Run: node --experimental-test-module-mocks --test src/features/p2p/test/rtdbLifecycleHarness.test.js
 */
import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import {
  createRtdbLifecycleAfterEach,
  installRtdbLifecycleMocks,
  refPath,
  withFirebaseEnv,
} from './rtdbLifecycleHarness.js'

const harnessTests = { skip: !mock.module }
const rtdbAfterEach = createRtdbLifecycleAfterEach(mock)

test('installRtdbLifecycleMocks captures set and remove writes', harnessTests, async () => {
  mock.reset()
  const harness = await installRtdbLifecycleMocks()
  const { set, remove } = await import('firebase/database')

  const stateRef = { key: 'state', parent: { key: 'ABC', parent: { key: 'rooms', parent: null } } }
  const hostPingRef = {
    key: 'hostPing',
    parent: { key: 'ABC', parent: { key: 'rooms', parent: null } },
  }

  await set(stateRef, { seq: 1 })
  await remove(hostPingRef)

  assert.equal(harness.sets.length, 1)
  assert.equal(harness.sets[0].path, 'rooms/ABC/state')
  assert.equal(harness.removes.length, 1)
  assert.equal(harness.removes[0].path, 'rooms/ABC/hostPing')
})

test('refPath joins ref keys from leaf to root', () => {
  assert.equal(
    refPath({ key: 'state', parent: { key: 'ABC', parent: { key: 'rooms', parent: null } } }),
    'rooms/ABC/state',
  )
})

test('withFirebaseEnv restores process.env after run', async () => {
  const prior = process.env.VITE_FIREBASE_API_KEY
  await withFirebaseEnv(async () => {
    assert.equal(process.env.VITE_FIREBASE_API_KEY, 'test-api-key')
  })
  assert.equal(process.env.VITE_FIREBASE_API_KEY, prior)
})

test('emitValue delivers to onValue listener', harnessTests, async () => {
  mock.reset()
  const harness = await installRtdbLifecycleMocks()
  let seen = null
  harness.listeners.set('rooms/ROOM/state', (snap) => {
    seen = snap.val()
  })
  harness.emitValue('rooms/ROOM/state', { seq: 2 })
  assert.deepEqual(seen, { seq: 2 })
})

afterEach(rtdbAfterEach)
