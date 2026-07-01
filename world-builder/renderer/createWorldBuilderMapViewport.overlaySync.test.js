import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  arableSpriteLayer,
  createArableRasterFixture,
  createCoastalNodesFixture,
  createHostEl,
  createMetalsFixture,
  createOverlayOwnerDriver,
  createSaltNodeFixture,
  createTimberRasterFixture,
  drawnCirclesByLayer,
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
  'syncOverlayRenderCache toggling salt nodes only leaves enabled resource rasters unrebuilt',
  viewportTestOptions,
  async () => {
    const { getResourceRasterOverlayRgbaBuildCount, resetResourceRasterOverlayRgbaBuildCount } =
      await importBuildCounters()
    const { SALT_NODE_OVERLAY_COLOR } = await import('./createWorldBuilderMapViewport.js')

    const fixture = {
      ...multiRasterFixture(),
      metalNodes: createMetalsFixture().metalNodes,
      saltNodes: [{ x: 1, y: 2 }],
    }
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const allRastersOn = { arable: true, timber: true, metals: true }

    viewport.syncOverlayRenderCache(overlayPageState(allRastersOn))

    resetResourceRasterOverlayRgbaBuildCount()
    viewport.syncOverlayRenderCache(overlayPageState({ ...allRastersOn, salt: true }))

    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 0)
    assert.strictEqual(arableSpriteLayer().visible, true)
    assert.strictEqual(timberSpriteLayer().visible, true)
    assert.strictEqual(metalsSpriteLayer().visible, true)
    assert.strictEqual(
      viewportSpyState.drawnCircles.some((circle) => circle.color === SALT_NODE_OVERLAY_COLOR),
      true,
    )

    viewport.destroy()
  },
)

test(
  'syncOverlayRenderCache toggling salt only leaves coastal node draw count unchanged',
  viewportTestOptions,
  async () => {
    const COASTAL_MOUTH_COLOR = 0x4fc3f7

    const fixture = {
      ...multiRasterFixture(),
      coastalNodes: createCoastalNodesFixture().coastalNodes,
      saltNodes: createSaltNodeFixture().saltNodes,
    }
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const allRastersOn = { arable: true, timber: true, metals: true }

    viewport.syncOverlayRenderCache(overlayPageState(allRastersOn))

    const coastalBefore = drawnCirclesByLayer().coastalNodes
    assert.strictEqual(coastalBefore.length, 1)
    assert.strictEqual(coastalBefore[0].color, COASTAL_MOUTH_COLOR)

    viewport.syncOverlayRenderCache(overlayPageState({ ...allRastersOn, salt: true }))

    const after = drawnCirclesByLayer()
    assert.strictEqual(after.coastalNodes.length, coastalBefore.length)
    assert.deepStrictEqual(after.coastalNodes, coastalBefore)
    assert.strictEqual(after.saltNodes.length, 1)

    viewport.destroy()
  },
)

test(
  'syncOverlayRenderCache toggling metals nodes only leaves salt and coastal unchanged',
  viewportTestOptions,
  async () => {
    const { SALT_NODE_OVERLAY_COLOR } = await import('./createWorldBuilderMapViewport.js')
    const COASTAL_MOUTH_COLOR = 0x4fc3f7

    const fixture = {
      ...multiRasterFixture(),
      coastalNodes: createCoastalNodesFixture().coastalNodes,
      saltNodes: createSaltNodeFixture().saltNodes,
      metalNodes: createMetalsFixture().metalNodes,
    }
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)

    viewport.syncOverlayRenderCache(
      overlayPageState({ arable: true, timber: true, metals: false, salt: true }),
    )

    const before = drawnCirclesByLayer()
    assert.strictEqual(before.coastalNodes.length, 1)
    assert.strictEqual(before.saltNodes.length, 1)
    assert.strictEqual(before.metalNodes.length, 0)

    viewport.syncOverlayRenderCache(
      overlayPageState({ arable: true, timber: true, metals: true, salt: true }),
    )

    const after = drawnCirclesByLayer()
    assert.deepStrictEqual(after.coastalNodes, before.coastalNodes)
    assert.deepStrictEqual(after.saltNodes, before.saltNodes)
    assert.strictEqual(after.metalNodes.length, 1)
    assert.strictEqual(after.coastalNodes[0].color, COASTAL_MOUTH_COLOR)
    assert.strictEqual(after.saltNodes[0].color, SALT_NODE_OVERLAY_COLOR)

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
