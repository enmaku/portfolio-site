import { buildTerrainCanvas } from '../renderer/buildTerrainCanvas.js'
import { buildTopographyContourCanvas } from '../renderer/buildTopographyContourCanvas.js'
import { buildRoutesOverlayCanvas } from '../renderer/buildRoadOverlayRgba.js'
import { buildFactionTerritoryOverlayCanvas } from '../renderer/buildFactionTerritoryOverlayRgba.js'

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {import('../core/colonization/createDefaultColonizationSlice.js').ColonizationSlice} slice
 */
export function mergeWorldDocumentForLlmMaps(worldDocument, slice) {
  return {
    ...worldDocument,
    roads: slice.roads ?? worldDocument.roads,
    settlements: slice.settlements ?? worldDocument.settlements,
    factions: slice.factions ?? worldDocument.factions,
    primaryClaim: slice.primaryClaim ?? worldDocument.primaryClaim,
    softPowerPaintBySettlementId:
      slice.softPowerPaintBySettlementId ?? worldDocument.softPowerPaintBySettlementId,
    increment3LatchedEpoch: slice.increment3LatchedEpoch ?? worldDocument.increment3LatchedEpoch,
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{ x?: number, y?: number, mapNumber?: number, n?: number, status?: string }>} settlements
 * @param {number} gridWidth
 * @param {number} gridHeight
 */
function paintSettlementMarkers(ctx, settlements, gridWidth, gridHeight) {
  const pinRadius = Math.max(1.5, Math.min(gridWidth, gridHeight) * 0.0045)
  const fontPx = Math.max(8, Math.round(Math.min(gridWidth, gridHeight) * 0.012))
  ctx.font = `bold ${fontPx}px sans-serif`
  ctx.textBaseline = 'middle'

  for (const settlement of settlements) {
    if (typeof settlement?.x !== 'number' || typeof settlement?.y !== 'number') continue
    if (settlement.status === 'ruin') continue
    const cx = settlement.x + 0.5
    const cy = settlement.y + 0.5
    ctx.fillStyle = 'rgba(20, 20, 24, 0.92)'
    ctx.beginPath()
    ctx.arc(cx, cy, pinRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = Math.max(0.7, pinRadius * 0.35)
    ctx.stroke()

    const label =
      typeof settlement.mapNumber === 'number'
        ? String(settlement.mapNumber)
        : typeof settlement.n === 'number'
          ? String(settlement.n)
          : ''
    if (!label) continue
    const tx = cx + pinRadius + 1.5
    const ty = cy
    ctx.lineWidth = Math.max(2, fontPx * 0.22)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)'
    ctx.strokeText(label, tx, ty)
    ctx.fillStyle = 'rgba(255, 250, 230, 0.98)'
    ctx.fillText(label, tx, ty)
  }
}

/**
 * Physical context map: biome terrain + contours + land routes + numbered pins.
 *
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {{
 *   roads?: import('../core/colonization/roads/roadNetwork.js').RoadSegment[] | null,
 *   settlements?: Array<object>,
 * }} [options]
 * @returns {HTMLCanvasElement}
 */
export function buildLlmPhysicalMapCanvas(worldDocument, options = {}) {
  const roads = options.roads ?? worldDocument.roads
  const docForRoutes =
    roads === worldDocument.roads ? worldDocument : { ...worldDocument, roads }

  const canvas = buildTerrainCanvas(worldDocument)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not acquire 2D context for LLM physical map')
  }

  const contours = buildTopographyContourCanvas(worldDocument)
  if (contours) ctx.drawImage(contours, 0, 0)

  const routesCanvas = buildRoutesOverlayCanvas(docForRoutes)
  if (routesCanvas) ctx.drawImage(routesCanvas, 0, 0)

  paintSettlementMarkers(
    ctx,
    options.settlements ?? worldDocument.settlements ?? [],
    canvas.width,
    canvas.height,
  )
  return canvas
}

/**
 * Political context map: faction territory + land routes + numbered pins.
 *
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {{
 *   roads?: import('../core/colonization/roads/roadNetwork.js').RoadSegment[] | null,
 *   settlements?: Array<object>,
 * }} [options]
 * @returns {HTMLCanvasElement | null}
 */
export function buildLlmPoliticalMapCanvas(worldDocument, options = {}) {
  const roads = options.roads ?? worldDocument.roads
  const doc = {
    ...worldDocument,
    roads,
    settlements: options.settlements ?? worldDocument.settlements,
  }
  const territory = buildFactionTerritoryOverlayCanvas(doc)
  if (!territory) return null

  const canvas = document.createElement('canvas')
  canvas.width = worldDocument.gridWidth
  canvas.height = worldDocument.gridHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not acquire 2D context for LLM political map')
  }

  // Dim terrain under territory so coasts stay readable.
  const terrain = buildTerrainCanvas(worldDocument)
  ctx.globalAlpha = 0.35
  ctx.drawImage(terrain, 0, 0)
  ctx.globalAlpha = 1
  ctx.drawImage(territory, 0, 0)

  const routesCanvas = buildRoutesOverlayCanvas(doc)
  if (routesCanvas) ctx.drawImage(routesCanvas, 0, 0)

  paintSettlementMarkers(ctx, doc.settlements ?? [], canvas.width, canvas.height)
  return canvas
}

/**
 * @deprecated Prefer buildLlmPhysicalMapCanvas
 */
export function buildLlmContextMapCanvas(worldDocument, options = {}) {
  return buildLlmPhysicalMapCanvas(worldDocument, options)
}
