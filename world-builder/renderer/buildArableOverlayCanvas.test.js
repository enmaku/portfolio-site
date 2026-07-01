import assert from 'node:assert/strict'
import test from 'node:test'
import { buildArableOverlayCanvas, buildArableOverlayRgba } from './buildArableOverlayCanvas.js'
import {
  getResourceRasterOverlayRgbaBuildCount,
  resetResourceRasterOverlayRgbaBuildCount,
  resourceRasterHatchFactor,
} from './buildResourceRasterOverlayRgba.js'
import { RESOURCE_RASTER_OVERLAY_STYLES } from './resourceRasterOverlayStyles.js'

/**
 * @returns {import('../core/types.js').WorldDocument}
 */
function createArableFixture() {
  const gridWidth = 4
  const gridHeight = 4
  const arableRaster = new Float32Array(16)
  arableRaster[5] = 0.8
  arableRaster[6] = 0.2
  return {
    gridWidth,
    gridHeight,
    biomes: new Uint8Array(16),
    fields: { elevation: new Float32Array(16) },
    arableRaster,
  }
}

test('buildArableOverlayRgba returns null when raster is absent', () => {
  assert.strictEqual(
    buildArableOverlayRgba({
      gridWidth: 2,
      gridHeight: 2,
      biomes: new Uint8Array(4),
      fields: { elevation: new Float32Array(4) },
    }),
    null,
  )
})

test('buildArableOverlayRgba encodes arable strength as alpha via shared raster style', () => {
  const rgba = buildArableOverlayRgba(createArableFixture())
  const { rgb, maxAlpha } = RESOURCE_RASTER_OVERLAY_STYLES.arable
  assert.ok(rgba)
  assert.strictEqual(rgba.length, 4 * 4 * 4)
  assert.strictEqual(rgba[5 * 4], rgb[0])
  assert.strictEqual(rgba[5 * 4 + 1], rgb[1])
  assert.strictEqual(rgba[5 * 4 + 2], rgb[2])
  assert.strictEqual(rgba[5 * 4 + 3], Math.round(0.8 * maxAlpha * resourceRasterHatchFactor(1, 1) * 255))
  assert.strictEqual(
    rgba[6 * 4 + 3],
    Math.round(0.2 * maxAlpha * resourceRasterHatchFactor(2, 1) * 255),
  )
})

test('buildArableOverlayRgba omits cells below minimumProductivity', () => {
  const rgba = buildArableOverlayRgba(createArableFixture(), { minimumProductivity: 0.25 })
  assert.ok(rgba)
  assert.strictEqual(rgba[5 * 4 + 3] > 0, true)
  assert.strictEqual(rgba[6 * 4 + 3], 0)
})

test('buildArableOverlayRgba returns null when minimumProductivity filters all signal', () => {
  assert.strictEqual(
    buildArableOverlayRgba(createArableFixture(), { minimumProductivity: 0.9 }),
    null,
  )
})

test('buildArableOverlayCanvas returns sized canvas when raster has signal', () => {
  globalThis.ImageData = class {
    /**
     * @param {Uint8ClampedArray} data
     * @param {number} width
     */
    constructor(data, width) {
      this.data = data
      this.width = width
    }
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

  const canvas = buildArableOverlayCanvas(createArableFixture())
  assert.ok(canvas)
  assert.strictEqual(canvas.width, 4)
  assert.strictEqual(canvas.height, 4)

  delete globalThis.document
  delete globalThis.ImageData
})

test('buildArableOverlayCanvas rasterizes RGBA only once', () => {
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
  const canvas = buildArableOverlayCanvas(createArableFixture())
  assert.ok(canvas)
  assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 1)

  delete globalThis.document
  delete globalThis.ImageData
})
