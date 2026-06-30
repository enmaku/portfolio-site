import { mock } from 'node:test'
import { DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY } from '../resourceOverlays.js'

/**
 * Shared mock harness for {@link import('./createWorldBuilderMapViewport.js')} behavioral
 * tests. The real viewport drives PixiJS; tests record the spy state these stub classes
 * mutate (drawn markers, sprite layers, viewport framing calls) and assert on observable
 * rendering behavior rather than Pixi internals.
 *
 * @typedef {Object} ViewportSpyState
 * @property {Array<{ x: number, y: number, color: number | null }>} drawnCircles
 * @property {Array<{ visible: boolean, texture: unknown }>} spriteLayers
 * @property {Array<{ position: { x: number, y: number }, scale: number }>} viewportAnimations
 * @property {{ screenWidth: number, screenHeight: number, worldWidth: number, worldHeight: number } | null} lastViewportResize
 * @property {number} fitWorldCallCount
 * @property {number} moveCenterCallCount
 * @property {(() => void) | null} resizeObserverCallback
 * @property {{ scale: { x: number, y: number }, center: { x: number, y: number } } | null} lastViewportInstance
 */

/** @type {ViewportSpyState} */
export const viewportSpyState = {
  drawnCircles: [],
  spriteLayers: [],
  viewportAnimations: [],
  lastViewportResize: null,
  fitWorldCallCount: 0,
  moveCenterCallCount: 0,
  resizeObserverCallback: null,
  lastViewportInstance: null,
}

/** Skip viewport suites when the runtime lacks module mocking support. */
export const viewportTestOptions = { skip: !mock.module }

export function resetViewportSpyState() {
  viewportSpyState.drawnCircles = []
  viewportSpyState.spriteLayers = []
  viewportSpyState.viewportAnimations = []
  viewportSpyState.lastViewportResize = null
  viewportSpyState.fitWorldCallCount = 0
  viewportSpyState.moveCenterCallCount = 0
  viewportSpyState.resizeObserverCallback = null
  viewportSpyState.lastViewportInstance = null
}

/**
 * Install global DOM stubs and Pixi module mocks, then load a fresh viewport factory.
 *
 * @returns {Promise<typeof import('./createWorldBuilderMapViewport.js').createWorldBuilderMapViewport>}
 */
export async function installViewportMocks() {
  resetViewportSpyState()

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
    /** @param {() => void} callback */
    constructor(callback) {
      viewportSpyState.resizeObserverCallback = callback
    }
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
          viewportSpyState.spriteLayers.push(this)
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
          viewportSpyState.drawnCircles = []
        }
        circle(x, y) {
          viewportSpyState.drawnCircles.push({ x, y, color: null })
        }
        fill({ color } = {}) {
          const last = viewportSpyState.drawnCircles.at(-1)
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
          this.scale = { x: 1, y: 1 }
          this.center = { x: 0, y: 0 }
          viewportSpyState.lastViewportInstance = this
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
        resize(screenWidth, screenHeight, worldWidth, worldHeight) {
          this.worldWidth = worldWidth
          this.worldHeight = worldHeight
          viewportSpyState.lastViewportResize = {
            screenWidth,
            screenHeight,
            worldWidth,
            worldHeight,
          }
        }
        fitWorld() {
          viewportSpyState.fitWorldCallCount += 1
          this.scale = { x: 0.25, y: 0.25 }
        }
        moveCenter(x, y) {
          viewportSpyState.moveCenterCallCount += 1
          this.center = { x, y }
        }
        animate(options) {
          viewportSpyState.viewportAnimations.push(options)
        }
        destroy() {}
      },
    },
  })

  return (await import(`./createWorldBuilderMapViewport.js?test=${Date.now()}`))
    .createWorldBuilderMapViewport
}

export function uninstallViewportGlobals() {
  delete globalThis.document
  delete globalThis.ImageData
  delete globalThis.ResizeObserver
}

/**
 * @returns {{ clientWidth: number, clientHeight: number, replaceChildren: () => void }}
 */
export function createHostEl() {
  return {
    clientWidth: 400,
    clientHeight: 300,
    replaceChildren() {},
  }
}

/**
 * @param {Partial<import('../core/types.js').WorldDocument> & Pick<import('../core/types.js').WorldDocument, 'gridWidth' | 'gridHeight'>} partial
 * @returns {import('../core/types.js').WorldDocument}
 */
export function worldDocFixture(partial) {
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
 * @param {Partial<Record<string, boolean>>} [visibility]
 * @param {number} [arableMinimumProductivity]
 * @returns {import('../resourceOverlayState.js').ResourceOverlayPageState}
 */
export function overlayPageState(
  visibility = {},
  arableMinimumProductivity = DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
) {
  return {
    visibility: { arable: false, timber: false, metals: false, salt: false, ...visibility },
    displaySettings: { arableMinimumProductivity },
  }
}

/**
 * Owner-seam driver that mirrors page commits: every visibility/threshold change flows
 * through syncOverlayRenderCache with the full accumulated overlay state.
 *
 * @param {{ syncOverlayRenderCache: (state: import('../resourceOverlayState.js').ResourceOverlayPageState) => void }} viewport
 */
export function createOverlayOwnerDriver(viewport) {
  /** @type {Record<string, boolean>} */
  const visibility = { arable: false, timber: false, metals: false, salt: false }
  let arableMinimumProductivity = DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY

  function sync() {
    viewport.syncOverlayRenderCache(overlayPageState(visibility, arableMinimumProductivity))
  }

  return {
    /**
     * @param {string} resourceId
     * @param {boolean} visible
     */
    setVisibility(resourceId, visible) {
      visibility[resourceId] = visible
      sync()
    },
    /** @param {number} value */
    setArableMinimumProductivity(value) {
      arableMinimumProductivity = value
      sync()
    },
  }
}

/**
 * @returns {import('../core/types.js').WorldDocument}
 */
export function createSaltNodeFixture() {
  return worldDocFixture({
    gridWidth: 4,
    gridHeight: 4,
    saltNodes: [{ x: 1, y: 2 }],
  })
}

/**
 * @returns {import('../core/types.js').WorldDocument}
 */
export function createTimberRasterFixture() {
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
export function createArableRasterFixture() {
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
export function createMetalsFixture() {
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

/** Sprites from the most recently created viewport (seven raster layers). */
export function recentSpriteLayers() {
  return viewportSpyState.spriteLayers.slice(-7)
}

/** Contours sprite sits above terrain in the layer stack. */
export function contoursSpriteLayer() {
  return recentSpriteLayers()[1]
}

/** Arable sprite sits above contours in the layer stack. */
export function arableSpriteLayer() {
  return recentSpriteLayers()[2]
}

/** Timber sprite sits above arable in the layer stack. */
export function timberSpriteLayer() {
  return recentSpriteLayers()[3]
}

/** Metals sprite sits above timber in the layer stack. */
export function metalsSpriteLayer() {
  return recentSpriteLayers()[4]
}

/** Lakes sprite sits above resource raster overlays in the layer stack. */
export function lakesSpriteLayer() {
  return recentSpriteLayers()[5]
}

/** Rivers sprite sits above lakes in the layer stack. */
export function riversSpriteLayer() {
  return recentSpriteLayers()[6]
}
