import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { BIOMES } from '../core/biomeIds.js'
import { diffWorldDocumentMapLayers } from './diffWorldDocumentMapLayers.js'
import {
  arableSpriteLayer,
  createArableRasterFixture,
  createHostEl,
  createMetalsFixture,
  createOverlayOwnerDriver,
  createSaltNodeFixture,
  createTimberRasterFixture,
  installViewportMocks,
  lakesSpriteLayer,
  recentSpriteLayers,
  riversSpriteLayer,
  timberSpriteLayer,
  uninstallViewportGlobals,
  viewportSpyState,
  viewportTestOptions,
  worldDocFixture,
} from './createWorldBuilderMapViewportTestHarness.js'

/** @type {typeof import('./createWorldBuilderMapViewport.js').createWorldBuilderMapViewport} */
let createWorldBuilderMapViewport

before(async () => {
  if (!viewportTestOptions.skip) {
    createWorldBuilderMapViewport = await installViewportMocks()
  }
})

after(() => {
  uninstallViewportGlobals()
})

/**
 * @returns {Promise<{
 *   getResourceRasterOverlayRgbaBuildCount: () => number,
 *   resetResourceRasterOverlayRgbaBuildCount: () => void,
 * }>}
 */
async function importBuildCounters() {
  return import('./buildResourceRasterOverlayRgba.js')
}

function multiRasterFixture() {
  return {
    ...createArableRasterFixture(),
    timberRaster: createTimberRasterFixture().timberRaster,
    metalsRaster: createMetalsFixture().metalsRaster,
  }
}

function terrainSpriteLayer() {
  return recentSpriteLayers()[0]
}

/**
 * @param {Partial<import('../core/types.js').WorldDocument>} [overrides]
 * @returns {import('../core/types.js').WorldDocument}
 */
function hydrologyDocumentFixture(overrides = {}) {
  const gridWidth = 5
  const gridHeight = 5
  const cellCount = gridWidth * gridHeight
  const displayBiomes = new Uint8Array(cellCount).fill(BIOMES.GRASSLAND)
  const riverNetworkMask = new Uint8Array(cellCount)
  const riverCorridorMask = new Uint8Array(cellCount)
  const lakeMask = new Uint8Array(cellCount)

  for (let y = 1; y <= 3; y += 1) {
    riverNetworkMask[y * gridWidth + 2] = 1
    riverCorridorMask[y * gridWidth + 2] = 1
  }
  lakeMask[7] = 1

  return worldDocFixture({
    gridWidth,
    gridHeight,
    displayBiomes,
    biomes: displayBiomes,
    lakeMask,
    riverNetworkMask,
    riverCorridorMask,
    simulationRiverMask: riverNetworkMask,
    flowDirection: new Int16Array(cellCount).fill(-1),
    riverGraph: { nodes: [], edges: [] },
    fields: {
      elevation: new Float32Array(cellCount).fill(0.55),
      drainage: new Float32Array(cellCount).fill(0.5),
    },
    arableRaster: new Float32Array(cellCount),
    timberRaster: new Float32Array(cellCount),
    metalsRaster: new Float32Array(cellCount),
    ...overrides,
  })
}

test(
  'updateWorldDocument preserves overlay render cache set by syncOverlayRenderCache',
  viewportTestOptions,
  async () => {
    const { createResourceOverlayPageState, toggleResourceOverlayVisibility } = await import(
      '../resourceOverlayState.js'
    )
    const fixture = createTimberRasterFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const ownerState = toggleResourceOverlayVisibility(
      createResourceOverlayPageState(),
      'timber',
      true,
    )

    viewport.syncOverlayRenderCache(ownerState)
    viewport.updateWorldDocument({
      ...fixture,
      timberRaster: Float32Array.from(fixture.timberRaster),
    })

    assert.strictEqual(timberSpriteLayer().visible, true)
    viewport.destroy()
  },
)

test(
  'updateWorldDocument resizes viewport to the new world document dimensions',
  viewportTestOptions,
  async () => {
    const viewport = await createWorldBuilderMapViewport(createHostEl(), createSaltNodeFixture())
    viewport.updateWorldDocument(
      worldDocFixture({
        gridWidth: 64,
        gridHeight: 48,
        saltNodes: [{ x: 1, y: 2 }],
      }),
    )

    assert.deepStrictEqual(viewportSpyState.lastViewportResize, {
      screenWidth: 400,
      screenHeight: 300,
      worldWidth: 64,
      worldHeight: 48,
    })

    viewport.destroy()
  },
)

test(
  'updateWorldDocument rasterizes each visible resource layer at most once',
  viewportTestOptions,
  async () => {
    const { getResourceRasterOverlayRgbaBuildCount, resetResourceRasterOverlayRgbaBuildCount } =
      await importBuildCounters()

    const fixture = multiRasterFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)

    overlay.setVisibility('arable', true)
    overlay.setVisibility('timber', true)
    overlay.setVisibility('metals', true)

    resetResourceRasterOverlayRgbaBuildCount()
    viewport.updateWorldDocument({
      ...fixture,
      arableRaster: Float32Array.from(fixture.arableRaster),
      timberRaster: Float32Array.from(fixture.timberRaster),
      metalsRaster: Float32Array.from(fixture.metalsRaster),
    })
    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 3)

    viewport.destroy()
  },
)

test(
  'updateWorldDocument with changedLayers skips unchanged visible resource layers',
  viewportTestOptions,
  async () => {
    const { getResourceRasterOverlayRgbaBuildCount, resetResourceRasterOverlayRgbaBuildCount } =
      await importBuildCounters()

    const fixture = multiRasterFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)

    overlay.setVisibility('arable', true)
    overlay.setVisibility('timber', true)
    overlay.setVisibility('metals', true)

    resetResourceRasterOverlayRgbaBuildCount()
    viewport.updateWorldDocument(
      {
        ...fixture,
        timberRaster: Float32Array.from(fixture.timberRaster),
      },
      { changedLayers: ['timber'] },
    )
    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 1)

    viewport.destroy()
  },
)

