import assert from 'node:assert/strict'
import { after, before, mock, test } from 'node:test'

/** @type {Array<{ x: number, y: number, color: number }>} */
let drawnCircles = []

/** @type {Array<{ x: number, y: number, w: number, h: number }>} */
let drawnRects = []

/** @type {Array<{ position: { x: number, y: number }, scale: number }>} */
let viewportAnimations = []

/** @type {{ worldWidth: number, worldHeight: number } | null} */
let lastViewportResize = null

/** @type {Array<{ visible: boolean, texture: unknown }>} */
let spriteLayers = []

/** @type {typeof import('./createWorldBuilderMapViewport.js')} */
let createWorldBuilderMapViewport

const viewportTests = { skip: !mock.module }

before(async () => {
  if (!mock.module) return

  drawnCircles = []
  drawnRects = []
  viewportAnimations = []
  lastViewportResize = null
  spriteLayers = []

  globalThis.ImageData = class {
    constructor() {}
  }

  globalThis.document = {
  /** @param {string} tag */
    createElement(tag) {
      if (tag !== 'canvas') {
        throw new Error(`Unexpected element: ${tag}`)
      }
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            putImageData() {},
          }
        },
      }
    },
  }

  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }

  mock.module('pixi.js', {
    namedExports: {
      Application: class {
        constructor() {
          this.canvas = { tagName: 'CANVAS' }
          this.stage = { addChild() {} }
          this.renderer = { events: {} }
        }
        async init() {}
        destroy() {}
      },
      Sprite: class {
        constructor() {
          this.visible = true
          this.texture = null
          spriteLayers.push(this)
        }
      },
      Texture: {
        EMPTY: {},
        from() {
          return { destroy() {} }
        },
      },
      Graphics: class {
        clear() {
          drawnCircles = []
          drawnRects = []
        }
        circle(x, y) {
          drawnCircles.push({ x, y, color: null })
        }
        fill({ color } = {}) {
          const last = drawnCircles.at(-1)
          if (last) last.color = color
        }
        rect(x, y, w, h) {
          drawnRects.push({ x, y, w, h })
        }
      },
    },
  })

  mock.module('pixi-viewport', {
    namedExports: {
      Viewport: class {
        constructor() {
          this.worldWidth = 0
          this.worldHeight = 0
        }
        addChild() {
          return this
        }
        drag() {
          return this
        }
        pinch() {
          return this
        }
        wheel() {
          return this
        }
        decelerate() {
          return this
        }
        clampZoom() {
          return this
        }
        resize(_width, _height, worldWidth, worldHeight) {
          this.worldWidth = worldWidth
          this.worldHeight = worldHeight
          lastViewportResize = { worldWidth, worldHeight }
        }
        fitWorld() {}
        moveCenter() {}
        animate(options) {
          viewportAnimations.push(options)
        }
        destroy() {}
      },
    },
  })

  createWorldBuilderMapViewport = (
    await import(`./createWorldBuilderMapViewport.js?test=${Date.now()}`)
  ).createWorldBuilderMapViewport
})

after(() => {
  delete globalThis.document
  delete globalThis.ImageData
  delete globalThis.ResizeObserver
})

/**
 * @param {Partial<import('../core/types.js').WorldDocument> & Pick<import('../core/types.js').WorldDocument, 'gridWidth' | 'gridHeight'>} partial
 * @returns {import('../core/types.js').WorldDocument}
 */
function worldDocFixture(partial) {
  const cellCount = partial.gridWidth * partial.gridHeight
  const biomes = partial.biomes ?? new Uint8Array(cellCount)
  return {
    ...partial,
    biomes,
    displayBiomes: partial.displayBiomes ?? new Uint8Array(biomes),
    fields: partial.fields ?? { elevation: new Float32Array(cellCount) },
  }
}

/**
 * @returns {import('../core/types.js').WorldDocument}
 */
function createSaltNodeFixture() {
  return worldDocFixture({
    gridWidth: 4,
    gridHeight: 4,
    saltNodes: [{ x: 1, y: 2 }],
  })
}
/**
 * Sprites from the most recently created viewport (six raster layers).
 */
function recentSpriteLayers() {
  return spriteLayers.slice(-6)
}

/**
 * Contours sprite sits above terrain in the layer stack.
 */
