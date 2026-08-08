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
import {
  applyResourceOverlayVisibility,
  createDefaultResourceOverlayVisibility,
  createResourceOverlayDefinitions,
} from '../resourceOverlays.js'

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

function createSailFixture() {
  const cellCount = 64
  const elevation = new Float32Array(cellCount).fill(0.5)
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[36] = 1
  return {
    gridWidth: 8,
    gridHeight: 8,
    fields: { elevation },
    riverCorridorMask,
  }
}

function createFreshwaterFixture() {
  const cellCount = 64
  const rainfall = new Float32Array(cellCount).fill(0.6)
  const drainage = new Float32Array(cellCount).fill(0.2)
  const salinity = new Float32Array(cellCount).fill(0.1)
  const elevation = new Float32Array(cellCount).fill(0.5)
  const biomes = new Uint8Array(cellCount).fill(2)
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[36] = 1
  return {
    gridWidth: 8,
    gridHeight: 8,
    fields: { rainfall, drainage, salinity, elevation },
    biomes,
    riverCorridorMask,
  }
}

function createPopulationFixture() {
  const populationCollapseRaster = new Float32Array(64)
  populationCollapseRaster[36] = 20
  return {
    gridWidth: 8,
    gridHeight: 8,
    populationCollapseRaster,
  }
}

function createExplorationFogFixture() {
  const visitedCells = new Uint8Array(64)
  visitedCells[36] = 1
  return {
    gridWidth: 8,
    gridHeight: 8,
    colonizationPhase: 'running',
    visitedCells,
  }
}

function createRoutesFixture() {
  return {
    gridWidth: 8,
    gridHeight: 8,
    colonizationPhase: 'running',
    roads: [{ cells: [{ x: 1, y: 1 }, { x: 2, y: 1 }] }],
  }
}

function createWealthFixture() {
  return {
    gridWidth: 8,
    gridHeight: 8,
    colonizationPhase: 'running',
    settlements: [{ id: 'a', x: 2, y: 2 }],
    primaryClaim: { a: [{ x: 2, y: 2 }] },
    tradeAccounts: { balancesBySettlementId: { a: 500 } },
    lastTradeEpochResult: {
      obligationDeltas: [{ toSettlementId: 'a', amountCp: 1000, kind: 'goods' }],
    },
  }
}

function createPortTollsFixture() {
  return {
    gridWidth: 8,
    gridHeight: 8,
    colonizationPhase: 'running',
    settlements: [{ id: 'a', x: 2, y: 2, maritimeRole: 'port' }],
    primaryClaim: { a: [{ x: 2, y: 2 }] },
    lastTradeEpochResult: {
      portTollIncomeCpBySettlementId: { a: 40 },
    },
  }
}

function createFactionTaxFixture() {
  return {
    gridWidth: 8,
    gridHeight: 8,
    colonizationPhase: 'running',
    settlements: [{ id: 'a', x: 2, y: 2 }],
    primaryClaim: { a: [{ x: 2, y: 2 }] },
    lastTradeEpochResult: {
      factionTaxNetCpBySettlementId: { a: -8 },
    },
  }
}

function createCommodityPriceFixture() {
  return {
    gridWidth: 8,
    gridHeight: 8,
    colonizationPhase: 'running',
    settlements: [{ id: 'a', x: 2, y: 2 }],
    primaryClaim: { a: [{ x: 2, y: 2 }] },
    saltNodes: [{ id: 'salt-0', x: 0, y: 0 }],
    metalNodes: [
      { id: 'm-copper', x: 1, y: 0, kind: 'copper' },
      { id: 'm-silver', x: 2, y: 0, kind: 'silver' },
      { id: 'm-gold', x: 3, y: 0, kind: 'gold' },
      { id: 'm-diamond', x: 4, y: 0, kind: 'diamond' },
    ],
    lastTradeEpochResult: {
      localPricesBySettlementId: {
        a: {
          grain: 1,
          fish: 2,
          timber: 0.5,
          baseMetals: 10,
          salt: 5,
          copper: 50,
          silver: 500,
          gold: 5000,
          diamonds: 500000,
        },
      },
    },
  }
}

function createFactionTerritoryFixture() {
  return {
    gridWidth: 8,
    gridHeight: 8,
    colonizationPhase: 'running',
    increment3LatchedEpoch: 1,
    settlements: [{ id: 'a', x: 2, y: 2, factionId: 'faction-a' }],
    factions: [
      {
        id: 'faction-a',
        capitalSettlementId: 'a',
        settlementIds: ['a'],
        status: 'active',
        emergedEpoch: 1,
      },
    ],
    primaryClaim: { a: [{ x: 2, y: 2 }] },
  }
}

