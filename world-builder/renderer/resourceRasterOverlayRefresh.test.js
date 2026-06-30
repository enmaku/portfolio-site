import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildResourceRasterOverlayRgba,
  getResourceRasterOverlayRgbaBuildCount,
  resetResourceRasterOverlayRgbaBuildCount,
} from './buildResourceRasterOverlayRgba.js'
import {
  buildResourceRasterOverlayCanvasForId,
  isResourceRasterOverlayLayerId,
  refreshAllResourceRasterOverlayCanvases,
  refreshResourceRasterOverlayCanvas,
  resolveResourceRasterOverlaySpriteVisible,
  RESOURCE_RASTER_OVERLAY_LAYER_IDS,
} from './resourceRasterOverlayRefresh.js'
import { applyResourceOverlayVisibility, createDefaultResourceOverlayVisibility } from '../resourceOverlays.js'

/**
 * @returns {import('../core/types.js').WorldDocument}
 */
function createArableFixture() {
  const arableRaster = new Float32Array(16)
  arableRaster[5] = 0.75
  return {
    gridWidth: 4,
    gridHeight: 4,
    arableRaster,
  }
}

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

/**
 * @returns {import('../core/types.js').WorldDocument}
 */
function createMetalsFixture() {
  const metalsRaster = new Float32Array(16)
  metalsRaster[6] = 0.85
  return {
    gridWidth: 4,
    gridHeight: 4,
    metalsRaster,
  }
}

test('RESOURCE_RASTER_OVERLAY_LAYER_IDS lists raster overlay layers from definitions', () => {
  assert.deepStrictEqual(RESOURCE_RASTER_OVERLAY_LAYER_IDS, ['arable', 'timber', 'metals'])
})

test('isResourceRasterOverlayLayerId identifies raster layers only', () => {
  assert.strictEqual(isResourceRasterOverlayLayerId('arable'), true)
  assert.strictEqual(isResourceRasterOverlayLayerId('timber'), true)
  assert.strictEqual(isResourceRasterOverlayLayerId('metals'), true)
  assert.strictEqual(isResourceRasterOverlayLayerId('salt'), false)
})

test('resolveResourceRasterOverlaySpriteVisible does not rasterize overlay RGBA', () => {
  resetResourceRasterOverlayRgbaBuildCount()
  const visibility = applyResourceOverlayVisibility(
    createDefaultResourceOverlayVisibility(),
    'timber',
    true,
  )
  const worldDocument = createTimberFixture()

  assert.strictEqual(
    resolveResourceRasterOverlaySpriteVisible('timber', {
      visibility,
      worldDocument,
      arableMinimumProductivity: 0,
    }),
    true,
  )
  assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 0)
})

test('resolveResourceRasterOverlaySpriteVisible respects arable minimum productivity without building RGBA', () => {
  resetResourceRasterOverlayRgbaBuildCount()
  const visibility = applyResourceOverlayVisibility(
    createDefaultResourceOverlayVisibility(),
    'arable',
    true,
  )
  const worldDocument = createArableFixture()

  assert.strictEqual(
    resolveResourceRasterOverlaySpriteVisible('arable', {
      visibility,
      worldDocument,
      arableMinimumProductivity: 0,
    }),
    true,
  )
  assert.strictEqual(
    resolveResourceRasterOverlaySpriteVisible('arable', {
      visibility,
      worldDocument,
      arableMinimumProductivity: 0.9,
    }),
    false,
  )
  assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 0)
})

test('refreshResourceRasterOverlayCanvas performs at most one RGBA build per layer refresh', () => {
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

  for (const resourceId of RESOURCE_RASTER_OVERLAY_LAYER_IDS) {
    resetResourceRasterOverlayRgbaBuildCount()
    const fixture =
      resourceId === 'arable'
        ? createArableFixture()
        : resourceId === 'timber'
          ? createTimberFixture()
          : createMetalsFixture()
    const visibility = applyResourceOverlayVisibility(
      createDefaultResourceOverlayVisibility(),
      resourceId,
      true,
    )
    const context = { visibility, worldDocument: fixture, arableMinimumProductivity: 0 }

    const canvas = refreshResourceRasterOverlayCanvas(resourceId, context)
    assert.ok(canvas, `${resourceId} should produce a canvas when visible`)
    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 1, `${resourceId} should rasterize once`)

    resetResourceRasterOverlayRgbaBuildCount()
    const hiddenContext = {
      ...context,
      visibility: createDefaultResourceOverlayVisibility(),
    }
    assert.strictEqual(refreshResourceRasterOverlayCanvas(resourceId, hiddenContext), null)
    assert.strictEqual(
      getResourceRasterOverlayRgbaBuildCount(),
      0,
      `${resourceId} should skip rasterization when hidden`,
    )
  }

  delete globalThis.document
  delete globalThis.ImageData
})

test('refreshAllResourceRasterOverlayCanvases rasterizes only visible layers once each', () => {
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

  const worldDocument = {
    gridWidth: 4,
    gridHeight: 4,
    arableRaster: createArableFixture().arableRaster,
    timberRaster: createTimberFixture().timberRaster,
    metalsRaster: createMetalsFixture().metalsRaster,
  }
  const hiddenContext = {
    visibility: createDefaultResourceOverlayVisibility(),
    worldDocument,
    arableMinimumProductivity: 0,
  }

  resetResourceRasterOverlayRgbaBuildCount()
  const hiddenCanvases = refreshAllResourceRasterOverlayCanvases(hiddenContext)
  assert.strictEqual(hiddenCanvases.arable, null)
  assert.strictEqual(hiddenCanvases.timber, null)
  assert.strictEqual(hiddenCanvases.metals, null)
  assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 0)

  let visibility = createDefaultResourceOverlayVisibility()
  visibility = applyResourceOverlayVisibility(visibility, 'arable', true)
  visibility = applyResourceOverlayVisibility(visibility, 'timber', true)
  visibility = applyResourceOverlayVisibility(visibility, 'metals', true)

  resetResourceRasterOverlayRgbaBuildCount()
  const visibleCanvases = refreshAllResourceRasterOverlayCanvases({
    visibility,
    worldDocument,
    arableMinimumProductivity: 0,
  })
  assert.ok(visibleCanvases.arable)
  assert.ok(visibleCanvases.timber)
  assert.ok(visibleCanvases.metals)
  assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 3)

  delete globalThis.document
  delete globalThis.ImageData
})

test('buildResourceRasterOverlayCanvasForId builds metals canvas with a single RGBA pass', () => {
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
  const canvas = buildResourceRasterOverlayCanvasForId('metals', createMetalsFixture(), {
    arableMinimumProductivity: 0,
  })
  assert.ok(canvas)
  assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 1)

  delete globalThis.document
  delete globalThis.ImageData
})

test('buildResourceRasterOverlayRgba increments seam build counter', () => {
  resetResourceRasterOverlayRgbaBuildCount()
  buildResourceRasterOverlayRgba({
    raster: new Float32Array([0.5]),
    width: 1,
    height: 1,
    style: { id: 'timber', rgb: [0, 0, 0], hatch: false, maxAlpha: 1 },
  })
  assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 1)
})
