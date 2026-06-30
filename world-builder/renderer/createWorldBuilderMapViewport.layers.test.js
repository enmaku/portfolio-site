import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import {
  arableSpriteLayer,
  contoursSpriteLayer,
  createArableRasterFixture,
  createHostEl,
  installViewportMocks,
  lakesSpriteLayer,
  metalsSpriteLayer,
  recentSpriteLayers,
  riversSpriteLayer,
  timberSpriteLayer,
  uninstallViewportGlobals,
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

test(
  'viewport layer stack follows terrain contours arable timber metals lakes rivers order',
  viewportTestOptions,
  async () => {
    const viewport = await createWorldBuilderMapViewport(createHostEl(), createArableRasterFixture())
    const layers = recentSpriteLayers()

    assert.strictEqual(layers.length, 7)
    assert.strictEqual(contoursSpriteLayer(), layers[1])
    assert.strictEqual(arableSpriteLayer(), layers[2])
    assert.strictEqual(timberSpriteLayer(), layers[3])
    assert.strictEqual(metalsSpriteLayer(), layers[4])
    assert.strictEqual(lakesSpriteLayer(), layers[5])
    assert.strictEqual(riversSpriteLayer(), layers[6])

    viewport.destroy()
  },
)

test(
  'lake overlay rasterizes from lakeMask rather than per-cell vector rects',
  viewportTestOptions,
  async () => {
    const { BIOMES } = await import('../core/biomeIds.js')
    const lakeMask = new Uint8Array(16)
    lakeMask[6] = 1
    const biomes = new Uint8Array(16).fill(BIOMES.GRASSLAND)

    const viewport = await createWorldBuilderMapViewport(
      createHostEl(),
      worldDocFixture({
        gridWidth: 4,
        gridHeight: 4,
        biomes,
        lakeMask,
        fields: { elevation: new Float32Array(16).fill(0.55) },
      }),
    )

    assert.strictEqual(lakesSpriteLayer().visible, true)
    assert.notStrictEqual(lakesSpriteLayer().texture, null)

    viewport.destroy()
  },
)