function contoursSpriteLayer() {
  return recentSpriteLayers()[1]
}

/**
 * Arable sprite sits above contours in the layer stack.
 */
function arableSpriteLayer() {
  return recentSpriteLayers()[2]
}

/**
 * Timber sprite sits above arable in the layer stack.
 */
function timberSpriteLayer() {
  return recentSpriteLayers()[3]
}

/**
 * Metals sprite sits above timber in the layer stack.
 */
function metalsSpriteLayer() {
  return recentSpriteLayers()[4]
}

/**
 * Rivers sprite sits above resource raster overlays in the layer stack.
 */
function riversSpriteLayer() {
  return recentSpriteLayers()[5]
}

/**
 * @returns {import('../core/types.js').WorldDocument}
 */
function createTimberRasterFixture() {
  const timberRaster = new Float32Array(16)
  timberRaster[5] = 0.8
  return worldDocFixture({
    gridWidth: 4,
    gridHeight: 4,
    timberRaster,
  })
}

/**
 * @returns {import('../core/types.js').WorldDocument}
 */
function createArableRasterFixture() {
  const arableRaster = new Float32Array(16)
  arableRaster[5] = 0.75
  return worldDocFixture({
    gridWidth: 4,
    gridHeight: 4,
    fields: {
      elevation: new Float32Array(16).fill(0.55),
    },
    arableRaster,
  })
}

/**
 * @returns {import('../core/types.js').WorldDocument}
 */
function createMetalsFixture() {
  const metalsRaster = new Float32Array(16)
  metalsRaster[6] = 0.85
  return worldDocFixture({
    gridWidth: 4,
    gridHeight: 4,
    fields: {
      elevation: new Float32Array(16).fill(0.7),
    },
    metalsRaster,
    metalNodes: [{ id: 'metal-0', x: 2, y: 1, score: 0.9 }],
  })
}

test(
  'setResourceOverlayVisibility hides salt markers by default and shows them when enabled',
  viewportTests,
  async () => {
    const hostEl = {
      clientWidth: 400,
      clientHeight: 300,
      replaceChildren() {},
    }

    const { resolveSaltNodeOverlayDrawn } = await import('./worldBuilderMapViewportModel.js')
    const { SALT_NODE_OVERLAY_COLOR } = await import('./createWorldBuilderMapViewport.js')
    const fixture = createSaltNodeFixture()
    const viewport = await createWorldBuilderMapViewport(hostEl, fixture)
    const hiddenVisibility = { arable: false, timber: false, metals: false, salt: false }

    assert.strictEqual(
      drawnCircles.some((circle) => circle.color === SALT_NODE_OVERLAY_COLOR),
      resolveSaltNodeOverlayDrawn(hiddenVisibility, fixture),
    )

    viewport.setResourceOverlayVisibility('salt', true)
    const visibleVisibility = { ...hiddenVisibility, salt: true }
    assert.strictEqual(
      drawnCircles.some((circle) => circle.color === SALT_NODE_OVERLAY_COLOR),
      resolveSaltNodeOverlayDrawn(visibleVisibility, fixture),
    )

    viewport.setResourceOverlayVisibility('salt', false)
    assert.strictEqual(
      drawnCircles.some((circle) => circle.color === SALT_NODE_OVERLAY_COLOR),
      resolveSaltNodeOverlayDrawn(hiddenVisibility, fixture),
    )

    viewport.destroy()
  },
)

test(
  'viewport layer stack follows terrain contours arable timber metals rivers order',
  viewportTests,
  async () => {
    const hostEl = {
      clientWidth: 400,
      clientHeight: 300,
      replaceChildren() {},
    }

    const viewport = await createWorldBuilderMapViewport(hostEl, createArableRasterFixture())
    const layers = recentSpriteLayers()

    assert.strictEqual(layers.length, 6)
    assert.strictEqual(contoursSpriteLayer(), layers[1])
    assert.strictEqual(arableSpriteLayer(), layers[2])
    assert.strictEqual(timberSpriteLayer(), layers[3])
    assert.strictEqual(metalsSpriteLayer(), layers[4])
    assert.strictEqual(riversSpriteLayer(), layers[5])

    viewport.destroy()
  },
)

