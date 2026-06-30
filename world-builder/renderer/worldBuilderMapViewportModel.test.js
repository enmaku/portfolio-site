import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getResourceRasterOverlayRgbaBuildCount,
  resetResourceRasterOverlayRgbaBuildCount,
} from './buildResourceRasterOverlayRgba.js'
import {
  computeRegionFocusScale,
  resolveArableRasterLayerVisible,
  resolveMetalsOverlayDrawn,
  resolveResourceRasterLayerVisible,
  resolveSaltNodeOverlayDrawn,
} from './worldBuilderMapViewportModel.js'
import { applyResourceOverlayVisibility, createDefaultResourceOverlayVisibility } from '../resourceOverlays.js'

test('computeRegionFocusScale uses the active world width after regeneration', () => {
  const region = { minX: 0, minY: 0, maxX: 20, maxY: 20 }

  assert.strictEqual(computeRegionFocusScale(4, region), 1)
  assert.strictEqual(computeRegionFocusScale(80, region), 1)
})

test('resolveResourceRasterLayerVisible hides timber raster by default', () => {
  const visibility = createDefaultResourceOverlayVisibility()
  const timberRaster = new Float32Array([0.8, 0, 0, 0])
  assert.strictEqual(
    resolveResourceRasterLayerVisible(visibility, 'timber', {
      gridWidth: 2,
      gridHeight: 2,
      timberRaster,
    }),
    false,
  )
})

test('resolveResourceRasterLayerVisible shows timber raster when overlay is enabled', () => {
  const visibility = applyResourceOverlayVisibility(
    createDefaultResourceOverlayVisibility(),
    'timber',
    true,
  )
  const timberRaster = new Float32Array([0.8, 0, 0, 0])
  assert.strictEqual(
    resolveResourceRasterLayerVisible(visibility, 'timber', {
      gridWidth: 2,
      gridHeight: 2,
      timberRaster,
    }),
    true,
  )
})

test('resolveArableRasterLayerVisible respects arable minimum productivity cutoff', () => {
  const visibility = applyResourceOverlayVisibility(
    createDefaultResourceOverlayVisibility(),
    'arable',
    true,
  )
  const arableRaster = new Float32Array(16)
  arableRaster[5] = 0.75
  const worldDocument = {
    gridWidth: 4,
    gridHeight: 4,
    arableRaster,
  }

  assert.strictEqual(resolveArableRasterLayerVisible(visibility, worldDocument, 0), true)
  assert.strictEqual(resolveArableRasterLayerVisible(visibility, worldDocument, 0.9), false)
})

test('resolveMetalsOverlayDrawn gates raster hatch and mine markers together', () => {
  const metalsRaster = new Float32Array([0.85])
  const metalNodes = [{ id: 'metal-0', x: 1, y: 2 }]
  const worldDocument = {
    gridWidth: 1,
    gridHeight: 1,
    metalsRaster,
    metalNodes,
  }
  const hidden = createDefaultResourceOverlayVisibility()
  const visible = applyResourceOverlayVisibility(hidden, 'metals', true)

  assert.deepStrictEqual(resolveMetalsOverlayDrawn(hidden, worldDocument), {
    rasterVisible: false,
    nodesVisible: false,
  })
  assert.deepStrictEqual(resolveMetalsOverlayDrawn(visible, worldDocument), {
    rasterVisible: true,
    nodesVisible: true,
  })
})

test('resolveResourceRasterLayerVisible does not call buildResourceRasterOverlayRgba', () => {
  resetResourceRasterOverlayRgbaBuildCount()
  const visibility = applyResourceOverlayVisibility(
    createDefaultResourceOverlayVisibility(),
    'timber',
    true,
  )
  const timberRaster = new Float32Array([0.8, 0, 0, 0])
  assert.strictEqual(
    resolveResourceRasterLayerVisible(visibility, 'timber', {
      gridWidth: 2,
      gridHeight: 2,
      timberRaster,
    }),
    true,
  )
  assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 0)
})

test('resolveArableRasterLayerVisible does not call buildResourceRasterOverlayRgba', () => {
  resetResourceRasterOverlayRgbaBuildCount()
  const visibility = applyResourceOverlayVisibility(
    createDefaultResourceOverlayVisibility(),
    'arable',
    true,
  )
  const arableRaster = new Float32Array(16)
  arableRaster[5] = 0.75
  const worldDocument = {
    gridWidth: 4,
    gridHeight: 4,
    arableRaster,
  }
  assert.strictEqual(resolveArableRasterLayerVisible(visibility, worldDocument, 0), true)
  assert.strictEqual(resolveArableRasterLayerVisible(visibility, worldDocument, 0.9), false)
  assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 0)
})

test('resolveSaltNodeOverlayDrawn hides salt markers until overlay is enabled', () => {
  const saltNodes = [{ x: 1, y: 2 }]
  const hidden = createDefaultResourceOverlayVisibility()
  const visible = applyResourceOverlayVisibility(hidden, 'salt', true)

  assert.strictEqual(resolveSaltNodeOverlayDrawn(hidden, { saltNodes }), false)
  assert.strictEqual(resolveSaltNodeOverlayDrawn(visible, { saltNodes }), true)
})
