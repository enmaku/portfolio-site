import assert from 'node:assert/strict'
import test from 'node:test'
import { createNoSleepController } from './noSleepController.js'

function createFakeDoc(visibilityState = 'visible') {
  /** @type {Array<{ type: string, fn: () => void, capture: boolean }>} */
  const entries = []
  return {
    visibilityState,
    addEventListener(type, fn, options) {
      const capture = Boolean(options && typeof options === 'object' && options.capture)
      entries.push({ type, fn, capture })
    },
    removeEventListener(type, fn, options) {
      const capture = Boolean(options && typeof options === 'object' && options.capture)
      const i = entries.findIndex((e) => e.type === type && e.fn === fn && e.capture === capture)
      if (i >= 0) entries.splice(i, 1)
    },
    entries,
    emit(type) {
      for (const e of entries.filter((x) => x.type === type)) {
        e.fn()
      }
    },
  }
}

test('sync with readEnabled true calls enable on a new library instance', async () => {
  let enables = 0
  const mock = {
    enable: async () => {
      enables += 1
    },
    disable: () => {},
  }
  const doc = createFakeDoc()
  const c = createNoSleepController({
    readEnabled: () => true,
    createNoSleep: () => mock,
    doc,
  })
  await c.sync()
  assert.equal(enables, 1)
})

test('sync with readEnabled false after true calls disable and detaches document listeners', async () => {
  let disables = 0
  const mock = {
    enable: async () => {},
    disable: () => {
      disables += 1
    },
  }
  const doc = createFakeDoc()
  let enabled = true
  const c = createNoSleepController({
    readEnabled: () => enabled,
    createNoSleep: () => mock,
    doc,
  })
  await c.sync()
  assert.ok(doc.entries.some((e) => e.type === 'visibilitychange'))
  assert.ok(doc.entries.some((e) => e.type === 'pointerdown' && e.capture))
  enabled = false
  await c.sync()
  assert.equal(disables, 1)
  assert.equal(doc.entries.length, 0)
})

test('visibilitychange to visible while enabled attempts enable again', async () => {
  let enables = 0
  const mock = {
    enable: async () => {
      enables += 1
    },
    disable: () => {},
  }
  const doc = createFakeDoc('hidden')
  const c = createNoSleepController({
    readEnabled: () => true,
    createNoSleep: () => mock,
    doc,
  })
  await c.sync()
  assert.equal(enables, 1)
  doc.visibilityState = 'visible'
  doc.emit('visibilitychange')
  assert.equal(enables, 2)
})

test('pointerdown while enabled attempts enable again', async () => {
  let enables = 0
  const mock = {
    enable: async () => {
      enables += 1
    },
    disable: () => {},
  }
  const doc = createFakeDoc()
  const c = createNoSleepController({
    readEnabled: () => true,
    createNoSleep: () => mock,
    doc,
  })
  await c.sync()
  assert.equal(enables, 1)
  doc.emit('pointerdown')
  assert.equal(enables, 2)
})

test('cleanup disables and removes listeners', async () => {
  let disables = 0
  const mock = {
    enable: async () => {},
    disable: () => {
      disables += 1
    },
  }
  const doc = createFakeDoc()
  const c = createNoSleepController({
    readEnabled: () => true,
    createNoSleep: () => mock,
    doc,
  })
  await c.sync()
  assert.ok(doc.entries.length > 0)
  c.cleanup()
  assert.equal(disables, 1)
  assert.equal(doc.entries.length, 0)
})

test('createNoSleep is invoked once across repeated sync while enabled', async () => {
  let created = 0
  const mock = {
    enable: async () => {},
    disable: () => {},
  }
  const doc = createFakeDoc()
  const c = createNoSleepController({
    readEnabled: () => true,
    createNoSleep: () => {
      created += 1
      return mock
    },
    doc,
  })
  await c.sync()
  await c.sync()
  assert.equal(created, 1)
})
