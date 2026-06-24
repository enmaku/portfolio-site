import assert from 'node:assert/strict'
import { after, before, mock, test } from 'node:test'

/** @type {Array<{ x: number, y: number, color: number }>} */
let drawnCircles = []

/** @type {Array<{ visible: boolean, texture: unknown }>} */
let spriteLayers = []

/** @type {typeof import('./createWorldBuilderMapViewport.js')} */
let createWorldBuilderMapViewport

const viewportTests = { skip: !mock.module }

before(async () => {
  if (!mock.module) return

  drawnCircles = []
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
        }
        circle(x, y) {
          drawnCircles.push({ x, y, color: null })
        }
        fill({ color } = {}) {
          const last = drawnCircles.at(-1)
          if (last) last.color = color
        }
        rect() {}
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
        }
        fitWorld() {}
        moveCenter() {}
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
 * @returns {import('../core/types.js').WorldDocument}
 */
function createSaltNodeFixture() {
  return {
    gridWidth: 4,
    gridHeight: 4,
    biomes: new Uint8Array(16),
    fields: {
      elevation: new Float32Array(16),
    },
    saltNodes: [{ x: 1, y: 2 }],
  }
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
  return {
    gridWidth: 4,
    gridHeight: 4,
    biomes: new Uint8Array(16),
    fields: {
      elevation: new Float32Array(16),
    },
    timberRaster,
  }
}

/**
 * @returns {import('../core/types.js').WorldDocument}
 */
function createArableRasterFixture() {
  const arableRaster = new Float32Array(16)
  arableRaster[5] = 0.75
  return {
    gridWidth: 4,
    gridHeight: 4,
    biomes: new Uint8Array(16),
    fields: {
      elevation: new Float32Array(16).fill(0.55),
    },
    arableRaster,
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
    biomes: new Uint8Array(16),
    fields: {
      elevation: new Float32Array(16).fill(0.7),
    },
    metalsRaster,
    metalNodes: [{ id: 'metal-0', x: 2, y: 1, score: 0.9 }],
  }
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

    const { SALT_NODE_OVERLAY_COLOR } = await import('./createWorldBuilderMapViewport.js')
    const viewport = await createWorldBuilderMapViewport(hostEl, createSaltNodeFixture())

    assert.strictEqual(
      drawnCircles.some((circle) => circle.color === SALT_NODE_OVERLAY_COLOR),
      false,
    )

    viewport.setResourceOverlayVisibility('salt', true)
    assert.strictEqual(
      drawnCircles.some((circle) => circle.color === SALT_NODE_OVERLAY_COLOR),
      true,
    )

    viewport.setResourceOverlayVisibility('salt', false)
    assert.strictEqual(
      drawnCircles.some((circle) => circle.color === SALT_NODE_OVERLAY_COLOR),
      false,
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

    const viewport = await createWorldBuilderMapViewport(hostEl, createArableRasterFixture())

    assert.strictEqual(arableSpriteLayer().visible, false)

    viewport.setResourceOverlayVisibility('arable', true)
    assert.strictEqual(arableSpriteLayer().visible, true)

    viewport.setResourceOverlayVisibility('arable', false)
    assert.strictEqual(arableSpriteLayer().visible, false)

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

    const viewport = await createWorldBuilderMapViewport(hostEl, createArableRasterFixture())
    viewport.setResourceOverlayVisibility('arable', true)
    assert.strictEqual(arableSpriteLayer().visible, true)

    viewport.setArableOverlayMinimumProductivity(0.9)
    assert.strictEqual(arableSpriteLayer().visible, false)

    viewport.setArableOverlayMinimumProductivity(0)
    assert.strictEqual(arableSpriteLayer().visible, true)

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

    const viewport = await createWorldBuilderMapViewport(hostEl, createTimberRasterFixture())

    assert.strictEqual(timberSpriteLayer().visible, false)

    viewport.setResourceOverlayVisibility('timber', true)
    assert.strictEqual(timberSpriteLayer().visible, true)

    viewport.setResourceOverlayVisibility('timber', false)
    assert.strictEqual(timberSpriteLayer().visible, false)

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

    const { METAL_NODE_OVERLAY_COLOR } = await import('./createWorldBuilderMapViewport.js')
    const viewport = await createWorldBuilderMapViewport(hostEl, createMetalsFixture())

    assert.strictEqual(metalsSpriteLayer().visible, false)
    assert.strictEqual(
      drawnCircles.some((circle) => circle.color === METAL_NODE_OVERLAY_COLOR),
      false,
    )

    viewport.setResourceOverlayVisibility('metals', true)
    assert.strictEqual(metalsSpriteLayer().visible, true)
    assert.strictEqual(
      drawnCircles.some((circle) => circle.color === METAL_NODE_OVERLAY_COLOR),
      true,
    )

    viewport.setResourceOverlayVisibility('metals', false)
    assert.strictEqual(metalsSpriteLayer().visible, false)
    assert.strictEqual(
      drawnCircles.some((circle) => circle.color === METAL_NODE_OVERLAY_COLOR),
      false,
    )

    viewport.destroy()
  },
)
