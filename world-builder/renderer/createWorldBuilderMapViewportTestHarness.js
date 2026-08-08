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
 * @property {import('pixi.js').Graphics[]} graphicsLayers
 * @property {Array<{ visible: boolean, texture: unknown }>} spriteLayers
 * @property {Array<{ position: { x: number, y: number }, scale: number }>} viewportAnimations
 * @property {{ screenWidth: number, screenHeight: number, worldWidth: number, worldHeight: number } | null} lastViewportResize
 * @property {number} fitWorldCallCount
 * @property {number} moveCenterCallCount
 * @property {(() => void) | null} resizeObserverCallback
 * @property {{ scale: { x: number, y: number }, center: { x: number, y: number } } | null} lastViewportInstance
 * @property {Record<'coastalNodes' | 'metalNodes' | 'saltNodes' | 'settlementNodes', Array<{ x: number, y: number, color: number | null }>>} drawnCirclesByLayer
 * @property {Array<{ text: string, x: number, y: number, fill: number | null }>} drawnTexts
 * @property {Array<{ color: number | null, path: Array<{ x: number, y: number }> }>} drawnStrokes
 * @property {Array<{ color: number | null }>} drawnFills
 */

/** @type {ViewportSpyState} */
export const viewportSpyState = {
  drawnCircles: [],
  graphicsLayers: [],
  spriteLayers: [],
  viewportAnimations: [],
  lastViewportResize: null,
  fitWorldCallCount: 0,
  moveCenterCallCount: 0,
  resizeObserverCallback: null,
  lastViewportInstance: null,
  drawnCirclesByLayer: {
    coastalNodes: [],
    metalNodes: [],
    saltNodes: [],
    settlementNodes: [],
  },
  drawnTexts: [],
  drawnStrokes: [],
  drawnFills: [],
}

/** Skip viewport suites when the runtime lacks module mocking support. */
export const viewportTestOptions = { skip: !mock.module }

export function resetViewportSpyState() {
  viewportSpyState.drawnCircles = []
  viewportSpyState.graphicsLayers = []
  viewportSpyState.spriteLayers = []
  viewportSpyState.viewportAnimations = []
  viewportSpyState.lastViewportResize = null
  viewportSpyState.fitWorldCallCount = 0
  viewportSpyState.moveCenterCallCount = 0
  viewportSpyState.resizeObserverCallback = null
  viewportSpyState.lastViewportInstance = null
  viewportSpyState.drawnCirclesByLayer = {
    coastalNodes: [],
    metalNodes: [],
    saltNodes: [],
    settlementNodes: [],
  }
  viewportSpyState.drawnTexts = []
  viewportSpyState.drawnStrokes = []
  viewportSpyState.drawnFills = []
}

/** Vector overlay Graphics are always created coastal → metal → salt → settlement per viewport. */
const VECTOR_LAYER_IDS = /** @type {const} */ ([
  'coastalNodes',
  'metalNodes',
  'saltNodes',
  'settlementNodes',
])

/** Landing-placement overlays appended after vector layers: haul shed, landing pin, focus pin. */
const LANDING_PLACEMENT_GRAPHICS_COUNT = 3

/** Crossed-swords conquest cue Graphics sits after settlement pins. */
const RECENT_CONQUEST_GRAPHICS_COUNT = 1

function syncDrawnCirclesByLayer() {
  const trailingNonVector = RECENT_CONQUEST_GRAPHICS_COUNT + LANDING_PLACEMENT_GRAPHICS_COUNT
  const vectorLayers = viewportSpyState.graphicsLayers.slice(
    -(VECTOR_LAYER_IDS.length + trailingNonVector),
    -trailingNonVector,
  )
  for (let i = 0; i < VECTOR_LAYER_IDS.length; i += 1) {
    viewportSpyState.drawnCirclesByLayer[VECTOR_LAYER_IDS[i]] = vectorLayers[i]?.circles ?? []
  }
}

/**
 * Install global DOM stubs and Pixi module mocks, then load a fresh viewport factory.
 *
 * @returns {Promise<typeof import('./createWorldBuilderMapViewport.js').createWorldBuilderMapViewport>}
 */