test(
  'setResourceOverlayVisibility hides arable raster by default and shows it when enabled',
  viewportTests,
  async () => {
    const hostEl = {
      clientWidth: 400,
      clientHeight: 300,
      replaceChildren() {},
    }

    const { resolveArableRasterLayerVisible } = await import('./worldBuilderMapViewportModel.js')
    const { DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY } = await import('../resourceOverlays.js')
    const fixture = createArableRasterFixture()
    const viewport = await createWorldBuilderMapViewport(hostEl, fixture)
    const hiddenVisibility = { arable: false, timber: false, metals: false, salt: false }

    assert.strictEqual(
      arableSpriteLayer().visible,
      resolveArableRasterLayerVisible(
        hiddenVisibility,
        fixture,
        DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
      ),
    )

    viewport.setResourceOverlayVisibility('arable', true)
    const visibleVisibility = { ...hiddenVisibility, arable: true }
    assert.strictEqual(
      arableSpriteLayer().visible,
      resolveArableRasterLayerVisible(
        visibleVisibility,
        fixture,
        DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
      ),
    )

    viewport.setResourceOverlayVisibility('arable', false)
    assert.strictEqual(
      arableSpriteLayer().visible,
      resolveArableRasterLayerVisible(
        hiddenVisibility,
        fixture,
        DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
      ),
    )

    viewport.destroy()
  },
)

test(
  'setArableOverlayMinimumProductivity redraws arable overlay without toggling visibility',
  viewportTests,
  async () => {
    const hostEl = {
      clientWidth: 400,
      clientHeight: 300,
      replaceChildren() {},
    }

    const { resolveArableRasterLayerVisible } = await import('./worldBuilderMapViewportModel.js')
    const fixture = createArableRasterFixture()
    const viewport = await createWorldBuilderMapViewport(hostEl, fixture)
    const visibleVisibility = { arable: true, timber: false, metals: false, salt: false }

    viewport.setResourceOverlayVisibility('arable', true)
    assert.strictEqual(
      arableSpriteLayer().visible,
      resolveArableRasterLayerVisible(visibleVisibility, fixture, 0.4),
    )

    viewport.setArableOverlayMinimumProductivity(0.9)
    assert.strictEqual(
      arableSpriteLayer().visible,
      resolveArableRasterLayerVisible(visibleVisibility, fixture, 0.9),
    )

    viewport.setArableOverlayMinimumProductivity(0)
    assert.strictEqual(
      arableSpriteLayer().visible,
      resolveArableRasterLayerVisible(visibleVisibility, fixture, 0),
    )

    viewport.destroy()
  },
)

test(
  'setResourceOverlayVisibility hides timber raster by default and shows it when enabled',
  viewportTests,
  async () => {
    const hostEl = {
      clientWidth: 400,
      clientHeight: 300,
      replaceChildren() {},
    }

    const { resolveResourceRasterLayerVisible } = await import('./worldBuilderMapViewportModel.js')
    const fixture = createTimberRasterFixture()
    const viewport = await createWorldBuilderMapViewport(hostEl, fixture)
    const hiddenVisibility = { arable: false, timber: false, metals: false, salt: false }

    assert.strictEqual(
      timberSpriteLayer().visible,
      resolveResourceRasterLayerVisible(hiddenVisibility, 'timber', fixture),
    )

    viewport.setResourceOverlayVisibility('timber', true)
    const visibleVisibility = { ...hiddenVisibility, timber: true }
    assert.strictEqual(
      timberSpriteLayer().visible,
      resolveResourceRasterLayerVisible(visibleVisibility, 'timber', fixture),
    )

    viewport.setResourceOverlayVisibility('timber', false)
    assert.strictEqual(
      timberSpriteLayer().visible,
      resolveResourceRasterLayerVisible(hiddenVisibility, 'timber', fixture),
    )

    viewport.destroy()
  },
)

