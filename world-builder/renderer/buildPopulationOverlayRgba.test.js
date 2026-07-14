import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getResourceRasterOverlayRgbaBuildCount,
  resetResourceRasterOverlayRgbaBuildCount,
} from './buildResourceRasterOverlayRgba.js'
import {
  POPULATION_OVERLAY_MAX_ALPHA,
  POPULATION_OVERLAY_MIN_ALPHA,
  POPULATION_OVERLAY_RGB,
  buildPopulationOverlayRgba,
  populationOverlayAlphaForValue,
} from './buildPopulationOverlayRgba.js'

test('populationOverlayAlphaForValue only paints integer counts', () => {
  assert.strictEqual(populationOverlayAlphaForValue(0, 10), 0)
  assert.strictEqual(populationOverlayAlphaForValue(0.5, 10), 0)
  const coreAlpha = populationOverlayAlphaForValue(35, 35)
  const hinterlandAlpha = populationOverlayAlphaForValue(1, 35)
  assert.ok(coreAlpha >= POPULATION_OVERLAY_MIN_ALPHA)
  assert.ok(coreAlpha <= POPULATION_OVERLAY_MAX_ALPHA)
  assert.ok(hinterlandAlpha >= POPULATION_OVERLAY_MIN_ALPHA)
  assert.ok(hinterlandAlpha < coreAlpha)
})

test('buildPopulationOverlayRgba paints only occupied cells as a scatter', () => {
  resetResourceRasterOverlayRgbaBuildCount()
  const populationCollapseRaster = new Float32Array(9)
  populationCollapseRaster[4] = 35
  populationCollapseRaster[5] = 1
  populationCollapseRaster[0] = 0.4

  const rgba = buildPopulationOverlayRgba({
    gridWidth: 3,
    gridHeight: 3,
    populationCollapseRaster,
  })
  assert.ok(rgba)
  assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 1)

  const coreBase = 4 * 4
  const hinterlandBase = 5 * 4
  assert.strictEqual(rgba[coreBase], POPULATION_OVERLAY_RGB[0])
  assert.ok(rgba[coreBase + 3] > rgba[hinterlandBase + 3])
  assert.ok(rgba[hinterlandBase + 3] >= Math.round(POPULATION_OVERLAY_MIN_ALPHA * 255) - 1)
  assert.strictEqual(rgba[0 + 3], 0)
})

test('buildPopulationOverlayRgba returns null without occupied cells', () => {
  resetResourceRasterOverlayRgbaBuildCount()
  assert.strictEqual(
    buildPopulationOverlayRgba({ gridWidth: 2, gridHeight: 2 }),
    null,
  )
  assert.strictEqual(
    buildPopulationOverlayRgba({
      gridWidth: 2,
      gridHeight: 2,
      populationCollapseRaster: new Float32Array(4),
    }),
    null,
  )
  assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 2)
})
