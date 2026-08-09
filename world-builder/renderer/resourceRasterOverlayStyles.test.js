import assert from 'node:assert/strict'
import test from 'node:test'
import { buildArableOverlayRgba } from './buildArableOverlayCanvas.js'
import { buildTimberOverlayRgba } from './buildTimberOverlayCanvas.js'
import { buildResourceRasterOverlayRgba, resourceRasterHatchFactor } from './buildResourceRasterOverlayRgba.js'
import { RESOURCE_RASTER_OVERLAY_STYLES } from './resourceRasterOverlayStyles.js'

test('resourceRasterHatchFactor leaves transparent gaps between diagonal crosshatch bands', () => {
  assert.strictEqual(resourceRasterHatchFactor(0, 0), 1)
  assert.strictEqual(resourceRasterHatchFactor(3, 0), 0)
  assert.strictEqual(resourceRasterHatchFactor(0, 3), 0)
})

test('timber and arable raster overlay styles use distinct rgba encodings', () => {
  const width = 16
  const height = 16
  const arableRaster = new Float32Array(width * height).fill(0.8)
  const timberRaster = new Float32Array(width * height).fill(0.8)
  const worldDocument = {
    gridWidth: width,
    gridHeight: height,
    arableRaster,
    timberRaster,
  }

  const timberRgba = buildTimberOverlayRgba(worldDocument)
  const arableRgba = buildArableOverlayRgba(worldDocument)

  assert.ok(timberRgba)
  assert.ok(arableRgba)

  let paintedCells = 0
  let distinctPaintedCells = 0
  for (let i = 0; i < arableRaster.length; i += 1) {
    const offset = i * 4
    if (arableRgba[offset + 3] === 0 && timberRgba[offset + 3] === 0) {
      continue
    }

    paintedCells += 1
    if (
      timberRgba[offset] !== arableRgba[offset]
      || timberRgba[offset + 1] !== arableRgba[offset + 1]
      || timberRgba[offset + 2] !== arableRgba[offset + 2]
    ) {
      distinctPaintedCells += 1
    }
  }

  assert.ok(paintedCells > 0)
  assert.strictEqual(distinctPaintedCells, paintedCells)
})

test('buildResourceRasterOverlayRgba returns null when raster has no positive productivity', () => {
  const width = 3
  const height = 3
  const raster = new Float32Array(width * height).fill(0)

  const rgba = buildResourceRasterOverlayRgba({
    raster,
    width,
    height,
    style: RESOURCE_RASTER_OVERLAY_STYLES.timber,
  })

  assert.strictEqual(rgba, null)
})
