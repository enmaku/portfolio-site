import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  createHostEl,
  createSaltNodeFixture,
  installViewportMocks,
  uninstallViewportGlobals,
  viewportSpyState,
  viewportTestOptions,
  worldDocFixture,
} from './createWorldBuilderMapViewportTestHarness.js'

/** @type {typeof import('./createWorldBuilderMapViewport.js').createWorldBuilderMapViewport} */
let createWorldBuilderMapViewport

before(async () => {
  if (!viewportTestOptions.skip) {
    createWorldBuilderMapViewport = await installViewportMocks()
  }
})

after(() => {
  uninstallViewportGlobals()
})

test(
  'focusOn uses current world document width after regeneration',
  viewportTestOptions,
  async () => {
    const viewport = await createWorldBuilderMapViewport(createHostEl(), createSaltNodeFixture())
    viewport.updateWorldDocument(
      worldDocFixture({
        gridWidth: 80,
        gridHeight: 80,
        saltNodes: [{ x: 1, y: 2 }],
      }),
    )

    viewport.focusOn({ minX: 0, minY: 0, maxX: 20, maxY: 20 })
    const animation = viewportSpyState.viewportAnimations.at(-1)
    assert.ok(animation)
    assert.strictEqual(animation.scale, 1)

    viewport.destroy()
  },
)

test('initial mount fits viewport to world bounds once', viewportTestOptions, async () => {
  viewportSpyState.fitWorldCallCount = 0
  viewportSpyState.moveCenterCallCount = 0
  const viewport = await createWorldBuilderMapViewport(createHostEl(), createSaltNodeFixture())

  assert.strictEqual(viewportSpyState.fitWorldCallCount, 1)
  assert.strictEqual(viewportSpyState.moveCenterCallCount, 1)

  viewport.destroy()
})

test(
  'ResizeObserver syncs host dimensions without refitting after initial mount',
  viewportTestOptions,
  async () => {
    const hostEl = createHostEl()
    const viewport = await createWorldBuilderMapViewport(hostEl, createSaltNodeFixture())
    assert.ok(viewportSpyState.lastViewportInstance)
    viewportSpyState.lastViewportInstance.scale = { x: 3, y: 3 }
    viewportSpyState.lastViewportInstance.center = { x: 50, y: 75 }
    const userScale = { ...viewportSpyState.lastViewportInstance.scale }
    const userCenter = { ...viewportSpyState.lastViewportInstance.center }
    viewportSpyState.fitWorldCallCount = 0
    viewportSpyState.moveCenterCallCount = 0

    hostEl.clientWidth = 640
    hostEl.clientHeight = 480
    viewportSpyState.resizeObserverCallback?.()

    assert.deepStrictEqual(viewportSpyState.lastViewportResize, {
      screenWidth: 640,
      screenHeight: 480,
      worldWidth: 4,
      worldHeight: 4,
    })
    assert.strictEqual(viewportSpyState.fitWorldCallCount, 0)
    assert.strictEqual(viewportSpyState.moveCenterCallCount, 0)
    assert.deepStrictEqual(viewportSpyState.lastViewportInstance.scale, userScale)
    assert.deepStrictEqual(viewportSpyState.lastViewportInstance.center, userCenter)

    viewport.destroy()
  },
)

test(
  'fitToWorld explicitly refits viewport to current world document',
  viewportTestOptions,
  async () => {
    const viewport = await createWorldBuilderMapViewport(createHostEl(), createSaltNodeFixture())
    viewportSpyState.fitWorldCallCount = 0
    viewportSpyState.moveCenterCallCount = 0

    viewport.updateWorldDocument(
      worldDocFixture({
        gridWidth: 80,
        gridHeight: 60,
        saltNodes: [{ x: 1, y: 2 }],
      }),
    )
    viewport.fitToWorld()

    assert.strictEqual(viewportSpyState.fitWorldCallCount, 1)
    assert.strictEqual(viewportSpyState.moveCenterCallCount, 1)

    viewport.destroy()
  },
)
