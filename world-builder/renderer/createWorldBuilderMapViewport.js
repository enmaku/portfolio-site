import { BIOMES } from '../core/biomeIds.js'
import { buildLandTerrainRgba } from './buildLandTerrainRgba.js'
import { buildRiverOverlayCanvas } from './buildRiverOverlayCanvas.js'
import { buildTopographyContourCanvas } from './buildTopographyContourCanvas.js'
import {
  applyResourceOverlayVisibility,
  createDefaultResourceOverlayVisibility,
  shouldDrawResourceNodeOverlay,
  shouldDrawResourceRasterOverlay,
} from './resourceOverlayVisibility.js'
import { buildArableOverlayCanvas } from './buildArableOverlayCanvas.js'
import { buildMetalsOverlayCanvas } from './buildMetalsOverlayCanvas.js'
import { buildTimberOverlayCanvas } from './buildTimberOverlayCanvas.js'
import { createResourceOverlayIds } from '../worldBuilderPageModel.js'

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
  let arableTexture = null
  const timber = new Sprite(Texture.EMPTY)
  timber.visible = false
  let timberTexture = null
  const metals = new Sprite(Texture.EMPTY)
  metals.visible = false
  let metalsTexture = null
  const rivers = new Sprite(Texture.EMPTY)
  rivers.visible = false
  let riverTexture = null
  const overlay = new Graphics()
  let resourceOverlayVisibility = createDefaultResourceOverlayVisibility(createResourceOverlayIds())
  /** @type {import('../core/types.js').WorldDocument} */
  let currentWorldDocument = worldDocument

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
  refreshArableOverlay(worldDocument, resourceOverlayVisibility)
  refreshTimberOverlay(worldDocument, resourceOverlayVisibility)
  refreshMetalsOverlay(worldDocument, resourceOverlayVisibility)
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
   * @param {Record<string, boolean>} visibility
   */
  function refreshArableOverlay(doc, visibility) {
    const nextCanvas = buildArableOverlayCanvas(doc)
    arableTexture?.destroy(true)
    arableTexture = null

    const visible = shouldDrawResourceRasterOverlay(visibility, 'arable', doc.arableRaster)
    if (!nextCanvas || !visible) {
      arable.visible = false
      arable.texture = Texture.EMPTY
      return
    }

    arableTexture = Texture.from(nextCanvas)
    arable.texture = arableTexture
    arable.visible = true
  }

  function refreshTimberOverlay(doc, visibility) {
    const nextCanvas = buildTimberOverlayCanvas(doc)
    timberTexture?.destroy(true)
    timberTexture = null

    const visible = shouldDrawResourceRasterOverlay(visibility, 'timber', doc.timberRaster)
    if (!nextCanvas || !visible) {
      timber.visible = false
      timber.texture = Texture.EMPTY
      return
    }

    timberTexture = Texture.from(nextCanvas)
    timber.texture = timberTexture
    timber.visible = true
  }

  function refreshMetalsOverlay(doc, visibility) {
    const nextCanvas = buildMetalsOverlayCanvas(doc)
    metalsTexture?.destroy(true)
    metalsTexture = null

    const visible = shouldDrawResourceRasterOverlay(visibility, 'metals', doc.metalsRaster)
    if (!nextCanvas || !visible) {
      metals.visible = false
      metals.texture = Texture.EMPTY
      return
    }

    metalsTexture = Texture.from(nextCanvas)
    metals.texture = metalsTexture
    metals.visible = true
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
      refreshArableOverlay(nextDocument, resourceOverlayVisibility)
      refreshTimberOverlay(nextDocument, resourceOverlayVisibility)
      refreshMetalsOverlay(nextDocument, resourceOverlayVisibility)
      refreshRiverOverlay(nextDocument)
      drawOverlays(overlay, nextDocument, resourceOverlayVisibility)
      syncViewportToHost(viewport, hostEl, nextDocument.gridWidth, nextDocument.gridHeight)
      fitMapToView(viewport, nextDocument.gridWidth, nextDocument.gridHeight)
    },

    /** @param {import('../core/types.js').MapFocus} mapFocus */
    focusOn(mapFocus) {
      if ('minX' in mapFocus) {
        const cx = (mapFocus.minX + mapFocus.maxX) / 2
        const cy = (mapFocus.minY + mapFocus.maxY) / 2
        const span = Math.max(mapFocus.maxX - mapFocus.minX, mapFocus.maxY - mapFocus.minY, 1)
        const scale = Math.min(24, Math.max(1, gridWidth / span / 4))
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
          refreshArableOverlay(baseDocument, resourceOverlayVisibility)
          refreshTimberOverlay(baseDocument, resourceOverlayVisibility)
          refreshMetalsOverlay(baseDocument, resourceOverlayVisibility)
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
      if (resourceId === 'arable') {
        refreshArableOverlay(currentWorldDocument, resourceOverlayVisibility)
      }
      if (resourceId === 'timber') {
        refreshTimberOverlay(currentWorldDocument, resourceOverlayVisibility)
      }
      if (resourceId === 'metals') {
        refreshMetalsOverlay(currentWorldDocument, resourceOverlayVisibility)
      }
      drawOverlays(overlay, currentWorldDocument, resourceOverlayVisibility)
    },

    destroy() {
      stopReplay()
      resizeObserver.disconnect()
      terrainTexture.destroy(true)
      contourTexture?.destroy(true)
      riverTexture?.destroy(true)
      arableTexture?.destroy(true)
      timberTexture?.destroy(true)
      metalsTexture?.destroy(true)
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

  if (
    shouldDrawResourceNodeOverlay(resourceOverlayVisibility, 'metals', worldDocument.metalNodes)
  ) {
    for (const node of worldDocument.metalNodes) {
      overlay.circle(node.x + 0.5, node.y + 0.5, STRATEGIC_RESOURCE_NODE_MARKER_RADIUS)
      overlay.fill({ color: METAL_NODE_OVERLAY_COLOR, alpha: 0.9 })
    }
  }

  if (
    shouldDrawResourceNodeOverlay(resourceOverlayVisibility, 'salt', worldDocument.saltNodes)
  ) {
    for (const node of worldDocument.saltNodes) {
      overlay.circle(node.x + 0.5, node.y + 0.5, STRATEGIC_RESOURCE_NODE_MARKER_RADIUS)
      overlay.fill({ color: SALT_NODE_OVERLAY_COLOR, alpha: 0.9 })
    }
  }

  if (worldDocument.lakeMask) {
    const { gridWidth, biomes } = worldDocument
    for (let i = 0; i < worldDocument.lakeMask.length; i += 1) {
      if (biomes[i] === BIOMES.FRESHWATER_LAKE) {
        const x = i % gridWidth
        const y = Math.floor(i / gridWidth)
        overlay.rect(x, y, 1, 1)
        overlay.fill({ color: 0x3a8fd9, alpha: 0.25 })
      }
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
