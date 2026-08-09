import { extractTopographyContourSegments } from './extractTopographyContourSegments.js'

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildTopographyContourCanvas(worldDocument) {
  const { gridWidth, gridHeight } = worldDocument
  const segments = extractTopographyContourSegments({
    elevation: worldDocument.fields.elevation,
    width: gridWidth,
    height: gridHeight,
  })
  if (segments.length === 0) {
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.width = gridWidth
  canvas.height = gridHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context for contour texture')
  }

  ctx.strokeStyle = 'rgba(20, 16, 12, 0.42)'
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (const segment of segments) {
    ctx.moveTo(segment.x0, segment.y0)
    ctx.lineTo(segment.x1, segment.y1)
  }
  ctx.stroke()

  return canvas
}
