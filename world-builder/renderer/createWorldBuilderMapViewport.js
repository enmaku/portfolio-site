import { buildLandTerrainRgba } from './buildLandTerrainRgba.js'
import { buildLakeOverlayCanvas } from './buildLakeOverlayCanvas.js'
import { buildRiverOverlayCanvas } from './buildRiverOverlayCanvas.js'
import { buildTopographyContourCanvas } from './buildTopographyContourCanvas.js'
import {
  createDefaultResourceOverlayVisibility,
  DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
} from '../resourceOverlays.js'
import {
  refreshResourceRasterOverlayCanvas,
  RESOURCE_RASTER_OVERLAY_LAYER_IDS,
} from './resourceRasterOverlayRefresh.js'
import { createMapLayerRefreshRunner } from './mapLayerRefresh.js'
import { diffResourceOverlayMapLayers } from './diffResourceOverlayMapLayers.js'
import {
  computeRegionFocusScale,
  resolveMetalsOverlayDrawn,
  resolveSaltNodeOverlayDrawn,
} from './worldBuilderMapViewportModel.js'

/** Black for discrete metal mine markers (matches metals raster hue). */
export const METAL_NODE_OVERLAY_COLOR = 0x000000

/** Pure white for salt strategic-resource markers. */
export const SALT_NODE_OVERLAY_COLOR = 0xffffff

/** Grid-cell radius for metal/salt strategic-resource node markers. */
export const STRATEGIC_RESOURCE_NODE_MARKER_RADIUS = 7

/**
 * @typedef {Object} UpdateWorldDocumentOptions
 * @property {Iterable<import('./mapLayerRefresh.js').MapLayerId> | null} [changedLayers] omit for full rebuild
 */

/**
 * @param {HTMLElement} hostEl
 * @param {import('../core/types.js').WorldDocument} worldDocument
 */
