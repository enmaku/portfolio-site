import assert from 'node:assert/strict'
import { before, beforeEach, mock, test } from 'node:test'
import { PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID } from './projectShellFrame.js'

/** @type {typeof import('./projectShellOverlayPortal.js')} */
let overlayPortal

/** @type {unknown[]} */
let changeGlobalNodesTargetCalls = []

/**
 * @param {Record<string, unknown>} [elements]
 * @returns {Pick<Document, 'body' | 'getElementById'>}
 */
function createDocumentFixture(elements = {}) {
  const body = { nodeName: 'BODY' }
  return {
    body,
    getElementById: (id) => elements[id] ?? null,
  }
}

before(async () => {
  if (!mock.module) return

  mock.module('quasar/src/utils/private.config/nodes.js', {
    namedExports: {
      changeGlobalNodesTarget: (target) => {
        changeGlobalNodesTargetCalls.push(target)
      },
    },
  })

  overlayPortal = await import(
    `./projectShellOverlayPortal.js?test=${Date.now()}`,
  )
})

beforeEach(() => {
  changeGlobalNodesTargetCalls = []
})

const overlayPortalTests = { skip: !mock.module }

test('inactive overlay portal target is document body', overlayPortalTests, () => {
  const body = { nodeName: 'BODY' }
  const doc = createDocumentFixture()
  doc.body = body

  assert.equal(
    overlayPortal.resolveProjectShellOverlayPortalTarget(false, doc),
    body,
  )
})

test('active overlay portal target resolves frame portal mount', overlayPortalTests, () => {
  const portal = { id: PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID }
  const doc = createDocumentFixture({
    [PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID]: portal,
  })

  assert.equal(
    overlayPortal.resolveProjectShellOverlayPortalTarget(true, doc),
    portal,
  )
})

test(
  'active overlay portal target does not fall back to body when mount is missing',
  overlayPortalTests,
  () => {
  const body = { nodeName: 'BODY' }
  const doc = createDocumentFixture()
  doc.body = body

  assert.equal(
    overlayPortal.resolveProjectShellOverlayPortalTarget(true, doc),
    null,
  )
  },
)

test(
  'sync skips changeGlobalNodesTarget when frame is active but portal mount is absent',
  overlayPortalTests,
  () => {
  const body = { nodeName: 'BODY' }
  const doc = createDocumentFixture()
  doc.body = body

  overlayPortal.syncProjectShellOverlayPortalTarget(true, doc)

  assert.equal(changeGlobalNodesTargetCalls.length, 0)
  },
)

test(
  'sync reparents Quasar global nodes to frame portal when mount exists',
  overlayPortalTests,
  () => {
  const portal = { id: PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID }
  const doc = createDocumentFixture({
    [PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID]: portal,
  })

  overlayPortal.syncProjectShellOverlayPortalTarget(true, doc)

  assert.deepEqual(changeGlobalNodesTargetCalls, [portal])
  },
)

test('sync restores document body when desktop frame is inactive', overlayPortalTests, () => {
  const body = { nodeName: 'BODY' }
  const doc = createDocumentFixture()
  doc.body = body

  overlayPortal.syncProjectShellOverlayPortalTarget(false, doc)

  assert.deepEqual(changeGlobalNodesTargetCalls, [body])
})

test('resetProjectShellOverlayPortalTarget restores document body', overlayPortalTests, () => {
  const body = { nodeName: 'BODY' }
  const doc = createDocumentFixture()
  doc.body = body

  overlayPortal.resetProjectShellOverlayPortalTarget(doc)

  assert.deepEqual(changeGlobalNodesTargetCalls, [body])
})
