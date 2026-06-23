import { BIOMES } from '../core/biomeIds.js'
import { buildRiverSplineStrokeSegments } from '../core/hydrology/riverSplineStrokes.js'
import { biomeColorForId } from './biomePalette.js'

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../core/types.js').WorldDocument} worldDocument
 */
export function drawRiverSplinesOnCanvas(ctx, worldDocument) {
  const segments = buildRiverSplineStrokeSegments(worldDocument)
  if (segments.length === 0) return

  const [r, g, b] = biomeColorForId(BIOMES.RIVER_CORRIDOR)
  ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const segment of segments) {
    const { points } = segment
    if (points.length < 2) {
      if (points.length === 1) {
        const point = points[0]
        ctx.beginPath()
        ctx.arc(point.x, point.y, point.width / 2, 0, Math.PI * 2)
        ctx.fillStyle = ctx.strokeStyle
        ctx.fill()
      }
      continue
    }

    for (let i = 0; i < points.length - 1; i += 1) {
      const from = points[i]
      const to = points[i + 1]
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.lineWidth = (from.width + to.width) / 2
      ctx.stroke()
    }
  }
}
