import assert from 'node:assert/strict'
import test from 'node:test'
import { createFullscreenController } from './fullscreenController.js'

function createApi(target) {
  let fullscreenElement = null
  return {
    target,
    get fullscreenElement() {
      return fullscreenElement
    },
    async requestFullscreen(el) {
      fullscreenElement = el
    },
    async exitFullscreen() {
      fullscreenElement = null
    },
  }
}

test('setEnabled(true) requests fullscreen on target element', async () => {
  const target = {}
  const api = createApi(target)
  let persisted = false
  const controller = createFullscreenController({
    getTargetElement: () => target,
    readEnabled: () => persisted,
    writeEnabled: (next) => {
      persisted = next
    },
    fullscreenApi: api,
  })

  await controller.setEnabled(true)

  assert.equal(api.fullscreenElement, target)
  assert.equal(persisted, true)
})

test('request failure resets persisted preference and calls failure hook', async () => {
  const target = {}
  let persisted = false
  let failureCalls = 0
  const controller = createFullscreenController({
    getTargetElement: () => target,
    readEnabled: () => persisted,
    writeEnabled: (next) => {
      persisted = next
    },
    onRequestFailure: () => {
      failureCalls += 1
    },
    fullscreenApi: {
      get fullscreenElement() {
        return null
      },
      async requestFullscreen() {
        throw new Error('blocked')
      },
      async exitFullscreen() {},
    },
  })

  await controller.setEnabled(true)

  assert.equal(persisted, false)
  assert.equal(failureCalls, 1)
})

test('cleanup exits fullscreen when target is active fullscreen element', async () => {
  const target = {}
  const api = createApi(target)
  let persisted = false
  const controller = createFullscreenController({
    getTargetElement: () => target,
    readEnabled: () => persisted,
    writeEnabled: (next) => {
      persisted = next
    },
    fullscreenApi: api,
  })

  await controller.setEnabled(true)
  assert.equal(api.fullscreenElement, target)

  await controller.cleanup()
  assert.equal(api.fullscreenElement, null)
})

test('cleanup does not exit fullscreen for unrelated element', async () => {
  const target = {}
  const other = {}
  let fullscreenElement = other
  let exitCalls = 0
  const controller = createFullscreenController({
    getTargetElement: () => target,
    readEnabled: () => false,
    writeEnabled: () => {},
    fullscreenApi: {
      get fullscreenElement() {
        return fullscreenElement
      },
      async requestFullscreen() {},
      async exitFullscreen() {
        exitCalls += 1
        fullscreenElement = null
      },
    },
  })

  await controller.cleanup()

  assert.equal(exitCalls, 0)
  assert.equal(fullscreenElement, other)
})

test('setEnabled(false) exits fullscreen when target is active', async () => {
  const target = {}
  const api = createApi(target)
  let persisted = false
  const controller = createFullscreenController({
    getTargetElement: () => target,
    readEnabled: () => persisted,
    writeEnabled: (next) => {
      persisted = next
    },
    fullscreenApi: api,
  })

  await controller.setEnabled(true)
  assert.equal(api.fullscreenElement, target)

  await controller.setEnabled(false)
  assert.equal(api.fullscreenElement, null)
  assert.equal(persisted, false)
})

