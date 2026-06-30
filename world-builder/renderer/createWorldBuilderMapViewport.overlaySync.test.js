import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  arableSpriteLayer,
  createArableRasterFixture,
  createHostEl,
  createMetalsFixture,
  createOverlayOwnerDriver,
  createTimberRasterFixture,
  installViewportMocks,
  metalsSpriteLayer,
  overlayPageState,
  timberSpriteLayer,
  uninstallViewportGlobals,
  viewportSpyState,
  viewportTestOptions,
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
 * @returns {{
 *   getResourceRasterOverlayRgbaBuildCount: () => number,
 *   resetResourceRasterOverlayRgbaBuildCount: () => void,
 * }}
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
  'syncOverlayRenderCache projects owner overlay state in one refresh pass',
  viewportTestOptions,
  async () => {
    const { createResourceOverlayPageState, toggleResourceOverlayVisibility } = await import(
      '../resourceOverlayState.js'
    )
    const fixture = createTimberRasterFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const ownerState = toggleResourceOverlayVisibility(
      createResourceOverlayPageState({ arableMinimumProductivity: 0.42 }),
      'timber',
      true,
    )

    viewport.syncOverlayRenderCache(ownerState)

    assert.strictEqual(timberSpriteLayer().visible, true)
    viewport.destroy()
  },
)

test(
  'syncOverlayRenderCache hiding one overlay leaves other resource rasters unrebuilt',
  viewportTestOptions,
  async () => {
    const { getResourceRasterOverlayRgbaBuildCount, resetResourceRasterOverlayRgbaBuildCount } =
      await importBuildCounters()

    const viewport = await createWorldBuilderMapViewport(createHostEl(), multiRasterFixture())

    viewport.syncOverlayRenderCache(overlayPageState({ arable: true, timber: true, metals: true }))

    resetResourceRasterOverlayRgbaBuildCount()
    viewport.syncOverlayRenderCache(overlayPageState({ arable: true, timber: true, metals: false }))

    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 0)
    assert.strictEqual(arableSpriteLayer().visible, true)
    assert.strictEqual(timberSpriteLayer().visible, true)
    assert.strictEqual(metalsSpriteLayer().visible, false)

    viewport.destroy()
  },
)

test(
  'syncOverlayRenderCache re-committing identical overlay state rebuilds no resource rasters',
  viewportTestOptions,
  async () => {
    const { getResourceRasterOverlayRgbaBuildCount, resetResourceRasterOverlayRgbaBuildCount } =
      await importBuildCounters()

    const viewport = await createWorldBuilderMapViewport(createHostEl(), multiRasterFixture())

    viewport.syncOverlayRenderCache(
      overlayPageState({ arable: true, timber: true, metals: true }, 0.3),
    )

    resetResourceRasterOverlayRgbaBuildCount()
    const circlesBeforeNoOp = viewportSpyState.drawnCircles.length
    viewport.syncOverlayRenderCache(
      overlayPageState({ arable: true, timber: true, metals: true }, 0.3),
    )

    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 0)
    assert.strictEqual(viewportSpyState.drawnCircles.length, circlesBeforeNoOp)

    viewport.destroy()
  },
)

test(
  'syncOverlayRenderCache showing metals rebuilds only metals while other rasters stay visible',
  viewportTestOptions,
  async () => {
    const { getResourceRasterOverlayRgbaBuildCount, resetResourceRasterOverlayRgbaBuildCount } =
      await importBuildCounters()

    const fixture = { ...multiRasterFixture(), metalNodes: createMetalsFixture().metalNodes }
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)

    viewport.syncOverlayRenderCache(overlayPageState({ arable: true, timber: true }))

    resetResourceRasterOverlayRgbaBuildCount()
    viewport.syncOverlayRenderCache(overlayPageState({ arable: true, timber: true, metals: true }))

    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 1)
    assert.strictEqual(arableSpriteLayer().visible, true)
    assert.strictEqual(timberSpriteLayer().visible, true)
    assert.strictEqual(metalsSpriteLayer().visible, true)

    viewport.destroy()
  },
)

test(
  'syncOverlayRenderCache rebuilds only arable when the envelope threshold changes',
  viewportTestOptions,
  async () => {
    const { getResourceRasterOverlayRgbaBuildCount, resetResourceRasterOverlayRgbaBuildCount } =
      await importBuildCounters()

    const viewport = await createWorldBuilderMapViewport(createHostEl(), multiRasterFixture())

    viewport.syncOverlayRenderCache(
      overlayPageState({ arable: true, timber: true, metals: true }, 0.25),
    )

    resetResourceRasterOverlayRgbaBuildCount()
    viewport.syncOverlayRenderCache(
      overlayPageState({ arable: true, timber: true, metals: true }, 0.6),
    )

    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 1)
    assert.strictEqual(timberSpriteLayer().visible, true)
    assert.strictEqual(metalsSpriteLayer().visible, true)

    viewport.destroy()
  },
)

test(
  'syncOverlayRenderCache toggling salt nodes never rebuilds resource rasters',
  viewportTestOptions,
  async () => {
    const { getResourceRasterOverlayRgbaBuildCount, resetResourceRasterOverlayRgbaBuildCount } =
      await importBuildCounters()
    const { SALT_NODE_OVERLAY_COLOR } = await import('./createWorldBuilderMapViewport.js')

    const fixture = { ...multiRasterFixture(), saltNodes: [{ x: 1, y: 2 }] }
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)

    viewport.syncOverlayRenderCache(overlayPageState({ arable: true, timber: true, metals: true }))

    resetResourceRasterOverlayRgbaBuildCount()
    viewport.syncOverlayRenderCache(
      overlayPageState({ arable: true, timber: true, metals: true, salt: true }),
    )

    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 0)
    assert.strictEqual(
      viewportSpyState.drawnCircles.some((circle) => circle.color === SALT_NODE_OVERLAY_COLOR),
      true,
    )

    viewport.destroy()
  },
)

test(
  'viewport exposes only the single overlay owner seam, not per-overlay mutators',
  viewportTestOptions,
  async () => {
    const viewport = await createWorldBuilderMapViewport(createHostEl(), createTimberRasterFixture())

    assert.strictEqual(typeof viewport.syncOverlayRenderCache, 'function')
    assert.strictEqual('setResourceOverlayVisibility' in viewport, false)
    assert.strictEqual('setArableOverlayMinimumProductivity' in viewport, false)

    viewport.destroy()
  },
)

test(
  'viewport init skips resource rasterization while overlays are hidden',
  viewportTestOptions,
  async () => {
    const { getResourceRasterOverlayRgbaBuildCount, resetResourceRasterOverlayRgbaBuildCount } =
      await importBuildCounters()

    resetResourceRasterOverlayRgbaBuildCount()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), multiRasterFixture())

    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 0)
    viewport.destroy()
  },
)

test(
  'overlay owner seam rasterizes a resource layer at most once per toggle',
  viewportTestOptions,
  async () => {
    const { getResourceRasterOverlayRgbaBuildCount, resetResourceRasterOverlayRgbaBuildCount } =
      await importBuildCounters()

    const viewport = await createWorldBuilderMapViewport(createHostEl(), createTimberRasterFixture())
    const overlay = createOverlayOwnerDriver(viewport)

    resetResourceRasterOverlayRgbaBuildCount()
    overlay.setVisibility('timber', true)
    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 1)

    resetResourceRasterOverlayRgbaBuildCount()
    overlay.setVisibility('timber', false)
    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 0)

    viewport.destroy()
  },
)
