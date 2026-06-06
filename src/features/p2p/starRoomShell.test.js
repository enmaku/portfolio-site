import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'node:test'
import { starRoomReconnectDelayMs } from './starRoomReconnectDelay.js'
import {
  runGuestStarReconnectLoop,
  runHostStarReconnectLoop,
} from './starRoomShell.js'
import {
  RECONNECT_INITIAL_PAUSE_MS,
  RECONNECT_MAX_ATTEMPTS,
} from './starRoomTiming.js'

afterEach(() => {
  mock.restoreAll()
})

/** @typedef {'guest' | 'host'} ReconnectRole */

/**
 * @param {ReconnectRole} role
 * @returns {'establishGuest' | 'establishHost'}
 */
function establishEvent(role) {
  return role === 'guest' ? 'establishGuest' : 'establishHost'
}

/**
 * @param {string[]} eventLog
 * @param {ReconnectRole} role
 */
function assertDestroyBeforeEachEstablish(eventLog, role) {
  const establish = establishEvent(role)
  const establishIndices = eventLog
    .map((event, index) => (event === establish ? index : -1))
    .filter((index) => index >= 0)

  assert.ok(establishIndices.length > 0)
  for (const index of establishIndices) {
    assert.equal(eventLog[index - 1], 'destroyWireOnly')
  }
}

/**
 * @param {ReconnectRole} role
 * @param {Record<string, unknown>} [options]
 */
function createReconnectStubs(role, options = {}) {
  const gen = /** @type {number} */ (options.gen ?? 1)
  const getReconnectGeneration =
    /** @type {() => number} */ (options.getReconnectGeneration ?? (() => gen))
  const establishBehavior = /** @type {(() => Promise<void>) | undefined} */ (
    options.establishBehavior
  )
  const establishResult = /** @type {'resolve' | 'reject'} */ (options.establishResult ?? 'resolve')
  const sleepOverride = /** @type {((ms: number) => Promise<void>) | undefined} */ (
    options.sleep
  )

  /** @type {number[]} */
  const sleepCalls = []
  /** @type {{ attempt: number, max: number }[]} */
  const progressNotifyCalls = []
  /** @type {number[]} */
  const destroyWireOnlyCalls = []
  /** @type {number[]} */
  const establishCalls = []
  /** @type {string[]} */
  const eventLog = []
  let clearRoomPersistenceCalls = 0
  let fatalNotifyCalls = 0
  let teardownSessionCalls = 0

  /** @param {number} ms */
  const sleep = sleepOverride
    ? async (ms) => {
        sleepCalls.push(ms)
        return sleepOverride(ms)
      }
    : async (ms) => {
        sleepCalls.push(ms)
      }

  /** @type {Record<string, unknown>} */
  const handlers = {
    gen,
    getReconnectGeneration,
    sleep,
    destroyWireOnly: () => {
      destroyWireOnlyCalls.push(destroyWireOnlyCalls.length + 1)
      eventLog.push('destroyWireOnly')
    },
    clearRoomPersistence: () => {
      clearRoomPersistenceCalls += 1
      eventLog.push('clearRoomPersistence')
    },
    teardownSession: () => {
      teardownSessionCalls += 1
      eventLog.push('teardownSession')
    },
  }

  /** @returns {Promise<void>} */
  const runEstablish = async () => {
    establishCalls.push(establishCalls.length + 1)
    eventLog.push(establishEvent(role))
    if (establishBehavior) return establishBehavior()
    if (establishResult === 'reject') throw new Error('establish failed')
  }

  if (role === 'guest') {
    handlers.notifyReconnectingGuest = (attempt, max) => {
      progressNotifyCalls.push({ attempt, max })
      eventLog.push('notifyProgress')
    }
    handlers.establishGuest = runEstablish
    handlers.notifyGuestReconnectFailed = () => {
      fatalNotifyCalls += 1
      eventLog.push('notifyFatal')
    }
  } else {
    handlers.notifyReconnectingHost = (attempt, max) => {
      progressNotifyCalls.push({ attempt, max })
      eventLog.push('notifyProgress')
    }
    handlers.establishHost = runEstablish
    handlers.notifyHostReconnectFailed = () => {
      fatalNotifyCalls += 1
      eventLog.push('notifyFatal')
    }
  }

  return {
    handlers,
    sleepCalls,
    progressNotifyCalls,
    destroyWireOnlyCalls,
    establishCalls,
    eventLog,
    get clearRoomPersistenceCalls() {
      return clearRoomPersistenceCalls
    },
    get fatalNotifyCalls() {
      return fatalNotifyCalls
    },
    get teardownSessionCalls() {
      return teardownSessionCalls
    },
  }
}

