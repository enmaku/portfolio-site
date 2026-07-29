import { attachLandingPlacementControls } from './attachLandingPlacementControls.js'
import { attachSettlementHoverControls } from './attachSettlementHoverControls.js'
import { buildFactionTerritoryOverlayCanvas } from './buildFactionTerritoryOverlayRgba.js'
import { buildLakeOverlayCanvas } from './buildLakeOverlayCanvas.js'
import { buildRiverOverlayCanvas } from './buildRiverOverlayCanvas.js'
import { buildTerrainCanvas } from './buildTerrainCanvas.js'
import { buildTopographyContourCanvas } from './buildTopographyContourCanvas.js'
import { captureWorldMapPng } from './captureWorldMapPng.js'
import {
  drawCoastalNodes,
  drawMetalNodes,
  drawRecentConquestMarkers,
  drawSaltNodes,
  drawSettlementIdLabels,
  drawSettlementNodes,
} from './drawMapNodeOverlays.js'
import {
  buildFactionTerritoryHoverIndex,
  factionTerritoryHighlightKey,
  hitTestFactionTerritoryHighlight,
} from './factionTerritoryHover.js'
import { hideMapLayer } from './hideMapLayer.js'
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
import { fitMapToView, syncViewportToHost } from './viewportFraming.js'
import {
  computeRegionFocusScale,
  resolveFactionTerritoryRasterLayerVisible,
} from './worldBuilderMapViewportModel.js'

export {
  SETTLEMENT_ID_LABEL_COLOR,
  SETTLEMENT_ID_LABEL_FONT_SIZE,
  SETTLEMENT_ID_LABEL_OFFSET_X,
  SETTLEMENT_ID_LABEL_OUTLINE_COLOR,
  SETTLEMENT_ID_LABEL_OUTLINE_WIDTH,
  SETTLEMENT_NODE_MARKER_RADIUS,
  SETTLEMENT_NODE_OVERLAY_COLOR,
  SETTLEMENT_NODE_RUIN_OVERLAY_COLOR,
} from './settlementNodeMarkers.js'

export {
  METAL_NODE_OVERLAY_COLOR,
  SALT_NODE_OVERLAY_COLOR,
  STRATEGIC_RESOURCE_NODE_MARKER_RADIUS,
} from './drawMapNodeOverlays.js'

/**
 * @typedef {Object} UpdateWorldDocumentOptions
 * @property {Iterable<import('./mapLayerRefresh.js').MapLayerId> | null} [changedLayers] omit for full rebuild
 */

/**
 * @param {HTMLElement} hostEl
 * @param {import('../core/types.js').WorldDocument} worldDocument
 */
