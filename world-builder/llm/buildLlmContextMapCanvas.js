import { buildTerrainCanvas } from '../renderer/buildTerrainCanvas.js'
import { buildRoutesOverlayCanvas } from '../renderer/buildRoadOverlayRgba.js'

/**
 * Offscreen map for Gemini: biome terrain + land routes + settlement pins.
 * Does not touch the live viewport.
 *
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {{
 *   roads?: import('../core/colonization/roads/roadNetwork.js').RoadSegment[] | null,
 *   settlements?: Array<{ x?: number, y?: number }>,
 * }} [options]
 * @returns {HTMLCanvasElement}
 */
export function buildLlmContextMapCanvas(worldDocument, options = {}) {
  const roads = options.roads ?? worldDocument.roads
  const docForRoutes =
    roads === worldDocument.roads ? worldDocument : { ...worldDocument, roads }

  const canvas = buildTerrainCanvas(worldDocument)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not acquire 2D context for LLM context map')
  }

  const routesCanvas = buildRoutesOverlayCanvas(docForRoutes)
  if (routesCanvas) {
    ctx.drawImage(routesCanvas, 0, 0)
  }

  const pinRadius = Math.max(1.25, Math.min(canvas.width, canvas.height) * 0.004)
  for (const settlement of options.settlements ?? []) {
    if (typeof settlement?.x !== 'number' || typeof settlement?.y !== 'number') continue
    const cx = settlement.x + 0.5
    const cy = settlement.y + 0.5
    ctx.fillStyle = 'rgba(20, 20, 24, 0.92)'
    ctx.beginPath()
    ctx.arc(cx, cy, pinRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.lineWidth = Math.max(0.6, pinRadius * 0.35)
    ctx.stroke()
  }

  return canvas
}
