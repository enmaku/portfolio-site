import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  arableSpriteLayer,
  createArableRasterFixture,
  createHostEl,
  createMetalsFixture,
  createOverlayOwnerDriver,
  createSaltNodeFixture,
  createTimberRasterFixture,
  installViewportMocks,
  timberSpriteLayer,
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

/**
 * @returns {Promise<{
 *   getResourceRasterOverlayRgbaBuildCount: () => number,
 *   resetResourceRasterOverlayRgbaBuildCount: () => void,
 * }>}
 */
async function importBuildCounters() {
  return import('./buildResourceRasterOverlayRgba.js')
}

function multiRasterFixture() {
  return {
    ...createArableRasterFixture(),
    timberRaster: createTimberRasterFixture().timberRaster,
    metalsRaster: createMetalsFixture().metalsRaster,
  }
}

test(
  'updateWorldDocument preserves overlay render cache set by syncOverlayRenderCache',
  viewportTestOptions,
  async () => {
    const { createResourceOverlayPageState, toggleResourceOverlayVisibility } = await import(
      '../resourceOverlayState.js'
    )
    const fixture = createTimberRasterFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const ownerState = toggleResourceOverlayVisibility(
      createResourceOverlayPageState(),
      'timber',
      true,
    )

    viewport.syncOverlayRenderCache(ownerState)
    viewport.updateWorldDocument({
      ...fixture,
      timberRaster: Float32Array.from(fixture.timberRaster),
    })

    assert.strictEqual(timberSpriteLayer().visible, true)
    viewport.destroy()
  },
)

test(
  'updateWorldDocument resizes viewport to the new world document dimensions',
  viewportTestOptions,
  async () => {
    const viewport = await createWorldBuilderMapViewport(createHostEl(), createSaltNodeFixture())
    viewport.updateWorldDocument(
      worldDocFixture({
        gridWidth: 64,
        gridHeight: 48,
        saltNodes: [{ x: 1, y: 2 }],
      }),
    )

    assert.deepStrictEqual(viewportSpyState.lastViewportResize, {
      screenWidth: 400,
      screenHeight: 300,
      worldWidth: 64,
      worldHeight: 48,
    })

    viewport.destroy()
  },
)

test(
  'updateWorldDocument rasterizes each visible resource layer at most once',
  viewportTestOptions,
  async () => {
    const { getResourceRasterOverlayRgbaBuildCount, resetResourceRasterOverlayRgbaBuildCount } =
      await importBuildCounters()

    const fixture = multiRasterFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)

    overlay.setVisibility('arable', true)
    overlay.setVisibility('timber', true)
    overlay.setVisibility('metals', true)

    resetResourceRasterOverlayRgbaBuildCount()
    viewport.updateWorldDocument({
      ...fixture,
      arableRaster: Float32Array.from(fixture.arableRaster),
      timberRaster: Float32Array.from(fixture.timberRaster),
      metalsRaster: Float32Array.from(fixture.metalsRaster),
    })
    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 3)

    viewport.destroy()
  },
)

test(
  'updateWorldDocument with changedLayers skips unchanged visible resource layers',
  viewportTestOptions,
  async () => {
    const { getResourceRasterOverlayRgbaBuildCount, resetResourceRasterOverlayRgbaBuildCount } =
      await importBuildCounters()

    const fixture = multiRasterFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)

    overlay.setVisibility('arable', true)
    overlay.setVisibility('timber', true)
    overlay.setVisibility('metals', true)

    resetResourceRasterOverlayRgbaBuildCount()
    viewport.updateWorldDocument(
      {
        ...fixture,
        timberRaster: Float32Array.from(fixture.timberRaster),
      },
      { changedLayers: ['timber'] },
    )
    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 1)

    viewport.destroy()
  },
)

test(
  'overlay owner seam toggles timber on displayed document without rebuilding arable',
  viewportTestOptions,
  async () => {
    const { getResourceRasterOverlayRgbaBuildCount, resetResourceRasterOverlayRgbaBuildCount } =
      await importBuildCounters()

    const fixture = {
      ...createArableRasterFixture(),
      timberRaster: createTimberRasterFixture().timberRaster,
    }
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)

    overlay.setVisibility('arable', true)
    resetResourceRasterOverlayRgbaBuildCount()
    overlay.setVisibility('timber', true)

    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 1)
    assert.strictEqual(arableSpriteLayer().visible, true)
    assert.strictEqual(timberSpriteLayer().visible, true)

    viewport.destroy()
  },
)

test(
  'updateWorldDocument syncs viewport dimensions without refitting to world',
  viewportTestOptions,
  async () => {
    const viewport = await createWorldBuilderMapViewport(createHostEl(), createSaltNodeFixture())
    viewportSpyState.fitWorldCallCount = 0
    viewportSpyState.moveCenterCallCount = 0

    viewport.updateWorldDocument(
      worldDocFixture({
        gridWidth: 64,
        gridHeight: 48,
        saltNodes: [{ x: 1, y: 2 }],
      }),
    )

    assert.deepStrictEqual(viewportSpyState.lastViewportResize, {
      screenWidth: 400,
      screenHeight: 300,
      worldWidth: 64,
      worldHeight: 48,
    })
    assert.strictEqual(viewportSpyState.fitWorldCallCount, 0)
    assert.strictEqual(viewportSpyState.moveCenterCallCount, 0)

    viewport.destroy()
  },
)