export async function createWorldBuilderMapViewport(hostEl, worldDocument) {
  const { Application, Sprite, Texture, Graphics, Text, Container } = await import('pixi.js')
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
  const wealth = new Sprite(Texture.EMPTY)
  wealth.visible = false
  const factionTerritory = new Sprite(Texture.EMPTY)
  factionTerritory.visible = false
  const coastalOverlay = new Graphics()
  const metalOverlay = new Graphics()
  const saltOverlay = new Graphics()
  const settlementOverlay = new Graphics()
  const settlementIdOverlay = new Container()
  const recentConquestOverlay = new Container()
  /** Campaign kit export only — never toggled from the overlay bar. */
  let settlementIdLabelsEnabled = false
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
    wealth: null,
    factionTerritory: null,
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
    wealth,
    factionTerritory,
  }

  const mapLayerPresentation = {
    contours,
    arable,
    timber,
    metals,
    sail,
    freshwater,
    population,
    explorationFog,
    routes,
    wealth,
    factionTerritory,
    rivers,
    lakes,
    coastalOverlay,
    metalOverlay,
    saltOverlay,
    settlementOverlay,
    settlementIdOverlay,
    recentConquestOverlay,
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
  viewport.addChild(wealth)
  viewport.addChild(factionTerritory)
  viewport.addChild(coastalOverlay)
  viewport.addChild(metalOverlay)
  viewport.addChild(saltOverlay)
  viewport.addChild(routes)
  viewport.addChild(settlementOverlay)
  viewport.addChild(recentConquestOverlay)
  viewport.addChild(settlementIdOverlay)
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

  /** @type {import('./buildFactionTerritoryOverlayRgba.js').FactionTerritoryHighlight | null} */
  let factionTerritoryHighlight = null
  /** @type {ReturnType<typeof buildFactionTerritoryHoverIndex>} */
  let factionTerritoryHoverIndex = null

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
      wealth: () => refreshResourceRasterOverlay('wealth', currentWorldDocument),
      factionTerritory: () => refreshFactionTerritoryOverlay(currentWorldDocument),
      rivers: () => refreshRiverOverlay(currentWorldDocument),
      lakes: () => refreshLakeOverlay(currentWorldDocument),
      coastalNodes: () => drawCoastalNodes(coastalOverlay, currentWorldDocument),
      metalNodes: () =>
        drawMetalNodes(metalOverlay, currentWorldDocument, resourceOverlayVisibility),
      saltNodes: () =>
        drawSaltNodes(saltOverlay, currentWorldDocument, resourceOverlayVisibility),
      settlementNodes: () =>
        drawSettlementNodes(settlementOverlay, currentWorldDocument, resourceOverlayVisibility),
      settlementIdLabels: () =>
        drawSettlementIdLabels(
          settlementIdOverlay,
          Text,
          currentWorldDocument,
          settlementIdLabelsEnabled,
        ),
      recentConquestMarkers: () =>
        drawRecentConquestMarkers(
          recentConquestOverlay,
          Text,
          currentWorldDocument,
          resourceOverlayVisibility,
        ),
    },
    { hideLayer: (layerId) => hideMapLayer(layerId, mapLayerPresentation) },
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
  function refreshFactionTerritoryOverlay(doc) {
    const sprite = resourceRasterSprites.factionTerritory
    resourceRasterTextures.factionTerritory?.destroy(true)
    resourceRasterTextures.factionTerritory = null

    if (!resolveFactionTerritoryRasterLayerVisible(resourceOverlayVisibility, doc)) {
      factionTerritoryHighlight = null
      sprite.visible = false
      sprite.texture = Texture.EMPTY
      return
    }

    const nextCanvas = buildFactionTerritoryOverlayCanvas(doc, {
      highlight: factionTerritoryHighlight,
    })
    if (!nextCanvas) {
      sprite.visible = false
      sprite.texture = Texture.EMPTY
      return
    }

    const nextTexture = Texture.from(nextCanvas)
    resourceRasterTextures.factionTerritory = nextTexture
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
  const settlementHover = attachSettlementHoverControls({
    viewport,
    getWorldDocument: () => currentWorldDocument,
  })

  function invalidateFactionTerritoryHoverIndex() {
    factionTerritoryHoverIndex = null
  }

  /**
   * @param {import('./buildFactionTerritoryOverlayRgba.js').FactionTerritoryHighlight | null} next
   */
  function setFactionTerritoryHighlight(next) {
    const prevKey = factionTerritoryHighlightKey(factionTerritoryHighlight)
    const nextKey = factionTerritoryHighlightKey(next)
    if (prevKey === nextKey) return
    factionTerritoryHighlight = next
    if (!resolveFactionTerritoryRasterLayerVisible(resourceOverlayVisibility, currentWorldDocument)) {
      return
    }
    refreshMapLayers(['factionTerritory'])
  }

  viewport.on('pointermove', (event) => {
    if (!resolveFactionTerritoryRasterLayerVisible(resourceOverlayVisibility, currentWorldDocument)) {
      setFactionTerritoryHighlight(null)
      return
    }
    if (!factionTerritoryHoverIndex) {
      factionTerritoryHoverIndex = buildFactionTerritoryHoverIndex(currentWorldDocument)
    }
    const world = /** @type {{ getLocalPosition: (target: unknown) => { x: number, y: number } }} */ (
      event
    ).getLocalPosition(viewport)
    setFactionTerritoryHighlight(
      hitTestFactionTerritoryHighlight(
        currentWorldDocument,
        world.x,
        world.y,
        factionTerritoryHoverIndex,
      ),
    )
  })
  viewport.on('pointerleave', () => {
    setFactionTerritoryHighlight(null)
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
      invalidateFactionTerritoryHoverIndex()
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
      if (!resourceOverlayVisibility.factionTerritory) {
        factionTerritoryHighlight = null
      }
      refreshMapLayers(changedLayers)
    },

    /**
     * Enable/disable settlement map-number labels for campaign kit export.
     * Not part of the author overlay bar — defaults off.
     *
     * @param {boolean} visible
     */
    setSettlementIdLabelsVisible(visible) {
      const next = visible === true
      if (settlementIdLabelsEnabled === next) {
        return
      }
      settlementIdLabelsEnabled = next
      refreshMapLayers(['settlementIdLabels'])
    },

    /**
     * Full-landmass PNG at native grid resolution for campaign kit export.
     * Restores host resize and the author's pan/zoom afterward.
     *
     * @returns {Promise<Blob>}
     */
    captureWorldPng() {
      let hostResizeSuspended = false
      return captureWorldMapPng({
        app,
        viewport,
        hostEl,
        worldWidth: currentWorldDocument.gridWidth,
        worldHeight: currentWorldDocument.gridHeight,
        renderFrame,
        suspendHostResize() {
          if (hostResizeSuspended) {
            return
          }
          hostResizeSuspended = true
          resizeObserver.disconnect()
        },
        resumeHostResize() {
          if (!hostResizeSuspended) {
            return
          }
          hostResizeSuspended = false
          resizeObserver.observe(hostEl)
        },
      })
    },

    setLandingPlacementMode: landingPlacement.setLandingPlacementMode,
    setFoundingLandingMarker: landingPlacement.setFoundingLandingMarker,
    setSettlementFocusMarker: landingPlacement.setSettlementFocusMarker,
    setHaulShedPreviewCells: landingPlacement.setHaulShedPreviewCells,
    onCellPick: landingPlacement.onCellPick,
    onSettlementFocusClear: landingPlacement.onSettlementFocusClear,
    onSettlementHover: settlementHover.onSettlementHover,

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