export async function createWorldBuilderMapViewport(hostEl, worldDocument) {
  const { Application, Sprite, Texture, Graphics } = await import('pixi.js')
  const { Viewport } = await import('pixi-viewport')

  const app = new Application()
  await app.init({
    background: '#0d1117',
    resizeTo: hostEl,
    antialias: true,
  })
  hostEl.replaceChildren(app.canvas)

  const { gridWidth, gridHeight } = worldDocument
  let terrainCanvas = buildTerrainCanvas(worldDocument)
  let terrainTexture = Texture.from(terrainCanvas)
  const terrain = new Sprite(terrainTexture)
  const contours = new Sprite(Texture.EMPTY)
  contours.visible = false
  let contourTexture = null
  const arable = new Sprite(Texture.EMPTY)
  arable.visible = false
  const timber = new Sprite(Texture.EMPTY)
  timber.visible = false
  const metals = new Sprite(Texture.EMPTY)
  metals.visible = false
  const lakes = new Sprite(Texture.EMPTY)
  lakes.visible = false
  let lakeTexture = null
  const rivers = new Sprite(Texture.EMPTY)
  rivers.visible = false
  let riverTexture = null
  const overlay = new Graphics()
  let resourceOverlayVisibility = createDefaultResourceOverlayVisibility()
  let arableMinimumProductivity = DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY
  /**
   * Last overlay state projected into the render cache; diffed against incoming
   * commits so only layers whose visible output changed are refreshed.
   *
   * @type {import('../resourceOverlayState.js').ResourceOverlayPageState}
   */
  let renderedOverlayState = {
    visibility: resourceOverlayVisibility,
    displaySettings: { arableMinimumProductivity },
  }
  /** @type {import('../core/types.js').WorldDocument} */
  let currentWorldDocument = worldDocument
  /** @type {{ elevationTint?: boolean }} */
  let terrainBuildOptions = {}

  /** @type {Record<import('./resourceRasterOverlayRefresh.js').ResourceRasterOverlayLayerId, import('pixi.js').Texture | null>} */
  const resourceRasterTextures = {
    arable: null,
    timber: null,
    metals: null,
  }

  /** @type {Record<import('./resourceRasterOverlayRefresh.js').ResourceRasterOverlayLayerId, import('pixi.js').Sprite>} */
  const resourceRasterSprites = {
    arable,
    timber,
    metals,
  }

  const viewport = new Viewport({
    screenWidth: hostEl.clientWidth || gridWidth,
    screenHeight: hostEl.clientHeight || gridHeight,
    worldWidth: gridWidth,
    worldHeight: gridHeight,
    events: app.renderer.events,
  })

  app.stage.addChild(viewport)
  viewport.addChild(terrain)
  viewport.addChild(contours)
  viewport.addChild(arable)
  viewport.addChild(timber)
  viewport.addChild(metals)
  viewport.addChild(lakes)
  viewport.addChild(rivers)
  viewport.addChild(overlay)
  viewport
    .drag()
    .pinch()
    .wheel({ smooth: 3 })
    .decelerate()
    .clampZoom({ maxScale: 24 })

  syncViewportToHost(viewport, hostEl, gridWidth, gridHeight)
  fitMapToView(viewport, gridWidth, gridHeight)

  const resizeObserver = new ResizeObserver(() => {
    syncViewportToHost(viewport, hostEl, viewport.worldWidth, viewport.worldHeight)
  })
  resizeObserver.observe(hostEl)

  /** @type {ReturnType<typeof setInterval> | null} */
  let replayTimer = null

  /**
   * @param {import('./mapLayerRefresh.js').MapLayerId} layerId
   */
  function hideMapLayer(layerId) {
    switch (layerId) {
      case 'terrain':
        break
      case 'contours':
        contours.visible = false
        break
      case 'arable':
        arable.visible = false
        break
      case 'timber':
        timber.visible = false
        break
      case 'metals':
        metals.visible = false
        break
      case 'rivers':
        rivers.visible = false
        break
      case 'lakes':
        lakes.visible = false
        break
      case 'vectorOverlays':
        overlay.clear()
        break
      default:
        break
    }
  }

  const mapLayerRefresh = createMapLayerRefreshRunner(
    {
      terrain: refreshTerrain,
      contours: () => refreshContours(currentWorldDocument),
      arable: () => refreshResourceRasterOverlay('arable', currentWorldDocument),
      timber: () => refreshResourceRasterOverlay('timber', currentWorldDocument),
      metals: () => refreshResourceRasterOverlay('metals', currentWorldDocument),
      rivers: () => refreshRiverOverlay(currentWorldDocument),
      lakes: () => refreshLakeOverlay(currentWorldDocument),
      vectorOverlays: () =>
        drawVectorOverlays(overlay, currentWorldDocument, resourceOverlayVisibility),
    },
    { hideLayer: hideMapLayer },
  )

  mapLayerRefresh.refresh()

  /**
   * @param {Iterable<import('./mapLayerRefresh.js').MapLayerId> | null | undefined} changedLayers
   * @param {import('./mapLayerRefresh.js').MapLayerRefreshOptions} [options]
   */
  function refreshMapLayers(changedLayers, options) {
    mapLayerRefresh.refresh(changedLayers, options)
  }

  function refreshTerrain() {
    terrainTexture.destroy(true)
    terrainCanvas = buildTerrainCanvas(currentWorldDocument, terrainBuildOptions)
    terrainTexture = Texture.from(terrainCanvas)
    terrain.texture = terrainTexture
  }

  /**
   * @param {import('../core/types.js').WorldDocument} doc
   */
  function refreshContours(doc) {
    const nextCanvas = buildTopographyContourCanvas(doc)
    contourTexture?.destroy(true)
    contourTexture = null

    if (!nextCanvas) {
      contours.visible = false
      contours.texture = Texture.EMPTY
      return
    }

    contourTexture = Texture.from(nextCanvas)
    contours.texture = contourTexture
    contours.visible = true
  }

  /**
   * @param {import('./resourceRasterOverlayRefresh.js').ResourceRasterOverlayLayerId} resourceId
   * @param {import('../core/types.js').WorldDocument} doc
   */
  function refreshResourceRasterOverlay(resourceId, doc) {
    const sprite = resourceRasterSprites[resourceId]
    resourceRasterTextures[resourceId]?.destroy(true)
    resourceRasterTextures[resourceId] = null

    const nextCanvas = refreshResourceRasterOverlayCanvas(resourceId, {
      worldDocument: doc,
      visibility: resourceOverlayVisibility,
      arableMinimumProductivity,
    })
    if (!nextCanvas) {
      sprite.visible = false
      sprite.texture = Texture.EMPTY
      return
    }

    const nextTexture = Texture.from(nextCanvas)
    resourceRasterTextures[resourceId] = nextTexture
    sprite.texture = nextTexture
    sprite.visible = true
  }

  /**
   * @param {import('../core/types.js').WorldDocument} doc
   */
  function refreshRiverOverlay(doc) {
    const nextCanvas = buildRiverOverlayCanvas(doc)
    riverTexture?.destroy(true)
    riverTexture = null

    if (!nextCanvas) {
      rivers.visible = false
      rivers.texture = Texture.EMPTY
      return
    }

    riverTexture = Texture.from(nextCanvas)
    rivers.texture = riverTexture
    rivers.visible = true
  }

  /**
   * @param {import('../core/types.js').WorldDocument} doc
   */
  function refreshLakeOverlay(doc) {
    const nextCanvas = buildLakeOverlayCanvas(doc.lakeMask, doc.gridWidth, doc.gridHeight)
    lakeTexture?.destroy(true)
    lakeTexture = null

    if (!nextCanvas) {
      lakes.visible = false
      lakes.texture = Texture.EMPTY
      return
    }

    lakeTexture = Texture.from(nextCanvas)
    lakes.texture = lakeTexture
    lakes.visible = true
  }

  return {
    /**
     * @param {import('../core/types.js').WorldDocument} nextDocument
     * @param {UpdateWorldDocumentOptions} [options]
     */
    updateWorldDocument(nextDocument, options = {}) {
      stopReplay()
      terrainBuildOptions = {}
      const dimensionsChanged =
        nextDocument.gridWidth !== currentWorldDocument.gridWidth ||
        nextDocument.gridHeight !== currentWorldDocument.gridHeight
      currentWorldDocument = nextDocument
      refreshMapLayers(options.changedLayers)
      if (dimensionsChanged) {
        syncViewportToHost(viewport, hostEl, nextDocument.gridWidth, nextDocument.gridHeight)
      }
    },

    fitToWorld() {
      const { gridWidth, gridHeight } = currentWorldDocument
      fitMapToView(viewport, gridWidth, gridHeight)
    },

    /** @param {import('../core/types.js').MapFocus} mapFocus */
    focusOn(mapFocus) {
      const { gridWidth: worldWidth } = currentWorldDocument
      if ('minX' in mapFocus) {
        const cx = (mapFocus.minX + mapFocus.maxX) / 2
        const cy = (mapFocus.minY + mapFocus.maxY) / 2
        const scale = computeRegionFocusScale(worldWidth, mapFocus)
        viewport.animate({
          time: 400,
          position: { x: cx, y: cy },
          scale,
        })
        return
      }

      const scale = mapFocus.zoom ?? 4
      viewport.animate({
        time: 400,
        position: { x: mapFocus.x, y: mapFocus.y },
        scale,
      })
    },

    /**
     * @param {Float32Array[]} snapshots
     * @param {import('../core/types.js').WorldDocument} baseDocument
     * @param {(index: number) => void} [onFrame]
     */
    playErosionSnapshots(snapshots, baseDocument, onFrame) {
      stopReplay()
      if (snapshots.length === 0) return

      let frame = 0
      replayTimer = setInterval(() => {
        const snapshot = snapshots[frame]
        currentWorldDocument = {
          ...baseDocument,
          fields: { ...baseDocument.fields, elevation: snapshot },
        }
        terrainBuildOptions = { elevationTint: true }
        refreshMapLayers(['terrain', 'contours'], { hideUnrefreshedLayers: true })
        onFrame?.(frame)
        frame += 1
        if (frame >= snapshots.length) {
          stopReplay()
          currentWorldDocument = baseDocument
          terrainBuildOptions = {}
          refreshMapLayers()
        }
      }, 120)
    },

    /**
     * Single owner seam: project overlay owner state into the viewport render cache,
     * refreshing only the layers whose visible output actually changed since the last
     * commit. The owner composable is the sole page-facing mutator for overlay display.
     *
     * @param {import('../resourceOverlayState.js').ResourceOverlayPageState} overlayState
     */
    syncOverlayRenderCache(overlayState) {
      /** @type {import('../resourceOverlayState.js').ResourceOverlayPageState} */
      const nextOverlayState = {
        visibility: {
          ...createDefaultResourceOverlayVisibility(),
          ...overlayState.visibility,
        },
        displaySettings: {
          arableMinimumProductivity: Math.max(
            0,
            Math.min(1, overlayState.displaySettings.arableMinimumProductivity),
          ),
        },
      }

      const changedLayers = diffResourceOverlayMapLayers(renderedOverlayState, nextOverlayState)
      renderedOverlayState = nextOverlayState
      resourceOverlayVisibility = nextOverlayState.visibility
      arableMinimumProductivity = nextOverlayState.displaySettings.arableMinimumProductivity
      refreshMapLayers(changedLayers)
    },

    destroy() {
      stopReplay()
      resizeObserver.disconnect()
      terrainTexture.destroy(true)
      contourTexture?.destroy(true)
      lakeTexture?.destroy(true)
      riverTexture?.destroy(true)
      for (const resourceId of RESOURCE_RASTER_OVERLAY_LAYER_IDS) {
        resourceRasterTextures[resourceId]?.destroy(true)
      }
      viewport.destroy({ children: true })
      app.destroy(true, { children: true, texture: true })
    },
  }

  function stopReplay() {
    if (replayTimer) {
      clearInterval(replayTimer)
      replayTimer = null
    }
  }
}