/**
 * @param {ReconnectRole} role
 * @param {Record<string, unknown>} handlers
 * @returns {Promise<void>}
 */
function runReconnectLoop(role, handlers) {
  return role === 'guest'
    ? runGuestStarReconnectLoop(/** @type {import('./starRoomShell.js').StarRoomGuestReconnectHandlers} */ (handlers))
    : runHostStarReconnectLoop(/** @type {import('./starRoomShell.js').StarRoomHostReconnectHandlers} */ (handlers))
}

for (const role of /** @type {const} */ (['guest', 'host'])) {
  test(`${role} reconnect loop sleeps initial pause before generation check`, async () => {
    const stubs = createReconnectStubs(role, {
      getReconnectGeneration: () => 2,
    })

    await runReconnectLoop(role, stubs.handlers)

    assert.deepEqual(stubs.sleepCalls, [RECONNECT_INITIAL_PAUSE_MS])
    assert.equal(stubs.progressNotifyCalls.length, 0)
    assert.equal(stubs.establishCalls.length, 0)
    assert.equal(stubs.teardownSessionCalls, 0)
    assert.equal(stubs.fatalNotifyCalls, 0)
  })

  test(`${role} reconnect loop silently aborts after initial pause on generation mismatch`, async () => {
    const stubs = createReconnectStubs(role, { gen: 1, getReconnectGeneration: () => 2 })

    await runReconnectLoop(role, stubs.handlers)

    assert.equal(stubs.progressNotifyCalls.length, 0)
    assert.equal(stubs.establishCalls.length, 0)
    assert.equal(stubs.destroyWireOnlyCalls.length, 0)
    assert.equal(stubs.clearRoomPersistenceCalls, 0)
    assert.equal(stubs.fatalNotifyCalls, 0)
    assert.equal(stubs.teardownSessionCalls, 0)
    assert.ok(!stubs.eventLog.includes('notifyProgress'))
    assert.ok(!stubs.eventLog.includes('notifyFatal'))
  })

  test(`${role} reconnect loop silently aborts at attempt start on generation mismatch`, async () => {
    let currentGen = 1
    const stubs = createReconnectStubs(role, {
      gen: 1,
      getReconnectGeneration: () => currentGen,
      establishBehavior: async () => {
        currentGen = 2
        throw new Error('establish failed')
      },
    })

    await runReconnectLoop(role, stubs.handlers)

    assert.equal(stubs.establishCalls.length, 1)
    assert.equal(stubs.progressNotifyCalls.length, 0)
    assert.equal(stubs.fatalNotifyCalls, 0)
    assert.equal(stubs.teardownSessionCalls, 0)
    assert.ok(!stubs.eventLog.includes('notifyProgress'))
    assert.ok(!stubs.eventLog.includes('notifyFatal'))
  })

  test(`${role} reconnect loop skips progress notify on attempt 1`, async () => {
    const stubs = createReconnectStubs(role)

    await runReconnectLoop(role, stubs.handlers)

    assert.equal(stubs.progressNotifyCalls.length, 0)
    assert.equal(stubs.establishCalls.length, 1)
    assert.equal(stubs.destroyWireOnlyCalls.length, 1)
  })

  test(`${role} reconnect loop notifies progress from attempt 2 onward`, async () => {
    mock.method(Math, 'random', () => 0)

    const stubs = createReconnectStubs(role, {
      establishBehavior: async () => {
        if (stubs.establishCalls.length < RECONNECT_MAX_ATTEMPTS) {
          throw new Error('establish failed')
        }
      },
    })

    await runReconnectLoop(role, stubs.handlers)

    assert.equal(stubs.progressNotifyCalls.length, RECONNECT_MAX_ATTEMPTS - 1)
    assert.deepEqual(
      stubs.progressNotifyCalls.map(({ attempt }) => attempt),
      Array.from({ length: RECONNECT_MAX_ATTEMPTS - 1 }, (_, i) => i + 2),
    )
    for (const { max } of stubs.progressNotifyCalls) {
      assert.equal(max, RECONNECT_MAX_ATTEMPTS)
    }
    assert.deepEqual(
      stubs.sleepCalls.slice(1),
      Array.from({ length: RECONNECT_MAX_ATTEMPTS - 1 }, (_, i) =>
        starRoomReconnectDelayMs(i),
      ),
    )
  })

  test(`${role} reconnect loop destroys wire before each establish attempt`, async () => {
    const stubs = createReconnectStubs(role, {
      establishBehavior: async () => {
        if (stubs.establishCalls.length < 3) throw new Error('establish failed')
      },
    })

    await runReconnectLoop(role, stubs.handlers)

    assert.equal(stubs.establishCalls.length, 3)
    assert.equal(stubs.destroyWireOnlyCalls.length, 3)
    assertDestroyBeforeEachEstablish(stubs.eventLog, role)
  })

  test(`${role} reconnect loop returns early on first successful establish`, async () => {
    const stubs = createReconnectStubs(role, {
      establishBehavior: async () => {
        if (stubs.establishCalls.length < 2) throw new Error('establish failed')
      },
    })

    await runReconnectLoop(role, stubs.handlers)

    assert.equal(stubs.establishCalls.length, 2)
    assert.equal(stubs.teardownSessionCalls, 0)
    assert.equal(stubs.fatalNotifyCalls, 0)
    assert.equal(stubs.clearRoomPersistenceCalls, 0)
    assertDestroyBeforeEachEstablish(stubs.eventLog, role)
    assert.equal(stubs.eventLog.at(-1), establishEvent(role))
  })

  test(`${role} reconnect loop tears down wire only when superseded after success`, async () => {
    let currentGen = 1
    const stubs = createReconnectStubs(role, {
      gen: 1,
      getReconnectGeneration: () => currentGen,
      establishBehavior: async () => {
        currentGen = 2
      },
    })

    await runReconnectLoop(role, stubs.handlers)

    assert.equal(stubs.establishCalls.length, 1)
    assert.equal(stubs.destroyWireOnlyCalls.length, 2)
    assert.equal(stubs.teardownSessionCalls, 1)
    assert.equal(stubs.fatalNotifyCalls, 0)
    assert.equal(stubs.clearRoomPersistenceCalls, 0)
    assert.deepEqual(stubs.eventLog, [
      'destroyWireOnly',
      establishEvent(role),
      'destroyWireOnly',
      'teardownSession',
    ])
    assert.ok(!stubs.eventLog.includes('notifyFatal'))
  })

  test(`${role} reconnect loop runs fatal trio after exhausting attempts`, async () => {
    const stubs = createReconnectStubs(role, { establishResult: 'reject' })

    await runReconnectLoop(role, stubs.handlers)

    assert.equal(stubs.establishCalls.length, RECONNECT_MAX_ATTEMPTS)
    assert.equal(stubs.clearRoomPersistenceCalls, 1)
    assert.equal(stubs.fatalNotifyCalls, 1)
    assert.equal(stubs.teardownSessionCalls, 1)
    const fatalTrio = stubs.eventLog.slice(-3)
    assert.deepEqual(fatalTrio, ['clearRoomPersistence', 'notifyFatal', 'teardownSession'])
  })

  test(`${role} reconnect loop silently aborts after exhaustion on generation mismatch`, async () => {
    let currentGen = 1
    const stubs = createReconnectStubs(role, {
      gen: 1,
      getReconnectGeneration: () => currentGen,
      establishResult: 'reject',
    })

    const loop = runReconnectLoop(role, stubs.handlers)
    while (stubs.establishCalls.length < RECONNECT_MAX_ATTEMPTS) {
      await Promise.resolve()
    }
    currentGen = 2
    await loop

    assert.equal(stubs.clearRoomPersistenceCalls, 0)
    assert.equal(stubs.fatalNotifyCalls, 0)
    assert.equal(stubs.teardownSessionCalls, 0)
    assert.ok(!stubs.eventLog.includes('notifyFatal'))
    assert.ok(!stubs.eventLog.includes('clearRoomPersistence'))
  })

  test(`${role} reconnect loop silently aborts after backoff sleep on generation mismatch`, async () => {
    let currentGen = 1
    const stubs = createReconnectStubs(role, {
      gen: 1,
      getReconnectGeneration: () => currentGen,
      establishResult: 'reject',
      sleep: async (ms) => {
        if (ms !== RECONNECT_INITIAL_PAUSE_MS) currentGen = 2
      },
    })

    await runReconnectLoop(role, stubs.handlers)

    assert.equal(stubs.establishCalls.length, 1)
    assert.equal(stubs.progressNotifyCalls.length, 1)
    assert.deepEqual(stubs.progressNotifyCalls[0], {
      attempt: 2,
      max: RECONNECT_MAX_ATTEMPTS,
    })
    assert.equal(stubs.fatalNotifyCalls, 0)
    assert.equal(stubs.teardownSessionCalls, 0)
    assert.equal(stubs.clearRoomPersistenceCalls, 0)
    assert.ok(!stubs.eventLog.includes('notifyFatal'))
    assert.ok(!stubs.eventLog.includes('clearRoomPersistence'))
    assert.ok(!stubs.eventLog.includes('teardownSession'))
  })
}
