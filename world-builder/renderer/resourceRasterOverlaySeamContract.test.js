import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyResourceOverlayVisibility,
  createDefaultResourceOverlayVisibility,
  createResourceOverlayDefinitions,
} from '../resourceOverlays.js'
import {
  getResourceRasterOverlayRgbaBuildCount,
  resetResourceRasterOverlayRgbaBuildCount,
} from './buildResourceRasterOverlayRgba.js'
import {
  RESOURCE_RASTER_OVERLAY_LAYER_IDS,
  RESOURCE_RASTER_OVERLAY_REGISTRY,
  resolveResourceRasterOverlaySpriteVisible,
} from './resourceRasterOverlayRefresh.js'

/**
 * Resource raster overlay seam: the viewport projects resource overlay refreshes through
 * a single registry keyed by overlay id. Per-layer rebuild locality and one-build-per-refresh
 * behavior are proven in createWorldBuilderMapViewport.overlaySync.test.js and
 * resourceRasterOverlayRefresh.test.js; these checks pin the registry-to-definition coverage
 * and that visibility is decided without rasterizing.
 *
 * @param {import('./resourceRasterOverlayRefresh.js').ResourceRasterOverlayLayerId} resourceId
 * @returns {import('../core/types.js').WorldDocument}
 */
function visibleRasterFixture(resourceId) {
  const raster = new Float32Array(16)
  raster[5] = 0.8
  return {
    gridWidth: 4,
    gridHeight: 4,
    [`${resourceId}Raster`]: raster,
  }
}

test('RESOURCE_RASTER_OVERLAY_REGISTRY covers every raster overlay definition', () => {
  const rasterDefinitionIds = createResourceOverlayDefinitions()
    .filter((definition) => definition.kind === 'raster' || definition.kind === 'rasterAndNodes')
    .map((definition) => definition.id)

  assert.deepStrictEqual(RESOURCE_RASTER_OVERLAY_LAYER_IDS, rasterDefinitionIds)
  assert.deepStrictEqual(
    Object.keys(RESOURCE_RASTER_OVERLAY_REGISTRY).sort(),
    [...rasterDefinitionIds].sort(),
  )
})

test('registry resolves each raster overlay visibility without rasterizing RGBA', () => {
  for (const resourceId of RESOURCE_RASTER_OVERLAY_LAYER_IDS) {
    resetResourceRasterOverlayRgbaBuildCount()
    const visibility = applyResourceOverlayVisibility(
      createDefaultResourceOverlayVisibility(),
      resourceId,
      true,
    )
    const worldDocument = visibleRasterFixture(resourceId)

    assert.strictEqual(
      resolveResourceRasterOverlaySpriteVisible(resourceId, {
        visibility,
        worldDocument,
        arableMinimumProductivity: 0,
      }),
      true,
      resourceId,
    )
    assert.strictEqual(
      resolveResourceRasterOverlaySpriteVisible(resourceId, {
        visibility: createDefaultResourceOverlayVisibility(),
        worldDocument,
        arableMinimumProductivity: 0,
      }),
      false,
      resourceId,
    )
    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 0, resourceId)
  }
})