/** @param {import('pixi-viewport').Viewport} viewport */
function fitMapToView(viewport, worldWidth, worldHeight) {
  viewport.fitWorld(false)
  viewport.moveCenter(worldWidth / 2, worldHeight / 2)
}

/**
 * @param {import('pixi-viewport').Viewport} viewport
 * @param {HTMLElement} hostEl
 * @param {number} worldWidth
 * @param {number} worldHeight
 */
function syncViewportToHost(viewport, hostEl, worldWidth, worldHeight) {
  viewport.resize(
    Math.max(1, hostEl.clientWidth),
    Math.max(1, hostEl.clientHeight),
    worldWidth,
    worldHeight,
  )
}

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {{ elevationTint?: boolean }=} options
 */
function buildTerrainCanvas(worldDocument, options = {}) {
  const { gridWidth, gridHeight } = worldDocument
  const rgba = options.elevationTint
    ? elevationToGrayscaleRgba(worldDocument.fields.elevation)
    : buildLandTerrainRgba(worldDocument)
  const canvas = document.createElement('canvas')
  canvas.width = gridWidth
  canvas.height = gridHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context for terrain texture')
  }
  ctx.putImageData(new ImageData(rgba, gridWidth, gridHeight), 0, 0)
  return canvas
}

/**
 * @param {Float32Array} elevation
 */