test(
  'setResourceOverlayVisibility can show arable and timber overlays together independently',
  viewportTests,
  async () => {
    const hostEl = {
      clientWidth: 400,
      clientHeight: 300,
      replaceChildren() {},
    }

    const fixture = {
      ...createArableRasterFixture(),
      timberRaster: createTimberRasterFixture().timberRaster,
    }
    const viewport = await createWorldBuilderMapViewport(hostEl, fixture)

    viewport.setResourceOverlayVisibility('arable', true)
    viewport.setResourceOverlayVisibility('timber', true)

    assert.strictEqual(arableSpriteLayer().visible, true)
    assert.strictEqual(timberSpriteLayer().visible, true)

    viewport.setResourceOverlayVisibility('arable', false)
    assert.strictEqual(arableSpriteLayer().visible, false)
    assert.strictEqual(timberSpriteLayer().visible, true)

    viewport.setResourceOverlayVisibility('timber', false)
    assert.strictEqual(arableSpriteLayer().visible, false)
    assert.strictEqual(timberSpriteLayer().visible, false)

    viewport.destroy()
  },
)

test(
  'setResourceOverlayVisibility can show salt and timber overlays together',
  viewportTests,
  async () => {
    const hostEl = {
      clientWidth: 400,
      clientHeight: 300,
      replaceChildren() {},
    }

    const fixture = {
      ...createSaltNodeFixture(),
      timberRaster: createTimberRasterFixture().timberRaster,
    }
    const { SALT_NODE_OVERLAY_COLOR } = await import('./createWorldBuilderMapViewport.js')
    const viewport = await createWorldBuilderMapViewport(hostEl, fixture)

    viewport.setResourceOverlayVisibility('salt', true)
    viewport.setResourceOverlayVisibility('timber', true)

    assert.strictEqual(
      drawnCircles.some((circle) => circle.color === SALT_NODE_OVERLAY_COLOR),
      true,
    )
    assert.strictEqual(timberSpriteLayer().visible, true)

    viewport.destroy()
  },
)

test(
  'setResourceOverlayVisibility toggles metals hatch raster and mine markers together',
  viewportTests,
  async () => {
    const hostEl = {
      clientWidth: 400,
      clientHeight: 300,
      replaceChildren() {},
    }

    const { resolveMetalsOverlayDrawn } = await import('./worldBuilderMapViewportModel.js')
    const { METAL_NODE_OVERLAY_COLOR } = await import('./createWorldBuilderMapViewport.js')
    const fixture = createMetalsFixture()
    const viewport = await createWorldBuilderMapViewport(hostEl, fixture)
    const hiddenVisibility = { arable: false, timber: false, metals: false, salt: false }

    assert.strictEqual(
      metalsSpriteLayer().visible,
      resolveMetalsOverlayDrawn(hiddenVisibility, fixture).rasterVisible,
    )
    assert.strictEqual(
      drawnCircles.some((circle) => circle.color === METAL_NODE_OVERLAY_COLOR),
      resolveMetalsOverlayDrawn(hiddenVisibility, fixture).nodesVisible,
    )

    viewport.setResourceOverlayVisibility('metals', true)
    const visibleVisibility = { ...hiddenVisibility, metals: true }
    const visibleDrawn = resolveMetalsOverlayDrawn(visibleVisibility, fixture)
    assert.strictEqual(metalsSpriteLayer().visible, visibleDrawn.rasterVisible)
    assert.strictEqual(
      drawnCircles.some((circle) => circle.color === METAL_NODE_OVERLAY_COLOR),
      visibleDrawn.nodesVisible,
    )

    viewport.setResourceOverlayVisibility('metals', false)
    assert.strictEqual(
      metalsSpriteLayer().visible,
      resolveMetalsOverlayDrawn(hiddenVisibility, fixture).rasterVisible,
    )
    assert.strictEqual(
      drawnCircles.some((circle) => circle.color === METAL_NODE_OVERLAY_COLOR),
      resolveMetalsOverlayDrawn(hiddenVisibility, fixture).nodesVisible,
    )

    viewport.destroy()
  },
)

test(
  'updateWorldDocument resizes viewport to the new world document dimensions',
  viewportTests,
  async () => {
    const hostEl = {
      clientWidth: 400,
      clientHeight: 300,
      replaceChildren() {},
    }

    const viewport = await createWorldBuilderMapViewport(hostEl, createSaltNodeFixture())
    viewport.updateWorldDocument(
      worldDocFixture({
        gridWidth: 64,
        gridHeight: 48,
        saltNodes: [{ x: 1, y: 2 }],
      }),
    )

    assert.deepStrictEqual(lastViewportResize, { worldWidth: 64, worldHeight: 48 })

    viewport.destroy()
  },
)

