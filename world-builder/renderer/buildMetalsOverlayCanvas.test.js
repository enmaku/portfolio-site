import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMetalsOverlayCanvas } from './buildMetalsOverlayCanvas.js'
import { buildResourceRasterOverlayRgba } from './buildResourceRasterOverlayRgba.js'
import { RESOURCE_RASTER_OVERLAY_STYLES } from './resourceRasterOverlayStyles.js'

test('buildMetalsOverlayCanvas returns null when metals raster is empty', () => {
  const canvas = buildMetalsOverlayCanvas({
    gridWidth: 4,
    gridHeight: 4,
    metalsRaster: new Float32Array(16),
  })
  assert.strictEqual(canvas, null)
})

test('buildMetalsOverlayCanvas returns canvas matching grid dimensions', () => {
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

  const metalsRaster = new Float32Array(16)
  metalsRaster[5] = 0.8
  const canvas = buildMetalsOverlayCanvas({
    gridWidth: 4,
    gridHeight: 4,
    metalsRaster,
  })
  assert.ok(canvas)
  assert.strictEqual(canvas?.width, 4)
  assert.strictEqual(canvas?.height, 4)

  delete globalThis.document
  delete globalThis.ImageData
})

test('metals raster overlay style uses hatch encoding distinct from arable', () => {
  const raster = new Float32Array(16)
  raster.fill(0.75)
  const metalsRgba = buildResourceRasterOverlayRgba({
    raster,
    width: 4,
    height: 4,
    style: RESOURCE_RASTER_OVERLAY_STYLES.metals,
  })
  const arableRgba = buildResourceRasterOverlayRgba({
    raster,
    width: 4,
    height: 4,
    style: RESOURCE_RASTER_OVERLAY_STYLES.arable,
  })
  assert.ok(metalsRgba)
  assert.ok(arableRgba)

  let differs = false
  for (let offset = 0; offset < metalsRgba.length; offset += 4) {
    if (
      metalsRgba[offset] !== arableRgba[offset]
      || metalsRgba[offset + 1] !== arableRgba[offset + 1]
      || metalsRgba[offset + 2] !== arableRgba[offset + 2]
      || metalsRgba[offset + 3] !== arableRgba[offset + 3]
    ) {
      differs = true
      break
    }
  }
  assert.strictEqual(differs, true)
})
