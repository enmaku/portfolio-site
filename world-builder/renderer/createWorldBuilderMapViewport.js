import { attachLandingPlacementControls } from './attachLandingPlacementControls.js'
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
  resolveSettlementNodeOverlayDrawn,
} from './worldBuilderMapViewportModel.js'

/** Black for discrete metal mine markers (matches metals raster hue). */
export const METAL_NODE_OVERLAY_COLOR = 0x000000

/** Pure white for salt strategic-resource markers. */
export const SALT_NODE_OVERLAY_COLOR = 0xffffff

/** Yellow for settlement pins. */
export const SETTLEMENT_NODE_OVERLAY_COLOR = 0xffd700

/** Grid-cell radius for metal/salt strategic-resource node markers. */
export const STRATEGIC_RESOURCE_NODE_MARKER_RADIUS = 7

/** Grid-cell radius for settlement pins. */
export const SETTLEMENT_NODE_MARKER_RADIUS = 3

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
  const sail = new Sprite(Texture.EMPTY)
  sail.visible = false
  const freshwater = new Sprite(Texture.EMPTY)
  freshwater.visible = false
  const population = new Sprite(Texture.EMPTY)
  population.visible = false
  const explorationFog = new Sprite(Texture.EMPTY)
  explorationFog.visible = false
  const routes = new Sprite(Texture.EMPTY)
  routes.visible = false
  const coastalOverlay = new Graphics()
  const metalOverlay = new Graphics()
  const saltOverlay = new Graphics()
  const settlementOverlay = new Graphics()
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
    sail: null,
    freshwater: null,
    population: null,
    explorationFog: null,
    routes: null,
  }

  /** @type {Record<import('./resourceRasterOverlayRefresh.js').ResourceRasterOverlayLayerId, import('pixi.js').Sprite>} */
  const resourceRasterSprites = {
    arable,
    timber,
    metals,
    sail,
    freshwater,
    population,
    explorationFog,
    routes,
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
  viewport.addChild(sail)
  viewport.addChild(freshwater)
  viewport.addChild(population)
  viewport.addChild(explorationFog)
  viewport.addChild(routes)
  viewport.addChild(coastalOverlay)
  viewport.addChild(metalOverlay)
  viewport.addChild(saltOverlay)
  viewport.addChild(settlementOverlay)
  viewport
    .drag()
    .pinch()
    .wheel({ smooth: false })
    .clampZoom({ maxScale: 24 })

  app.ticker.stop()

  let interactiveRenderActive = false

  function renderFrame() {
    app.renderer.render(app.stage)
  }

  function startInteractiveRender() {
    if (interactiveRenderActive) {
      return
    }
    interactiveRenderActive = true
    app.ticker.start()
  }

  function stopInteractiveRender() {
    if (!interactiveRenderActive) {
      return
    }
    interactiveRenderActive = false
    app.ticker.stop()
  }

  app.ticker.add(() => {
    if (!interactiveRenderActive) {
      return
    }
    viewport.update(app.ticker.elapsedMS)
    renderFrame()
  })

  viewport.on('moved', renderFrame)
  viewport.on('zoomed', renderFrame)
  viewport.on('drag-start', startInteractiveRender)
  viewport.on('pinch-start', startInteractiveRender)
  viewport.on('wheel', () => {
    startInteractiveRender()
    renderFrame()
    stopInteractiveRender()
  })
  viewport.on('drag-end', () => {
    renderFrame()
    stopInteractiveRender()
  })
  viewport.on('pinch-end', () => {
    renderFrame()
    stopInteractiveRender()
  })

  syncViewportToHost(viewport, hostEl, gridWidth, gridHeight)
  fitMapToView(viewport, gridWidth, gridHeight)
  renderFrame()

  const resizeObserver = new ResizeObserver(() => {
    syncViewportToHost(viewport, hostEl, viewport.worldWidth, viewport.worldHeight)
    renderFrame()
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
      case 'sail':
        sail.visible = false
        break
      case 'freshwater':
        freshwater.visible = false
        break
      case 'population':
        population.visible = false
        break
      case 'explorationFog':
        explorationFog.visible = false
        break
      case 'routes':
        routes.visible = false
        break
      case 'rivers':
        rivers.visible = false
        break
      case 'lakes':
        lakes.visible = false
        break
      case 'coastalNodes':
        coastalOverlay.clear()
        break
      case 'metalNodes':
        metalOverlay.clear()
        break
      case 'saltNodes':
        saltOverlay.clear()
        break
      case 'settlementNodes':
        settlementOverlay.clear()
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
      sail: () => refreshResourceRasterOverlay('sail', currentWorldDocument),
      freshwater: () => refreshResourceRasterOverlay('freshwater', currentWorldDocument),
      population: () => refreshResourceRasterOverlay('population', currentWorldDocument),
      explorationFog: () => refreshResourceRasterOverlay('explorationFog', currentWorldDocument),
      routes: () => refreshResourceRasterOverlay('routes', currentWorldDocument),
      rivers: () => refreshRiverOverlay(currentWorldDocument),
      lakes: () => refreshLakeOverlay(currentWorldDocument),
      coastalNodes: () => drawCoastalNodes(coastalOverlay, currentWorldDocument),
      metalNodes: () =>
        drawMetalNodes(metalOverlay, currentWorldDocument, resourceOverlayVisibility),
      saltNodes: () =>
        drawSaltNodes(saltOverlay, currentWorldDocument, resourceOverlayVisibility),
      settlementNodes: () =>
        drawSettlementNodes(settlementOverlay, currentWorldDocument, resourceOverlayVisibility),
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
    renderFrame()
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

  const landingPlacement = attachLandingPlacementControls({
    Graphics,
    viewport,
    hostEl,
    getWorldDocument: () => currentWorldDocument,
    requestRender: renderFrame,
  })

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
      renderFrame()
    },

    /** @param {import('../core/types.js').MapFocus} mapFocus */
    focusOn(mapFocus) {
      startInteractiveRender()
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
      } else {
        const scale = mapFocus.zoom ?? 4
        viewport.animate({
          time: 400,
          position: { x: mapFocus.x, y: mapFocus.y },
          scale,
        })
      }
      setTimeout(() => {
        stopInteractiveRender()
        renderFrame()
      }, 450)
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
        renderFrame()
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

    setLandingPlacementMode: landingPlacement.setLandingPlacementMode,
    setFoundingLandingMarker: landingPlacement.setFoundingLandingMarker,
    setHaulShedPreviewCells: landingPlacement.setHaulShedPreviewCells,
    onCellPick: landingPlacement.onCellPick,

    destroy() {
      stopReplay()
      stopInteractiveRender()
      landingPlacement.clearCursor()
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
 */
function drawCoastalNodes(overlay, worldDocument) {
  overlay.clear()

  if (worldDocument.coastalNodes?.length) {
    for (const node of worldDocument.coastalNodes) {
      const color = coastalNodeColor(node.kind)
      overlay.circle(node.x + 0.5, node.y + 0.5, 2)
      overlay.fill({ color, alpha: 0.85 })
    }
  }
}

/**
 * @param {import('pixi.js').Graphics} overlay
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {Record<string, boolean>} resourceOverlayVisibility
 */
function drawMetalNodes(overlay, worldDocument, resourceOverlayVisibility) {
  overlay.clear()

  if (resolveMetalsOverlayDrawn(resourceOverlayVisibility, worldDocument).nodesVisible) {
    for (const node of worldDocument.metalNodes) {
      overlay.circle(node.x + 0.5, node.y + 0.5, STRATEGIC_RESOURCE_NODE_MARKER_RADIUS)
      overlay.fill({ color: METAL_NODE_OVERLAY_COLOR, alpha: 0.9 })
    }
  }
}

/**
 * @param {import('pixi.js').Graphics} overlay
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {Record<string, boolean>} resourceOverlayVisibility
 */
function drawSaltNodes(overlay, worldDocument, resourceOverlayVisibility) {
  overlay.clear()

  if (resolveSaltNodeOverlayDrawn(resourceOverlayVisibility, worldDocument)) {
    for (const node of worldDocument.saltNodes) {
      overlay.circle(node.x + 0.5, node.y + 0.5, STRATEGIC_RESOURCE_NODE_MARKER_RADIUS)
      overlay.fill({ color: SALT_NODE_OVERLAY_COLOR, alpha: 0.9 })
    }
  }
}

/**
 * @param {import('pixi.js').Graphics} overlay
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {Record<string, boolean>} resourceOverlayVisibility
 */
function drawSettlementNodes(overlay, worldDocument, resourceOverlayVisibility) {
  overlay.clear()

  if (resolveSettlementNodeOverlayDrawn(resourceOverlayVisibility, worldDocument)) {
    for (const settlement of worldDocument.settlements ?? []) {
      if (typeof settlement.x !== 'number' || typeof settlement.y !== 'number') {
        continue
      }
      overlay.circle(settlement.x + 0.5, settlement.y + 0.5, SETTLEMENT_NODE_MARKER_RADIUS)
      overlay.fill({ color: SETTLEMENT_NODE_OVERLAY_COLOR, alpha: 0.9 })
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