test(
  'overlay owner seam toggles timber on displayed document without rebuilding arable',
  viewportTestOptions,
  async () => {
    const { getResourceRasterOverlayRgbaBuildCount, resetResourceRasterOverlayRgbaBuildCount } =
      await importBuildCounters()

    const fixture = {
      ...createArableRasterFixture(),
      timberRaster: createTimberRasterFixture().timberRaster,
    }
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)

    overlay.setVisibility('arable', true)
    resetResourceRasterOverlayRgbaBuildCount()
    overlay.setVisibility('timber', true)

    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 1)
    assert.strictEqual(arableSpriteLayer().visible, true)
    assert.strictEqual(timberSpriteLayer().visible, true)

    viewport.destroy()
  },
)

test(
  'updateWorldDocument displayBiomes-only change refreshes terrain not hydrology or rasters',
  viewportTestOptions,
  async () => {
    const { getResourceRasterOverlayRgbaBuildCount, resetResourceRasterOverlayRgbaBuildCount } =
      await importBuildCounters()

    const fixture = hydrologyDocumentFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)
    const overlay = createOverlayOwnerDriver(viewport)

    overlay.setVisibility('arable', true)
    overlay.setVisibility('timber', true)

    const terrainTextureBefore = terrainSpriteLayer().texture
    const riversTextureBefore = riversSpriteLayer().texture
    const lakesTextureBefore = lakesSpriteLayer().texture

    const nextDoc = {
      ...fixture,
      displayBiomes: Uint8Array.from(fixture.displayBiomes, (value, index) =>
        index === 0 ? BIOMES.DESERT : value,
      ),
    }
    const changedLayers = diffWorldDocumentMapLayers(fixture, nextDoc)

    resetResourceRasterOverlayRgbaBuildCount()
    viewport.updateWorldDocument(nextDoc, { changedLayers })

    assert.deepStrictEqual(changedLayers, ['terrain'])
    assert.notStrictEqual(terrainSpriteLayer().texture, terrainTextureBefore)
    assert.strictEqual(riversSpriteLayer().texture, riversTextureBefore)
    assert.strictEqual(lakesSpriteLayer().texture, lakesTextureBefore)
    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 0)

    viewport.destroy()
  },
)

test(
  'updateWorldDocument presentation river mask change refreshes rivers not terrain or lakes',
  viewportTestOptions,
  async () => {
    const fixture = hydrologyDocumentFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)

    const terrainTextureBefore = terrainSpriteLayer().texture
    const riversTextureBefore = riversSpriteLayer().texture
    const lakesTextureBefore = lakesSpriteLayer().texture

    const nextDoc = {
      ...fixture,
      riverCorridorMask: Uint8Array.from(fixture.riverCorridorMask, (value, index) =>
        index === 13 ? 1 : value,
      ),
    }
    const changedLayers = diffWorldDocumentMapLayers(fixture, nextDoc)

    viewport.updateWorldDocument(nextDoc, { changedLayers })

    assert.deepStrictEqual(changedLayers, ['rivers'])
    assert.notStrictEqual(riversSpriteLayer().texture, riversTextureBefore)
    assert.strictEqual(terrainSpriteLayer().texture, terrainTextureBefore)
    assert.strictEqual(lakesSpriteLayer().texture, lakesTextureBefore)

    viewport.destroy()
  },
)

test(
  'updateWorldDocument presentation lake mask change refreshes lakes not terrain or rivers',
  viewportTestOptions,
  async () => {
    const fixture = hydrologyDocumentFixture()
    const viewport = await createWorldBuilderMapViewport(createHostEl(), fixture)

    const terrainTextureBefore = terrainSpriteLayer().texture
    const riversTextureBefore = riversSpriteLayer().texture
    const lakesTextureBefore = lakesSpriteLayer().texture

    const nextDoc = {
      ...fixture,
      lakeMask: Uint8Array.from(fixture.lakeMask, (value, index) => (index === 8 ? 1 : value)),
    }
    const changedLayers = diffWorldDocumentMapLayers(fixture, nextDoc)

    viewport.updateWorldDocument(nextDoc, { changedLayers })

    assert.deepStrictEqual(changedLayers, ['lakes'])
    assert.notStrictEqual(lakesSpriteLayer().texture, lakesTextureBefore)
    assert.strictEqual(terrainSpriteLayer().texture, terrainTextureBefore)
    assert.strictEqual(riversSpriteLayer().texture, riversTextureBefore)

    viewport.destroy()
  },
)

test(
  'updateWorldDocument syncs viewport dimensions without refitting to world',
  viewportTestOptions,
  async () => {
    const viewport = await createWorldBuilderMapViewport(createHostEl(), createSaltNodeFixture())
    viewportSpyState.fitWorldCallCount = 0
    viewportSpyState.moveCenterCallCount = 0

    viewport.updateWorldDocument(
      worldDocFixture({
        gridWidth: 64,
        gridHeight: 48,
        saltNodes: [{ x: 1, y: 2 }],
      }),
    )

    assert.deepStrictEqual(viewportSpyState.lastViewportResize, {
      screenWidth: 400,
      screenHeight: 300,
      worldWidth: 64,
      worldHeight: 48,
    })
    assert.strictEqual(viewportSpyState.fitWorldCallCount, 0)
    assert.strictEqual(viewportSpyState.moveCenterCallCount, 0)

    viewport.destroy()
  },
)
