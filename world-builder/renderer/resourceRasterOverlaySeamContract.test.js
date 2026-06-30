import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createResourceOverlayDefinitions } from '../resourceOverlays.js'
import {
  RESOURCE_RASTER_OVERLAY_LAYER_IDS,
  RESOURCE_RASTER_OVERLAY_REGISTRY,
} from './resourceRasterOverlayRefresh.js'

const rendererDir = fileURLToPath(new URL('.', import.meta.url))

const forbiddenViewportCanvasImports = [
  'buildArableOverlayCanvas',
  'buildTimberOverlayCanvas',
  'buildMetalsOverlayCanvas',
]

const forbiddenVisibilityRgbaImports = [
  'buildArableOverlayRgba',
  'buildTimberOverlayRgba',
  'buildMetalsOverlayRgba',
]

test('RESOURCE_RASTER_OVERLAY_REGISTRY covers every raster overlay definition', () => {
  const rasterDefinitionIds = createResourceOverlayDefinitions()
    .filter((definition) => definition.kind === 'raster' || definition.kind === 'rasterAndNodes')
    .map((definition) => definition.id)

  assert.deepStrictEqual(RESOURCE_RASTER_OVERLAY_LAYER_IDS, rasterDefinitionIds)
  assert.deepStrictEqual(Object.keys(RESOURCE_RASTER_OVERLAY_REGISTRY).sort(), rasterDefinitionIds.sort())
})

test('createWorldBuilderMapViewport routes raster refresh through registry module', () => {
  const source = readFileSync(join(rendererDir, 'createWorldBuilderMapViewport.js'), 'utf8')

  assert.ok(source.includes('resourceRasterOverlayRefresh.js'))
  assert.ok(source.includes('RESOURCE_RASTER_OVERLAY_LAYER_IDS'))
  assert.ok(source.includes('refreshResourceRasterOverlayCanvas'))
  assert.ok(source.includes('isResourceRasterOverlayLayerId'))

  for (const symbol of forbiddenViewportCanvasImports) {
    assert.ok(!source.includes(symbol), `viewport must not import ${symbol}`)
  }
})

test('worldBuilderMapViewportModel resolves raster visibility without building RGBA', () => {
  const source = readFileSync(join(rendererDir, 'worldBuilderMapViewportModel.js'), 'utf8')

  assert.ok(source.includes('hasDrawableResourceRasterOverlayPixels'))

  for (const symbol of forbiddenVisibilityRgbaImports) {
    assert.ok(!source.includes(symbol), `viewport model must not import ${symbol}`)
  }
})