function elevationToGrayscaleRgba(elevation) {
  const rgba = new Uint8ClampedArray(elevation.length * 4)
  for (let i = 0; i < elevation.length; i += 1) {
    const value = Math.max(0, Math.min(255, Math.round(elevation[i] * 255)))
    const offset = i * 4
    rgba[offset] = value
    rgba[offset + 1] = value
    rgba[offset + 2] = value
    rgba[offset + 3] = 255
  }
  return rgba
}

/**
 * @param {import('pixi.js').Graphics} overlay
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {Record<string, boolean>} resourceOverlayVisibility
 */
function drawVectorOverlays(overlay, worldDocument, resourceOverlayVisibility) {
  overlay.clear()

  if (worldDocument.coastalNodes?.length) {
    for (const node of worldDocument.coastalNodes) {
      const color = coastalNodeColor(node.kind)
      overlay.circle(node.x + 0.5, node.y + 0.5, 2)
      overlay.fill({ color, alpha: 0.85 })
    }
  }

  if (resolveMetalsOverlayDrawn(resourceOverlayVisibility, worldDocument).nodesVisible) {
    for (const node of worldDocument.metalNodes) {
      overlay.circle(node.x + 0.5, node.y + 0.5, STRATEGIC_RESOURCE_NODE_MARKER_RADIUS)
      overlay.fill({ color: METAL_NODE_OVERLAY_COLOR, alpha: 0.9 })
    }
  }

  if (resolveSaltNodeOverlayDrawn(resourceOverlayVisibility, worldDocument)) {
    for (const node of worldDocument.saltNodes) {
      overlay.circle(node.x + 0.5, node.y + 0.5, STRATEGIC_RESOURCE_NODE_MARKER_RADIUS)
      overlay.fill({ color: SALT_NODE_OVERLAY_COLOR, alpha: 0.9 })
    }
  }
}

/** @param {import('../core/types.js').CoastalNodeKind} kind */
function coastalNodeColor(kind) {
  switch (kind) {
    case 'mouth':
      return 0x4fc3f7
    case 'strait':
      return 0xffb74d
    case 'anchorage':
      return 0x81c784
    case 'extraction':
      return 0xce93d8
    default:
      return 0xffffff
  }
}
