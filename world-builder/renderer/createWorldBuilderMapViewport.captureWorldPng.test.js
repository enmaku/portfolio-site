import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  createHostEl,
  installViewportMocks,
  uninstallViewportGlobals,
  viewportSpyState,
  viewportTestOptions,
  worldDocFixture,
} from './createWorldBuilderMapViewportTestHarness.js'

afterEach(() => {
  uninstallViewportGlobals()
})

test(
  'captureWorldPng exports a png blob and restores viewport framing',
  viewportTestOptions,
  async () => {
    const createWorldBuilderMapViewport = await installViewportMocks()
    const hostEl = createHostEl()
    const viewport = await createWorldBuilderMapViewport(
      hostEl,
      worldDocFixture({ gridWidth: 8, gridHeight: 6 }),
    )

    const scaleBefore = { ...viewportSpyState.lastViewportInstance.scale }
    const centerBefore = { ...viewportSpyState.lastViewportInstance.center }

    const blob = await viewport.captureWorldPng()
    assert.equal(blob.type, 'image/png')
    assert.ok(blob.size > 0)
    assert.deepEqual(viewportSpyState.lastViewportInstance.scale, scaleBefore)
    assert.deepEqual(viewportSpyState.lastViewportInstance.center, centerBefore)
    assert.ok(
      viewportSpyState.lastViewportResize?.screenWidth === 400 ||
        viewportSpyState.lastViewportResize?.screenWidth === 8,
    )

    viewport.destroy()
  },
)
