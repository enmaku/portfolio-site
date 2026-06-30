import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY } from '../resourceOverlays.js'
import {
  arableSpriteLayer,
  createArableRasterFixture,
  createHostEl,
  createMetalsFixture,
  createOverlayOwnerDriver,
  createSaltNodeFixture,
  createTimberRasterFixture,
  installViewportMocks,
  metalsSpriteLayer,
  timberSpriteLayer,
  uninstallViewportGlobals,
  viewportSpyState,
  viewportTestOptions,
} from './createWorldBuilderMapViewportTestHarness.js'

/** @type {typeof import('./createWorldBuilderMapViewport.js').createWorldBuilderMapViewport} */
let createWorldBuilderMapViewport

const HIDDEN_VISIBILITY = { arable: false, timber: false, metals: false, salt: false }

before(async () => {
  if (!viewportTestOptions.skip) {
    createWorldBuilderMapViewport = await installViewportMocks()
  }
})

after(() => {
  uninstallViewportGlobals()
})

test(
  'overlay owner seam hides salt markers by default and shows them when enabled',
  viewportTestOptions,
  async () => {
    const { resolveSaltNodeOverlayDrawn } = await import('./worldBuilderMapViewportModel.js')
    const { SALT_NODE_OVERLAY_COLOR } = await import('./createWorldBuilderMapViewport.js')
    const fixture = createSaltNodeFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)

    assert.strictEqual(
      viewportSpyState.drawnCircles.some((circle) => circle.color === SALT_NODE_OVERLAY_COLOR),
      resolveSaltNodeOverlayDrawn(HIDDEN_VISIBILITY, fixture),
    )

    overlay.setVisibility('salt', true)
    assert.strictEqual(
      viewportSpyState.drawnCircles.some((circle) => circle.color === SALT_NODE_OVERLAY_COLOR),
      resolveSaltNodeOverlayDrawn({ ...HIDDEN_VISIBILITY, salt: true }, fixture),
    )

    overlay.setVisibility('salt', false)
    assert.strictEqual(
      viewportSpyState.drawnCircles.some((circle) => circle.color === SALT_NODE_OVERLAY_COLOR),
      resolveSaltNodeOverlayDrawn(HIDDEN_VISIBILITY, fixture),
    )

    viewport.destroy()
  },
)

test(
  'overlay owner seam hides arable raster by default and shows it when enabled',
  viewportTestOptions,
  async () => {
    const { resolveArableRasterLayerVisible } = await import('./worldBuilderMapViewportModel.js')
    const fixture = createArableRasterFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)

    assert.strictEqual(
      arableSpriteLayer().visible,
      resolveArableRasterLayerVisible(
        HIDDEN_VISIBILITY,
        fixture,
        DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
      ),
    )

    overlay.setVisibility('arable', true)
    assert.strictEqual(
      arableSpriteLayer().visible,
      resolveArableRasterLayerVisible(
        { ...HIDDEN_VISIBILITY, arable: true },
        fixture,
        DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
      ),
    )

    overlay.setVisibility('arable', false)
    assert.strictEqual(
      arableSpriteLayer().visible,
      resolveArableRasterLayerVisible(
        HIDDEN_VISIBILITY,
        fixture,
        DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
      ),
    )

    viewport.destroy()
  },
)

test(
  'overlay owner seam redraws arable overlay when the envelope threshold changes',
  viewportTestOptions,
  async () => {
    const { resolveArableRasterLayerVisible } = await import('./worldBuilderMapViewportModel.js')
    const fixture = createArableRasterFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)
    const visibleVisibility = { ...HIDDEN_VISIBILITY, arable: true }

    overlay.setVisibility('arable', true)
    assert.strictEqual(
      arableSpriteLayer().visible,
      resolveArableRasterLayerVisible(
        visibleVisibility,
        fixture,
        DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
      ),
    )

    overlay.setArableMinimumProductivity(0.9)
    assert.strictEqual(
      arableSpriteLayer().visible,
      resolveArableRasterLayerVisible(visibleVisibility, fixture, 0.9),
    )

    overlay.setArableMinimumProductivity(0)
    assert.strictEqual(
      arableSpriteLayer().visible,
      resolveArableRasterLayerVisible(visibleVisibility, fixture, 0),
    )

    viewport.destroy()
  },
)

