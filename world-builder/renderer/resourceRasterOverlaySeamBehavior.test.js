import assert from 'node:assert/strict'
import test from 'node:test'
import { createResourceOverlayDefinitions } from '../resourceOverlays.js'
import {
  RESOURCE_RASTER_OVERLAY_LAYER_IDS,
  RESOURCE_RASTER_OVERLAY_REGISTRY,
  resolveResourceRasterOverlaySpriteVisible,
} from './resourceRasterOverlayRefresh.js'
import { resolveResourceRasterLayerVisible } from './worldBuilderMapViewportModel.js'
import {
  applyResourceOverlayVisibility,
  createDefaultResourceOverlayVisibility,
} from '../resourceOverlays.js'

test('RESOURCE_RASTER_OVERLAY_REGISTRY covers every raster overlay definition', () => {
  const rasterDefinitionIds = createResourceOverlayDefinitions()
    .filter((definition) => definition.kind === 'raster' || definition.kind === 'rasterAndNodes')
    .map((definition) => definition.id)

  assert.deepStrictEqual(RESOURCE_RASTER_OVERLAY_LAYER_IDS, rasterDefinitionIds)
  assert.deepStrictEqual(Object.keys(RESOURCE_RASTER_OVERLAY_REGISTRY).sort(), rasterDefinitionIds.sort())
})

test('registry resolves raster overlay visibility without building RGBA', () => {
  const timberRaster = new Float32Array([0.8, 0, 0, 0])
  const worldDocument = {
    gridWidth: 2,
    gridHeight: 2,
    timberRaster,
  }
  const visibility = applyResourceOverlayVisibility(
    createDefaultResourceOverlayVisibility(),
    'timber',
    true,
  )
  const context = {
    worldDocument,
    visibility,
    arableMinimumProductivity: 0.25,
  }

  assert.strictEqual(resolveResourceRasterOverlaySpriteVisible('timber', context), true)
  assert.strictEqual(
    resolveResourceRasterOverlaySpriteVisible('timber', {
      ...context,
      visibility: createDefaultResourceOverlayVisibility(),
    }),
    false,
  )
  assert.strictEqual(RESOURCE_RASTER_OVERLAY_REGISTRY.timber.id, 'timber')
})

test('viewport model resolves raster visibility from drawable pixels without building RGBA', () => {
  const timberRaster = new Float32Array([0.8, 0, 0, 0])
  const worldDocument = {
    gridWidth: 2,
    gridHeight: 2,
    timberRaster,
  }
  const visibility = applyResourceOverlayVisibility(
    createDefaultResourceOverlayVisibility(),
    'timber',
    true,
  )

  assert.strictEqual(resolveResourceRasterLayerVisible(visibility, 'timber', worldDocument), true)
  assert.strictEqual(
    resolveResourceRasterLayerVisible(createDefaultResourceOverlayVisibility(), 'timber', worldDocument),
    false,
  )
})
