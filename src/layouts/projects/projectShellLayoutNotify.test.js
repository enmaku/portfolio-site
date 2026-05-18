import assert from 'node:assert/strict'
import test from 'node:test'
import { PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID } from './projectShellFrame.js'
import {
  PROJECT_SHELL_FRAME_NOTIFY_DEFAULTS,
  PROJECT_SHELL_NOTIFY_ROOT_ELEMENT_ID,
  PROJECT_SHELL_RESTORE_NOTIFY_DEFAULTS,
  resetProjectShellNotifyFrameStateForTests,
} from './projectShellNotifyFrame.js'
import {
  resolveProjectShellNotifyFrameTargets,
  syncProjectShellLayoutNotifyFrame,
  teardownProjectShellLayoutNotifyFrame,
} from './projectShellLayoutNotify.js'

test.afterEach(() => {
  resetProjectShellNotifyFrameStateForTests()
})

/**
 * @param {Record<string, Element | null>} [elements]
 */
function createDocumentFixture(elements = {}) {
  const body = { appendChild(el) { el.parentElement = body } }
  return {
    body,
    getElementById: (id) => elements[id] ?? null,
  }
}

test('resolveProjectShellNotifyFrameTargets resolves notify root and frame portal when active', () => {
  const portal = { id: PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID }
  const notifyRoot = { id: PROJECT_SHELL_NOTIFY_ROOT_ELEMENT_ID }
  const doc = createDocumentFixture({
    [PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID]: portal,
    [PROJECT_SHELL_NOTIFY_ROOT_ELEMENT_ID]: notifyRoot,
  })

  assert.deepEqual(resolveProjectShellNotifyFrameTargets(true, doc), {
    notifyRoot,
    framePortal: portal,
  })
})

test('resolveProjectShellNotifyFrameTargets omits portal when framing is inactive', () => {
  const portal = { id: PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID }
  const notifyRoot = { id: PROJECT_SHELL_NOTIFY_ROOT_ELEMENT_ID }
  const doc = createDocumentFixture({
    [PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID]: portal,
    [PROJECT_SHELL_NOTIFY_ROOT_ELEMENT_ID]: notifyRoot,
  })

  assert.deepEqual(resolveProjectShellNotifyFrameTargets(false, doc), {
    notifyRoot,
    framePortal: null,
  })
})

test('syncProjectShellLayoutNotifyFrame applies top defaults and mounts into frame portal', () => {
  const portal = { appendChild(el) { el.parentElement = portal } }
  const notifyRoot = { parentElement: /** @type {unknown} */ (null) }
  const doc = createDocumentFixture({
    [PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID]: portal,
    [PROJECT_SHELL_NOTIFY_ROOT_ELEMENT_ID]: notifyRoot,
  })
  doc.body.appendChild(notifyRoot)

  const applied = []
  const notifyApi = {
    setDefaults: (opts) => {
      applied.push(opts)
    },
  }

  assert.equal(
    syncProjectShellLayoutNotifyFrame({ notifyApi, frameActive: true, doc }),
    true,
  )
  assert.deepEqual(applied.at(-1), PROJECT_SHELL_FRAME_NOTIFY_DEFAULTS)
  assert.equal(notifyRoot.parentElement, portal)
})

test('syncProjectShellLayoutNotifyFrame restores defaults and body mount when inactive', () => {
  const portal = { appendChild(el) { el.parentElement = portal } }
  const notifyRoot = { parentElement: /** @type {unknown} */ (null) }
  const doc = createDocumentFixture({
    [PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID]: portal,
    [PROJECT_SHELL_NOTIFY_ROOT_ELEMENT_ID]: notifyRoot,
  })
  doc.body.appendChild(notifyRoot)

  const notifyApi = { setDefaults: () => {} }

  syncProjectShellLayoutNotifyFrame({ notifyApi, frameActive: true, doc })
  portal.appendChild(notifyRoot)

  const applied = []
  notifyApi.setDefaults = (opts) => {
    applied.push(opts)
  }

  assert.equal(
    syncProjectShellLayoutNotifyFrame({ notifyApi, frameActive: false, doc }),
    true,
  )
  assert.deepEqual(applied.at(-1), PROJECT_SHELL_RESTORE_NOTIFY_DEFAULTS)
  assert.equal(notifyRoot.parentElement, doc.body)
})

test('syncProjectShellLayoutNotifyFrame reports retry when portal is not mounted yet', () => {
  const notifyRoot = { parentElement: /** @type {unknown} */ (null) }
  const doc = createDocumentFixture({
    [PROJECT_SHELL_NOTIFY_ROOT_ELEMENT_ID]: notifyRoot,
  })
  doc.body.appendChild(notifyRoot)

  const notifyApi = { setDefaults: () => {} }

  assert.equal(
    syncProjectShellLayoutNotifyFrame({ notifyApi, frameActive: true, doc }),
    false,
  )
})

test('teardownProjectShellLayoutNotifyFrame clears shell notify overrides', () => {
  const portal = { appendChild(el) { el.parentElement = portal } }
  const notifyRoot = { parentElement: /** @type {unknown} */ (null) }
  const doc = createDocumentFixture({
    [PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID]: portal,
    [PROJECT_SHELL_NOTIFY_ROOT_ELEMENT_ID]: notifyRoot,
  })
  doc.body.appendChild(notifyRoot)

  const applied = []
  const notifyApi = {
    setDefaults: (opts) => {
      applied.push(opts)
    },
  }

  syncProjectShellLayoutNotifyFrame({ notifyApi, frameActive: true, doc })
  portal.appendChild(notifyRoot)

  teardownProjectShellLayoutNotifyFrame({ notifyApi, doc })

  assert.deepEqual(applied.at(-1), PROJECT_SHELL_RESTORE_NOTIFY_DEFAULTS)
  assert.equal(notifyRoot.parentElement, doc.body)
})