test(
  'focusOn uses current world document width after regeneration',
  viewportTests,
  async () => {
    const hostEl = {
      clientWidth: 400,
      clientHeight: 300,
      replaceChildren() {},
    }

    const viewport = await createWorldBuilderMapViewport(hostEl, createSaltNodeFixture())
    viewport.updateWorldDocument(
      worldDocFixture({
        gridWidth: 80,
        gridHeight: 80,
        saltNodes: [{ x: 1, y: 2 }],
      }),
    )

    viewport.focusOn({ minX: 0, minY: 0, maxX: 20, maxY: 20 })
    const animation = viewportAnimations.at(-1)
    assert.ok(animation)
    assert.strictEqual(animation.scale, 1)

    viewport.destroy()
  },
)

test(
  'lake overlay draws from lakeMask rather than biome labels',
  viewportTests,
  async () => {
    const hostEl = {
      clientWidth: 400,
      clientHeight: 300,
      replaceChildren() {},
    }

    const { BIOMES } = await import('../core/biomeIds.js')
    const lakeMask = new Uint8Array(16)
    lakeMask[6] = 1
    const biomes = new Uint8Array(16).fill(BIOMES.GRASSLAND)

    const viewport = await createWorldBuilderMapViewport(
      hostEl,
      worldDocFixture({
        gridWidth: 4,
        gridHeight: 4,
        biomes,
        lakeMask,
        fields: { elevation: new Float32Array(16).fill(0.55) },
      }),
    )

    assert.deepStrictEqual(drawnRects, [{ x: 2, y: 1, w: 1, h: 1 }])

    viewport.destroy()
  },
)

test(
  'viewport init skips resource rasterization while overlays are hidden',
  viewportTests,
  async () => {
    const {
      getResourceRasterOverlayRgbaBuildCount,
      resetResourceRasterOverlayRgbaBuildCount,
    } = await import('./buildResourceRasterOverlayRgba.js')

    resetResourceRasterOverlayRgbaBuildCount()
    const hostEl = {
      clientWidth: 400,
      clientHeight: 300,
      replaceChildren() {},
    }
    const fixture = {
      ...createArableRasterFixture(),
      timberRaster: createTimberRasterFixture().timberRaster,
      metalsRaster: createMetalsFixture().metalsRaster,
    }
    const viewport = await createWorldBuilderMapViewport(hostEl, fixture)

    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 0)
    viewport.destroy()
  },
)

test(
  'setResourceOverlayVisibility rasterizes a resource layer at most once per toggle',
  viewportTests,
  async () => {
    const {
      getResourceRasterOverlayRgbaBuildCount,
      resetResourceRasterOverlayRgbaBuildCount,
    } = await import('./buildResourceRasterOverlayRgba.js')

    const hostEl = {
      clientWidth: 400,
      clientHeight: 300,
      replaceChildren() {},
    }
    const viewport = await createWorldBuilderMapViewport(hostEl, createTimberRasterFixture())

    resetResourceRasterOverlayRgbaBuildCount()
    viewport.setResourceOverlayVisibility('timber', true)
    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 1)

    resetResourceRasterOverlayRgbaBuildCount()
    viewport.setResourceOverlayVisibility('timber', false)
    assert.strictEqual(getResourceRasterOverlayRgbaBuildCount(), 0)

    viewport.destroy()
  },
)

test(
  'updateWorldDocument rasterizes each visible resource layer at most once',
  viewportTests,
  async () => {
    const {
      getResourceRasterOverlayRgbaBuildCount,
      resetResourceRasterOverlayRgbaBuildCount,
    } = await import('./buildResourceRasterOverlayRgba.js')

    const hostEl = {
      clientWidth: 400,
      clientHeight: 300,
      replaceChildren() {},
    }
    const fixture = {
      ...createArableRasterFixture(),
      timberRaster: createTimberRasterFixture().timberRaster,
      metalsRaster: createMetalsFixture().metalsRaster,
    }
    const viewport = await createWorldBuilderMapViewport(hostEl, fixture)

    viewport.setResourceOverlayVisibility('arable', true)
    viewport.setResourceOverlayVisibility('timber', true)
    viewport.setResourceOverlayVisibility('metals', true)

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
