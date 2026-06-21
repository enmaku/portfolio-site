import { biomeIndicesToRgba } from './biomeIndicesToRgba.js'
import { BIOMES } from '../core/biomeIds.js'
import { riverCorridorRadiusForDrainage } from '../core/hydrology/riverCorridorDisplay.js'
import { buildTopographyContourCanvas } from './buildTopographyContourCanvas.js'

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
    antialias: false,
  })
  hostEl.replaceChildren(app.canvas)

  const { gridWidth, gridHeight } = worldDocument
  let terrainCanvas = buildTerrainCanvas(worldDocument)
  let terrainTexture = Texture.from(terrainCanvas)
  const terrain = new Sprite(terrainTexture)
  const contours = new Sprite(Texture.EMPTY)
  contours.visible = false
  let contourTexture = null
  const overlay = new Graphics()

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
  drawOverlays(overlay, worldDocument)

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

  return {
    /** @param {import('../core/types.js').WorldDocument} nextDocument */
    updateWorldDocument(nextDocument) {
      stopReplay()
      terrainTexture.destroy(true)
      terrainCanvas = buildTerrainCanvas(nextDocument)
      terrainTexture = Texture.from(terrainCanvas)
      terrain.texture = terrainTexture
      refreshContours(nextDocument)
      drawOverlays(overlay, nextDocument)
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
          drawOverlays(overlay, baseDocument)
        }
      }, 120)
    },

    destroy() {
      stopReplay()
      resizeObserver.disconnect()
      terrainTexture.destroy(true)
      contourTexture?.destroy(true)
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
    : biomeIndicesToRgba(worldDocument)
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
 */
function drawOverlays(overlay, worldDocument) {
  overlay.clear()

  if (worldDocument.coastalNodes?.length) {
    for (const node of worldDocument.coastalNodes) {
      const color = coastalNodeColor(node.kind)
      overlay.circle(node.x + 0.5, node.y + 0.5, 2)
      overlay.fill({ color, alpha: 0.85 })
    }
  }

  if (worldDocument.saltNodes?.length) {
    for (const node of worldDocument.saltNodes) {
      overlay.rect(node.x, node.y, 1, 1)
      overlay.fill({ color: 0xf0e68c, alpha: 0.9 })
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

  if (worldDocument.riverNetworkMask && worldDocument.fields?.drainage) {
    const { gridWidth, riverNetworkMask, fields } = worldDocument
    const { drainage } = fields
    for (let i = 0; i < riverNetworkMask.length; i += 1) {
      if (!riverNetworkMask[i]) continue
      const radius = riverCorridorRadiusForDrainage(drainage[i])
      const extent = radius * 2 + 1
      const x = i % gridWidth
      const y = Math.floor(i / gridWidth)
      const alpha = 0.25 + drainage[i] * 0.35
      overlay.rect(x - radius, y - radius, extent, extent)
      overlay.fill({ color: 0x4fc3f7, alpha })
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
