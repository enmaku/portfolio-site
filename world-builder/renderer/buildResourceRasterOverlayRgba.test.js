import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildResourceRasterOverlayRgba,
  getResourceRasterOverlayRgbaBuildCount,
  hasDrawableResourceRasterOverlayPixels,
  resetResourceRasterOverlayRgbaBuildCount,
  resourceRasterHatchFactor,
  RESOURCE_RASTER_HATCH_LINE_WIDTH,
  RESOURCE_RASTER_HATCH_SPACING,
} from './buildResourceRasterOverlayRgba.js'
import { RESOURCE_RASTER_OVERLAY_STYLES } from './resourceRasterOverlayStyles.js'

test('resourceRasterHatchFactor leaves transparent gaps between diagonal crosshatch bands', () => {
  assert.strictEqual(resourceRasterHatchFactor(0, 0), 1)
  assert.strictEqual(resourceRasterHatchFactor(3, 0), 0)
  assert.strictEqual(resourceRasterHatchFactor(0, 3), 0)
})

test('resourceRasterHatchFactor honors custom spacing and line width', () => {
  assert.strictEqual(resourceRasterHatchFactor(0, 0, 4, 1), 1)
  assert.strictEqual(resourceRasterHatchFactor(2, 0, 4, 1), 0)
})

test('buildResourceRasterOverlayRgba returns null when raster has no positive productivity', () => {
  const rgba = buildResourceRasterOverlayRgba({
    raster: new Float32Array(9).fill(0),
    width: 3,
    height: 3,
    style: RESOURCE_RASTER_OVERLAY_STYLES.timber,
  })
  assert.strictEqual(rgba, null)
})

test('buildResourceRasterOverlayRgba encodes productivity as alpha with style rgb', () => {
  const raster = new Float32Array(4)
  raster[1] = 0.5
  const rgba = buildResourceRasterOverlayRgba({
    raster,
    width: 2,
    height: 2,
    style: RESOURCE_RASTER_OVERLAY_STYLES.timber,
  })
  const { rgb, maxAlpha } = RESOURCE_RASTER_OVERLAY_STYLES.timber
  assert.ok(rgba)
  assert.strictEqual(rgba[1 * 4], rgb[0])
  assert.strictEqual(rgba[1 * 4 + 1], rgb[1])
  assert.strictEqual(rgba[1 * 4 + 2], rgb[2])
  assert.strictEqual(
    rgba[1 * 4 + 3],
    Math.round(0.5 * maxAlpha * resourceRasterHatchFactor(1, 0) * 255),
  )
})

test('buildResourceRasterOverlayRgba omits cells below minimumProductivity', () => {
  const raster = new Float32Array(4)
  raster[0] = 0.8
  raster[1] = 0.2
  const rgba = buildResourceRasterOverlayRgba({
    raster,
    width: 2,
    height: 2,
    style: RESOURCE_RASTER_OVERLAY_STYLES.arable,
    minimumProductivity: 0.25,
  })
  assert.ok(rgba)
  assert.strictEqual(rgba[1 * 4 + 3], 0)
  assert.ok(rgba[0 * 4 + 3] > 0)
})

test('hasDrawableResourceRasterOverlayPixels matches buildResourceRasterOverlayRgba nullability', () => {
  const raster = new Float32Array(4)
  raster[1] = 0.5
  const params = {
    raster,
    width: 2,
    height: 2,
    style: RESOURCE_RASTER_OVERLAY_STYLES.timber,
  }
  assert.strictEqual(hasDrawableResourceRasterOverlayPixels(params), buildResourceRasterOverlayRgba(params) !== null)
})

test('hasDrawableResourceRasterOverlayPixels honors minimumProductivity like RGBA builder', () => {
  const raster = new Float32Array(4)
  raster[0] = 0.8
  raster[1] = 0.2
  const params = {
    raster,
    width: 2,
    height: 2,
    style: RESOURCE_RASTER_OVERLAY_STYLES.arable,
    minimumProductivity: 0.25,
  }
  assert.strictEqual(hasDrawableResourceRasterOverlayPixels(params), true)
  assert.strictEqual(
    hasDrawableResourceRasterOverlayPixels({ ...params, minimumProductivity: 0.9 }),
    false,
  )
})

test('buildResourceRasterOverlayRgba increments seam build counter', () => {
  resetResourceRasterOverlayRgbaBuildCount()
  buildResourceRasterOverlayRgba({
    raster: new Float32Array([0.5]),
    width: 1,
    height: 1,
    style: RESOURCE_RASTER_OVERLAY_STYLES.timber,
  })
  assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 1)
})

test('buildResourceRasterOverlayRgba applies hatch mask for metals style', () => {
  const raster = new Float32Array(1).fill(0.9)
  const rgba = buildResourceRasterOverlayRgba({
    raster,
    width: 1,
    height: 1,
    style: RESOURCE_RASTER_OVERLAY_STYLES.metals,
  })
  assert.ok(rgba)
  const hatchFactor = resourceRasterHatchFactor(0, 0, RESOURCE_RASTER_HATCH_SPACING, RESOURCE_RASTER_HATCH_LINE_WIDTH)
  assert.strictEqual(
    rgba[3],
    Math.round(0.9 * RESOURCE_RASTER_OVERLAY_STYLES.metals.maxAlpha * hatchFactor * 255),
  )
})
