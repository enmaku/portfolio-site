import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTimberOverlayCanvas, buildTimberOverlayRgba } from './buildTimberOverlayCanvas.js'
import {
  getResourceRasterOverlayRgbaBuildCount,
  resetResourceRasterOverlayRgbaBuildCount,
} from './buildResourceRasterOverlayRgba.js'

/**
 * @returns {import('../core/types.js').WorldDocument}
 */
function createTimberFixture() {
  const timberRaster = new Float32Array(16)
  timberRaster[5] = 0.8
  return {
    gridWidth: 4,
    gridHeight: 4,
    timberRaster,
  }
}

test('buildTimberOverlayRgba returns null when raster is absent', () => {
  assert.strictEqual(
    buildTimberOverlayRgba({
      gridWidth: 2,
      gridHeight: 2,
    }),
    null,
  )
})

test('buildTimberOverlayCanvas returns sized canvas when raster has signal', () => {
  globalThis.ImageData = class {
    constructor() {}
  }
  globalThis.document = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return { putImageData() {} }
        },
      }
    },
  }

  const canvas = buildTimberOverlayCanvas(createTimberFixture())
  assert.ok(canvas)
  assert.strictEqual(canvas.width, 4)
  assert.strictEqual(canvas.height, 4)

  delete globalThis.document
  delete globalThis.ImageData
})

test('buildTimberOverlayCanvas rasterizes RGBA only once', () => {
  globalThis.ImageData = class {
    constructor() {}
  }
  globalThis.document = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return { putImageData() {} }
        },
      }
    },
  }

  resetResourceRasterOverlayRgbaBuildCount()
  const canvas = buildTimberOverlayCanvas(createTimberFixture())
  assert.ok(canvas)
  assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 1)

  delete globalThis.document
  delete globalThis.ImageData
})