test(
  'overlay owner seam hides timber raster by default and shows it when enabled',
  viewportTestOptions,
  async () => {
    const { resolveResourceRasterLayerVisible } = await import('./worldBuilderMapViewportModel.js')
    const fixture = createTimberRasterFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)

    assert.strictEqual(
      timberSpriteLayer().visible,
      resolveResourceRasterLayerVisible(HIDDEN_VISIBILITY, 'timber', fixture),
    )

    overlay.setVisibility('timber', true)
    assert.strictEqual(
      timberSpriteLayer().visible,
      resolveResourceRasterLayerVisible({ ...HIDDEN_VISIBILITY, timber: true }, 'timber', fixture),
    )

    overlay.setVisibility('timber', false)
    assert.strictEqual(
      timberSpriteLayer().visible,
      resolveResourceRasterLayerVisible(HIDDEN_VISIBILITY, 'timber', fixture),
    )

    viewport.destroy()
  },
)

test(
  'overlay owner seam can show arable and timber overlays together independently',
  viewportTestOptions,
  async () => {
    const fixture = {
      ...createArableRasterFixture(),
      timberRaster: createTimberRasterFixture().timberRaster,
    }
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)

    overlay.setVisibility('arable', true)
    overlay.setVisibility('timber', true)

    assert.strictEqual(arableSpriteLayer().visible, true)
    assert.strictEqual(timberSpriteLayer().visible, true)

    overlay.setVisibility('arable', false)
    assert.strictEqual(arableSpriteLayer().visible, false)
    assert.strictEqual(timberSpriteLayer().visible, true)

    overlay.setVisibility('timber', false)
    assert.strictEqual(arableSpriteLayer().visible, false)
    assert.strictEqual(timberSpriteLayer().visible, false)

    viewport.destroy()
  },
)

test(
  'overlay owner seam can show salt and timber overlays together',
  viewportTestOptions,
  async () => {
    const fixture = {
      ...createSaltNodeFixture(),
      timberRaster: createTimberRasterFixture().timberRaster,
    }
    const { SALT_NODE_OVERLAY_COLOR } = await import('./createWorldBuilderMapViewport.js')
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)

    overlay.setVisibility('salt', true)
    overlay.setVisibility('timber', true)

    assert.strictEqual(
      viewportSpyState.drawnCircles.some((circle) => circle.color === SALT_NODE_OVERLAY_COLOR),
      true,
    )
    assert.strictEqual(timberSpriteLayer().visible, true)

    viewport.destroy()
  },
)

test(
  'overlay owner seam toggles metals hatch raster and mine markers together',
  viewportTestOptions,
  async () => {
    const { resolveMetalsOverlayDrawn } = await import('./worldBuilderMapViewportModel.js')
    const { METAL_NODE_OVERLAY_COLOR } = await import('./createWorldBuilderMapViewport.js')
    const fixture = createMetalsFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)

    assert.strictEqual(
      metalsSpriteLayer().visible,
      resolveMetalsOverlayDrawn(HIDDEN_VISIBILITY, fixture).rasterVisible,
    )
    assert.strictEqual(
      viewportSpyState.drawnCircles.some((circle) => circle.color === METAL_NODE_OVERLAY_COLOR),
      resolveMetalsOverlayDrawn(HIDDEN_VISIBILITY, fixture).nodesVisible,
    )

    overlay.setVisibility('metals', true)
    const visibleDrawn = resolveMetalsOverlayDrawn({ ...HIDDEN_VISIBILITY, metals: true }, fixture)
    assert.strictEqual(metalsSpriteLayer().visible, visibleDrawn.rasterVisible)
    assert.strictEqual(
      viewportSpyState.drawnCircles.some((circle) => circle.color === METAL_NODE_OVERLAY_COLOR),
      visibleDrawn.nodesVisible,
    )

    overlay.setVisibility('metals', false)
    assert.strictEqual(
      metalsSpriteLayer().visible,
      resolveMetalsOverlayDrawn(HIDDEN_VISIBILITY, fixture).rasterVisible,
    )
    assert.strictEqual(
      viewportSpyState.drawnCircles.some((circle) => circle.color === METAL_NODE_OVERLAY_COLOR),
      resolveMetalsOverlayDrawn(HIDDEN_VISIBILITY, fixture).nodesVisible,
    )

    viewport.destroy()
  },
)
