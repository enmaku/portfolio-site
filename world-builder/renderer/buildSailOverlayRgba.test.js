import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getResourceRasterOverlayRgbaBuildCount,
  resetResourceRasterOverlayRgbaBuildCount,
} from './buildResourceRasterOverlayRgba.js'
import {
  buildSailOverlayRgba,
  SAIL_OVERLAY_ALPHA,
  SAIL_OVERLAY_RGB,
} from './buildSailOverlayRgba.js'

test('buildSailOverlayRgba writes pink alpha only on derived sail mask cells', () => {
  const width = 8
  const height = 8
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(0.5)
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[4 * width + 4] = 1

  const rgba = buildSailOverlayRgba({
    gridWidth: width,
    gridHeight: height,
    fields: { elevation },
    riverCorridorMask,
  })
  assert.ok(rgba)

  const alphaByte = Math.round(SAIL_OVERLAY_ALPHA * 255)
  let paintedCells = 0
  for (let i = 0; i < cellCount; i += 1) {
    const base = i * 4
    if (rgba[base + 3] > 0) {
      paintedCells += 1
      assert.strictEqual(rgba[base], SAIL_OVERLAY_RGB[0])
      assert.strictEqual(rgba[base + 1], SAIL_OVERLAY_RGB[1])
      assert.strictEqual(rgba[base + 2], SAIL_OVERLAY_RGB[2])
      assert.strictEqual(rgba[base + 3], alphaByte)
    }
  }
  assert.ok(paintedCells > 0)
})

test('buildSailOverlayRgba returns null without elevation fields', () => {
  assert.equal(
    buildSailOverlayRgba({
      gridWidth: 4,
      gridHeight: 4,
      fields: undefined,
    }),
    null,
  )
})

test('buildSailOverlayRgba increments seam build counter', () => {
  resetResourceRasterOverlayRgbaBuildCount()
  const width = 8
  const height = 8
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(0.5)
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[4 * width + 4] = 1

  buildSailOverlayRgba({
    gridWidth: width,
    gridHeight: height,
    fields: { elevation },
    riverCorridorMask,
  })
  assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 1)
})
