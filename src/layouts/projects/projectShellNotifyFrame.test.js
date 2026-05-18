import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PROJECT_SHELL_FRAME_NOTIFY_DEFAULTS,
  PROJECT_SHELL_NOTIFY_ROOT_ELEMENT_ID,
  PROJECT_SHELL_RESTORE_NOTIFY_DEFAULTS,
  applyProjectShellNotifyFrame,
  resetProjectShellNotifyFrameStateForTests,
  resolveProjectShellNotifyDefaults,
  restoreProjectShellNotifyFrame,
  syncProjectShellNotifyContainer,
} from './projectShellNotifyFrame.js'

test.afterEach(() => {
  resetProjectShellNotifyFrameStateForTests()
})

/**
 * @returns {{ body: { appendChild: (el: { parentElement: unknown }) => void }, portal: { appendChild: (el: { parentElement: unknown }) => void }, notifyRoot: { parentElement: unknown } }}
 */
function createNotifyMountFixture() {
  const body = { appendChild(el) { el.parentElement = body } }
  const portal = { appendChild(el) { el.parentElement = portal } }
  const notifyRoot = { parentElement: /** @type {unknown} */ (null) }
  body.appendChild(notifyRoot)
  return { body, portal, notifyRoot }
}

test('notify root element id matches Quasar Notify mount', () => {
  assert.equal(PROJECT_SHELL_NOTIFY_ROOT_ELEMENT_ID, 'q-notify')
})

test('framed notify defaults pin to top', () => {
  assert.deepEqual(resolveProjectShellNotifyDefaults(true), PROJECT_SHELL_FRAME_NOTIFY_DEFAULTS)
  assert.equal(PROJECT_SHELL_FRAME_NOTIFY_DEFAULTS.position, 'top')
})

test('restored notify defaults return to Quasar baseline position', () => {
  assert.deepEqual(resolveProjectShellNotifyDefaults(false), PROJECT_SHELL_RESTORE_NOTIFY_DEFAULTS)
  assert.equal(PROJECT_SHELL_RESTORE_NOTIFY_DEFAULTS.position, 'bottom')
})

test('syncProjectShellNotifyContainer appends notify root to frame portal when active', () => {
  const { body, portal, notifyRoot } = createNotifyMountFixture()

  syncProjectShellNotifyContainer({
    notifyRoot,
    framePortal: portal,
    frameActive: true,
    documentBody: body,
  })

  assert.equal(notifyRoot.parentElement, portal)
})

test('syncProjectShellNotifyContainer returns notify root to body when inactive', () => {
  const { body, portal, notifyRoot } = createNotifyMountFixture()
  portal.appendChild(notifyRoot)

  syncProjectShellNotifyContainer({
    notifyRoot,
    framePortal: portal,
    frameActive: false,
    documentBody: body,
  })

  assert.equal(notifyRoot.parentElement, body)
})

test('applyProjectShellNotifyFrame sets framed defaults and mounts into portal', () => {
  const { body, portal, notifyRoot } = createNotifyMountFixture()

  const applied = []
  const notifyApi = {
    setDefaults: (opts) => {
      applied.push(opts)
    },
  }

  applyProjectShellNotifyFrame({
    notifyApi,
    frameActive: true,
    notifyRoot,
    framePortal: portal,
    documentBody: body,
  })

  assert.deepEqual(applied.at(-1), PROJECT_SHELL_FRAME_NOTIFY_DEFAULTS)
  assert.equal(notifyRoot.parentElement, portal)
})

test('applyProjectShellNotifyFrame restores defaults when framing drops', () => {
  const { body, portal, notifyRoot } = createNotifyMountFixture()

  const notifyApi = { setDefaults: () => {} }

  applyProjectShellNotifyFrame({
    notifyApi,
    frameActive: true,
    notifyRoot,
    framePortal: portal,
    documentBody: body,
  })

  const applied = []
  notifyApi.setDefaults = (opts) => {
    applied.push(opts)
  }

  applyProjectShellNotifyFrame({
    notifyApi,
    frameActive: false,
    notifyRoot,
    framePortal: portal,
    documentBody: body,
  })

  assert.deepEqual(applied.at(-1), PROJECT_SHELL_RESTORE_NOTIFY_DEFAULTS)
  assert.equal(notifyRoot.parentElement, body)
})

test('restoreProjectShellNotifyFrame clears shell notify overrides on teardown', () => {
  const { body, portal, notifyRoot } = createNotifyMountFixture()
  portal.appendChild(notifyRoot)

  const applied = []
  const notifyApi = {
    setDefaults: (opts) => {
      applied.push(opts)
    },
  }

  applyProjectShellNotifyFrame({
    notifyApi,
    frameActive: true,
    notifyRoot,
    framePortal: portal,
    documentBody: body,
  })

  restoreProjectShellNotifyFrame({
    notifyApi,
    notifyRoot,
    documentBody: body,
  })

  assert.deepEqual(applied.at(-1), PROJECT_SHELL_RESTORE_NOTIFY_DEFAULTS)
  assert.equal(notifyRoot.parentElement, body)
})
