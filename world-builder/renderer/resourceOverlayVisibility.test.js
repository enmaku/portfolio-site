import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyResourceOverlayVisibility,
  createDefaultResourceOverlayVisibility,
  isResourceOverlayVisible,
  shouldDrawResourceNodeOverlay,
  shouldDrawResourceRasterOverlay,
} from './resourceOverlayVisibility.js'

test('createDefaultResourceOverlayVisibility defaults salt overlay off', () => {
  assert.deepStrictEqual(createDefaultResourceOverlayVisibility(['salt']), { salt: false })
})

test('applyResourceOverlayVisibility toggles a resource without mutating prior state', () => {
  const initial = createDefaultResourceOverlayVisibility(['salt'])
  const visible = applyResourceOverlayVisibility(initial, 'salt', true)
  assert.strictEqual(isResourceOverlayVisible(initial, 'salt'), false)
  assert.strictEqual(isResourceOverlayVisible(visible, 'salt'), true)
})

test('isResourceOverlayVisible treats unknown resources as hidden', () => {
  assert.strictEqual(isResourceOverlayVisible({}, 'salt'), false)
})

test('shouldDrawResourceNodeOverlay hides salt markers by default', () => {
  const visibility = createDefaultResourceOverlayVisibility(['salt'])
  assert.strictEqual(shouldDrawResourceNodeOverlay(visibility, 'salt', [{ x: 1, y: 2 }]), false)
})

test('shouldDrawResourceNodeOverlay draws salt markers when overlay is on', () => {
  const visibility = applyResourceOverlayVisibility(
    createDefaultResourceOverlayVisibility(['salt']),
    'salt',
    true,
  )
  assert.strictEqual(shouldDrawResourceNodeOverlay(visibility, 'salt', [{ x: 1, y: 2 }]), true)
})

test('shouldDrawResourceRasterOverlay hides timber raster by default', () => {
  const visibility = createDefaultResourceOverlayVisibility(['timber'])
  const raster = new Float32Array([0.5, 0, 0.2])
  assert.strictEqual(shouldDrawResourceRasterOverlay(visibility, 'timber', raster), false)
})

test('shouldDrawResourceRasterOverlay draws timber raster when overlay is on', () => {
  const visibility = applyResourceOverlayVisibility(
    createDefaultResourceOverlayVisibility(['timber']),
    'timber',
    true,
  )
  const raster = new Float32Array([0.5, 0, 0.2])
  assert.strictEqual(shouldDrawResourceRasterOverlay(visibility, 'timber', raster), true)
})

test('shouldDrawResourceRasterOverlay skips all-zero rasters', () => {
  const visibility = applyResourceOverlayVisibility(
    createDefaultResourceOverlayVisibility(['timber']),
    'timber',
    true,
  )
  assert.strictEqual(shouldDrawResourceRasterOverlay(visibility, 'timber', new Float32Array(4)), false)
})

test('shouldDrawResourceRasterOverlay hides arable raster by default', () => {
  const visibility = createDefaultResourceOverlayVisibility(['arable'])
  assert.strictEqual(
    shouldDrawResourceRasterOverlay(visibility, 'arable', new Float32Array([0.5])),
    false,
  )
})

test('shouldDrawResourceRasterOverlay draws arable raster when overlay is on', () => {
  const visibility = applyResourceOverlayVisibility(
    createDefaultResourceOverlayVisibility(['arable']),
    'arable',
    true,
  )
  assert.strictEqual(
    shouldDrawResourceRasterOverlay(visibility, 'arable', new Float32Array([0.5])),
    true,
  )
})

test('shouldDrawResourceRasterOverlay hides metals raster by default', () => {
  const visibility = createDefaultResourceOverlayVisibility(['metals'])
  assert.strictEqual(
    shouldDrawResourceRasterOverlay(visibility, 'metals', new Float32Array([0.6])),
    false,
  )
})

test('shouldDrawResourceRasterOverlay draws metals raster when overlay is on', () => {
  const visibility = applyResourceOverlayVisibility(
    createDefaultResourceOverlayVisibility(['metals']),
    'metals',
    true,
  )
  assert.strictEqual(
    shouldDrawResourceRasterOverlay(visibility, 'metals', new Float32Array([0.6])),
    true,
  )
})

test('shouldDrawResourceNodeOverlay hides metal mine markers by default', () => {
  const visibility = createDefaultResourceOverlayVisibility(['metals'])
  assert.strictEqual(
    shouldDrawResourceNodeOverlay(visibility, 'metals', [{ id: 'metal-0', x: 1, y: 2 }]),
    false,
  )
})

test('shouldDrawResourceNodeOverlay draws metal mine markers when overlay is on', () => {
  const visibility = applyResourceOverlayVisibility(
    createDefaultResourceOverlayVisibility(['metals']),
    'metals',
    true,
  )
  assert.strictEqual(
    shouldDrawResourceNodeOverlay(visibility, 'metals', [{ id: 'metal-0', x: 1, y: 2 }]),
    true,
  )
})

test('metals rasterAndNodes overlay uses one visibility flag for raster and nodes', () => {
  const metalsRaster = new Float32Array([0.5])
  const metalNodes = [{ id: 'metal-0', x: 3, y: 4 }]
  const hidden = createDefaultResourceOverlayVisibility(['metals'])
  const visible = applyResourceOverlayVisibility(hidden, 'metals', true)

  assert.strictEqual(shouldDrawResourceRasterOverlay(hidden, 'metals', metalsRaster), false)
  assert.strictEqual(shouldDrawResourceNodeOverlay(hidden, 'metals', metalNodes), false)

  assert.strictEqual(shouldDrawResourceRasterOverlay(visible, 'metals', metalsRaster), true)
  assert.strictEqual(shouldDrawResourceNodeOverlay(visible, 'metals', metalNodes), true)

  const rasterOnlyOff = applyResourceOverlayVisibility(visible, 'metals', false)
  assert.strictEqual(shouldDrawResourceRasterOverlay(rasterOnlyOff, 'metals', metalsRaster), false)
  assert.strictEqual(shouldDrawResourceNodeOverlay(rasterOnlyOff, 'metals', metalNodes), false)
})