function createLoyaltyFixture() {
  const cellCount = 64
  return {
    gridWidth: 8,
    gridHeight: 8,
    colonizationPhase: 'running',
    fields: { elevation: new Float32Array(cellCount).fill(0.6) },
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
    settlements: [
      { id: 'a', x: 4, y: 4, factionId: 'faction-a', status: 'living' },
      { id: 'b', x: 3, y: 4, factionId: 'faction-a', status: 'living' },
    ],
    factions: [
      {
        id: 'faction-a',
        capitalSettlementId: 'a',
        settlementIds: ['a', 'b'],
        status: 'active',
        emergedEpoch: 1,
      },
    ],
    primaryClaim: { a: [{ x: 4, y: 4 }] },
    bannerMembershipHistoryBySettlementId: { a: Array(10).fill('faction-a') },
  }
}

function createUnifiedRasterFixture() {
  const cellCount = 64
  const arableRaster = new Float32Array(cellCount)
  arableRaster[36] = 0.75
  const timberRaster = new Float32Array(cellCount)
  timberRaster[36] = 0.8
  const metalsRaster = new Float32Array(cellCount)
  metalsRaster[36] = 0.85
  const elevation = new Float32Array(cellCount).fill(0.5)
  const rainfall = new Float32Array(cellCount).fill(0.6)
  const drainage = new Float32Array(cellCount).fill(0.2)
  const salinity = new Float32Array(cellCount).fill(0.1)
  const biomes = new Uint8Array(cellCount).fill(2)
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[36] = 1
  const populationCollapseRaster = new Float32Array(cellCount)
  populationCollapseRaster[36] = 20
  return {
    gridWidth: 8,
    gridHeight: 8,
    arableRaster,
    timberRaster,
    metalsRaster,
    fields: { elevation, rainfall, drainage, salinity },
    biomes,
    riverCorridorMask,
    populationCollapseRaster,
  }
}

test('RESOURCE_RASTER_OVERLAY_LAYER_IDS lists raster overlay layers from definitions', () => {
  assert.deepStrictEqual(
    RESOURCE_RASTER_OVERLAY_LAYER_IDS,
    createResourceOverlayDefinitions()
      .filter((definition) => definition.kind === 'raster' || definition.kind === 'rasterAndNodes')
      .map((definition) => definition.id),
  )
})

test('isResourceRasterOverlayLayerId identifies raster layers only', () => {
  assert.strictEqual(isResourceRasterOverlayLayerId('arable'), true)
  assert.strictEqual(isResourceRasterOverlayLayerId('timber'), true)
  assert.strictEqual(isResourceRasterOverlayLayerId('metals'), true)
  assert.strictEqual(isResourceRasterOverlayLayerId('sail'), true)
  assert.strictEqual(isResourceRasterOverlayLayerId('freshwater'), true)
  assert.strictEqual(isResourceRasterOverlayLayerId('population'), true)
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
          : resourceId === 'metals'
            ? createMetalsFixture()
            : resourceId === 'freshwater'
              ? createFreshwaterFixture()
              : resourceId === 'population'
                ? createPopulationFixture()
                : resourceId === 'explorationFog'
                  ? createExplorationFogFixture()
                  : resourceId === 'routes'
                    ? createRoutesFixture()
                    : resourceId === 'wealth'
                      ? createWealthFixture()
                      : resourceId === 'portTolls'
                        ? createPortTollsFixture()
                        : resourceId === 'factionTax'
                          ? createFactionTaxFixture()
                          : resourceId.startsWith('commodityPrice')
                            ? createCommodityPriceFixture()
                            : resourceId === 'factionTerritory'
                              ? createFactionTerritoryFixture()
                              : resourceId === 'loyalty'
                                ? createLoyaltyFixture()
                                : createSailFixture()
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

  const worldDocument = createUnifiedRasterFixture()
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
  assert.strictEqual(hiddenCanvases.sail, null)
  assert.strictEqual(hiddenCanvases.freshwater, null)
  assert.strictEqual(hiddenCanvases.population, null)
  assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 0)

  let visibility = createDefaultResourceOverlayVisibility()
  visibility = applyResourceOverlayVisibility(visibility, 'arable', true)
  visibility = applyResourceOverlayVisibility(visibility, 'timber', true)
  visibility = applyResourceOverlayVisibility(visibility, 'metals', true)
  visibility = applyResourceOverlayVisibility(visibility, 'sail', true)
  visibility = applyResourceOverlayVisibility(visibility, 'freshwater', true)
  visibility = applyResourceOverlayVisibility(visibility, 'population', true)

  resetResourceRasterOverlayRgbaBuildCount()
  const visibleCanvases = refreshAllResourceRasterOverlayCanvases({
    visibility,
    worldDocument,
    arableMinimumProductivity: 0,
  })
  assert.ok(visibleCanvases.arable)
  assert.ok(visibleCanvases.timber)
  assert.ok(visibleCanvases.metals)
  assert.ok(visibleCanvases.sail)
  assert.ok(visibleCanvases.freshwater)
  assert.ok(visibleCanvases.population)
  assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 6)

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