export async function installViewportMocks() {
  resetViewportSpyState()

  globalThis.ImageData = class {
    /**
     * @param {Uint8ClampedArray | number} dataOrWidth
     * @param {number} [width]
     * @param {number} [height]
     */
    constructor(dataOrWidth, width, height) {
      if (typeof dataOrWidth === 'number') {
        this.width = dataOrWidth
        this.height = width ?? 0
        this.data = new Uint8ClampedArray(this.width * this.height * 4)
        return
      }
      this.data = dataOrWidth
      this.width = width ?? 0
      this.height = height ?? 0
    }
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
          // Stub enough Canvas2D for terrain/contour/raster overlay builders under Node.
          return {
            strokeStyle: '',
            fillStyle: '',
            lineWidth: 1,
            lineCap: 'butt',
            lineJoin: 'miter',
            globalAlpha: 1,
            putImageData() {},
            getImageData(x, y, w, h) {
              return new ImageData(w, h)
            },
            beginPath() {},
            closePath() {},
            moveTo() {},
            lineTo() {},
            stroke() {},
            fill() {},
            clearRect() {},
            fillRect() {},
            strokeRect() {},
            drawImage() {},
            save() {},
            restore() {},
            translate() {},
            scale() {},
            setLineDash() {},
            arc() {},
            clip() {},
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
          this.canvas = {
            tagName: 'CANVAS',
            toBlob(callback, type) {
              callback(new Blob(['png'], { type: type || 'image/png' }))
            },
          }
          this.stage = { addChild() {} }
          this.renderer = {
            events: {},
            render() {},
            resize() {},
          }
          this.resizeTo = null
          this.ticker = {
            elapsedMS: 16,
            start() {},
            stop() {},
            add() {},
          }
        }
        async init(options = {}) {
          this.resizeTo = options.resizeTo ?? null
        }
        resize() {}
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
        constructor() {
          /** @type {Array<{ x: number, y: number, color: number | null }>} */
          this.circles = []
          /** @type {Array<{ color: number | null, path: Array<{ x: number, y: number }> }>} */
          this.strokes = []
          /** @type {Array<{ color: number | null }>} */
          this.fills = []
          /** @type {Array<{ x: number, y: number }>} */
          this._path = []
          /** @type {unknown} */
          this._activePath = null
          viewportSpyState.graphicsLayers.push(this)
        }
        syncDrawnCircles() {
          viewportSpyState.drawnCircles = viewportSpyState.graphicsLayers.flatMap(
            (layer) => layer.circles,
          )
          syncDrawnCirclesByLayer()
        }
        clear() {
          this.circles = []
          this.strokes = []
          this.fills = []
          this._path = []
          this._activePath = null
          this.syncDrawnCircles()
          this.syncDrawnStrokes()
          this.syncDrawnFills()
        }
        circle(x, y) {
          this.circles.push({ x, y, color: null })
          this.syncDrawnCircles()
        }
        fill({ color } = {}) {
          const last = this.circles.at(-1)
          if (last) {
            last.color = color
            this.syncDrawnCircles()
          }
          if (this._activePath) {
            this.fills.push({ color: typeof color === 'number' ? color : null })
            this.syncDrawnFills()
          }
        }
        rect() {}
        moveTo(x, y) {
          this._path = [{ x, y }]
        }
        lineTo(x, y) {
          if (!this._path) this._path = []
          this._path.push({ x, y })
        }
        save() {}
        restore() {}
        setTransform() {}
        path(path) {
          this._activePath = path
        }
        stroke({ color } = {}) {
          if (!this.strokes) this.strokes = []
          this.strokes.push({
            color: typeof color === 'number' ? color : null,
            path: this._path ? [...this._path] : [],
          })
          this._path = []
          this.syncDrawnStrokes()
        }
        syncDrawnStrokes() {
          viewportSpyState.drawnStrokes = viewportSpyState.graphicsLayers.flatMap(
            (layer) => layer.strokes ?? [],
          )
        }
        syncDrawnFills() {
          viewportSpyState.drawnFills = viewportSpyState.graphicsLayers.flatMap(
            (layer) => layer.fills ?? [],
          )
        }
        setFillStyle() {}
      },
      GraphicsPath: class {
        /**
         * @param {string} d
         */
        constructor(d) {
          this.d = d
        }
      },
      Container: class {
        constructor() {
          /** @type {unknown[]} */
          this.children = []
        }
        addChild(child) {
          this.children.push(child)
          return child
        }
        removeChildren() {
          const removed = this.children
          this.children = []
          viewportSpyState.drawnTexts = []
          return removed
        }
      },
      Text: class {
        /**
         * @param {{ text?: string, style?: { fill?: number } }} [options]
         */
        constructor(options = {}) {
          this.text = options.text ?? ''
          this.style = options.style ?? {}
          this.x = 0
          this.y = 0
          this.anchor = { set() {} }
          viewportSpyState.drawnTexts.push({
            text: this.text,
            x: 0,
            y: 0,
            fill: typeof this.style.fill === 'number' ? this.style.fill : null,
          })
          const record = viewportSpyState.drawnTexts.at(-1)
          Object.defineProperty(this, 'x', {
            get() {
              return record.x
            },
            set(value) {
              record.x = value
            },
          })
          Object.defineProperty(this, 'y', {
            get() {
              return record.y
            },
            set(value) {
              record.y = value
            },
          })
        }
        destroy() {}
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
        on() {
          return this
        }
        update() {}
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
    style: { cursor: '' },
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
export function createSettlementFixture() {
  return worldDocFixture({
    gridWidth: 4,
    gridHeight: 4,
    settlements: [{ id: 's1', x: 1, y: 2, population: 100, mapNumber: 1 }],
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
export function createCoastalNodesFixture() {
  return worldDocFixture({
    gridWidth: 4,
    gridHeight: 4,
    coastalNodes: [{ id: 'mouth-0', x: 1, y: 1, kind: 'mouth' }],
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
    metalNodes: [{ id: 'metal-0', x: 2, y: 1, score: 0.9, kind: 'copper' }],
  })
}

/**
 * Sprites from the most recently created viewport.
 * Order: terrain, contours, arable, timber, metals, lakes, rivers, sail,
 * freshwater, population, explorationFog, wealth, portTolls, factionTax, commodityPrice*,
 * factionTerritory, loyalty, routes.
 * Full child stack inserts coastal/metal/salt node layers before routes;
 * settlement pins stay above routes.
 */
export function recentSpriteLayers() {
  return viewportSpyState.spriteLayers.slice(-15)
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

/** Sail sprite sits above rivers so the pink overlay stays visible on water. */
export function sailSpriteLayer() {
  return recentSpriteLayers()[7]
}

/**
 * Per-vector-layer circle records from the most recently created viewport.
 *
 * @returns {ViewportSpyState['drawnCirclesByLayer']}
 */
export function drawnCirclesByLayer() {
  syncDrawnCirclesByLayer()
  return viewportSpyState.drawnCirclesByLayer
}
