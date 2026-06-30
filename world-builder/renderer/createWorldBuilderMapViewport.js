import { buildLandTerrainRgba } from './buildLandTerrainRgba.js'
import { buildRiverOverlayCanvas } from './buildRiverOverlayCanvas.js'
import { buildTopographyContourCanvas } from './buildTopographyContourCanvas.js'
import {
  applyResourceOverlayVisibility,
  createDefaultResourceOverlayVisibility,
  DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY,
} from '../resourceOverlays.js'
import {
  isResourceRasterOverlayLayerId,
  refreshResourceRasterOverlayCanvas,
  RESOURCE_RASTER_OVERLAY_LAYER_IDS,
} from './resourceRasterOverlayRefresh.js'
import {
  collectLakeOverlayRects,
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
  const rivers = new Sprite(Texture.EMPTY)
  rivers.visible = false
  let riverTexture = null
  const overlay = new Graphics()
  let resourceOverlayVisibility = createDefaultResourceOverlayVisibility()
  let arableMinimumProductivity = DEFAULT_ARABLE_OVERLAY_MINIMUM_PRODUCTIVITY
  /** @type {import('../core/types.js').WorldDocument} */
  let currentWorldDocument = worldDocument

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
    fitMapToView(viewport, viewport.worldWidth, viewport.worldHeight)
  })
  resizeObserver.observe(hostEl)
  refreshContours(worldDocument)
  refreshAllResourceRasterOverlays(worldDocument)
  refreshRiverOverlay(worldDocument)
  drawOverlays(overlay, worldDocument, resourceOverlayVisibility)

  /** @type {ReturnType<typeof setInterval> | null} */
  let replayTimer = null

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
   * @param {import('../core/types.js').WorldDocument} doc
   */
  function refreshAllResourceRasterOverlays(doc) {
    for (const resourceId of RESOURCE_RASTER_OVERLAY_LAYER_IDS) {
      refreshResourceRasterOverlay(resourceId, doc)
    }
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

  return {
    /** @param {import('../core/types.js').WorldDocument} nextDocument */
    updateWorldDocument(nextDocument) {
      stopReplay()
      currentWorldDocument = nextDocument
      terrainTexture.destroy(true)
      terrainCanvas = buildTerrainCanvas(nextDocument)
      terrainTexture = Texture.from(terrainCanvas)
      terrain.texture = terrainTexture
      refreshContours(nextDocument)
      refreshAllResourceRasterOverlays(nextDocument)
      refreshRiverOverlay(nextDocument)
      drawOverlays(overlay, nextDocument, resourceOverlayVisibility)
      syncViewportToHost(viewport, hostEl, nextDocument.gridWidth, nextDocument.gridHeight)
      fitMapToView(viewport, nextDocument.gridWidth, nextDocument.gridHeight)
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
        const replayDoc = {
          ...baseDocument,
          fields: { ...baseDocument.fields, elevation: snapshot },
        }
        terrainTexture.destroy(true)
        terrainCanvas = buildTerrainCanvas(replayDoc, { elevationTint: true })
        terrainTexture = Texture.from(terrainCanvas)
        terrain.texture = terrainTexture
        refreshContours(replayDoc)
        rivers.visible = false
        arable.visible = false
        timber.visible = false
        metals.visible = false
        overlay.clear()
        onFrame?.(frame)
        frame += 1
        if (frame >= snapshots.length) {
          stopReplay()
          terrainTexture.destroy(true)
          terrainCanvas = buildTerrainCanvas(baseDocument)
          terrainTexture = Texture.from(terrainCanvas)
          terrain.texture = terrainTexture
          refreshContours(baseDocument)
          refreshAllResourceRasterOverlays(baseDocument)
          refreshRiverOverlay(baseDocument)
          drawOverlays(overlay, baseDocument, resourceOverlayVisibility)
        }
      }, 120)
    },

    /**
     * @param {string} resourceId
     * @param {boolean} visible
     */
    setResourceOverlayVisibility(resourceId, visible) {
      resourceOverlayVisibility = applyResourceOverlayVisibility(
        resourceOverlayVisibility,
        resourceId,
        visible,
      )
      if (isResourceRasterOverlayLayerId(resourceId)) {
        refreshResourceRasterOverlay(resourceId, currentWorldDocument)
      }
      drawOverlays(overlay, currentWorldDocument, resourceOverlayVisibility)
    },

    /** @param {number} minimumProductivity */
    setArableOverlayMinimumProductivity(minimumProductivity) {
      arableMinimumProductivity = Math.max(0, Math.min(1, minimumProductivity))
      refreshResourceRasterOverlay('arable', currentWorldDocument)
    },

    destroy() {
      stopReplay()
      resizeObserver.disconnect()
      terrainTexture.destroy(true)
      contourTexture?.destroy(true)
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
function drawOverlays(overlay, worldDocument, resourceOverlayVisibility) {
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

  if (worldDocument.lakeMask) {
    for (const { x, y, w, h } of collectLakeOverlayRects(
      worldDocument.lakeMask,
      worldDocument.gridWidth,
    )) {
      overlay.rect(x, y, w, h)
      overlay.fill({ color: 0x3a8fd9, alpha: 0.25 })
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
