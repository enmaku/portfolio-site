/** @typedef {{ labelIndex: number, modelId: string }} ModelPublishMarkerLine */

const LINE_COLOR = 'rgba(167, 139, 250, 0.45)'
const LABEL_COLOR = '#c4b5fd'
const LABEL_FONT = '600 9px system-ui, sans-serif'

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {number} chartLeft
 * @param {number} chartRight
 */
function drawModelPublishLabel(ctx, text, x, y, chartLeft, chartRight) {
  ctx.font = LABEL_FONT
  const padding = 2
  const metrics = ctx.measureText(text)
  const halfWidth = metrics.width / 2
  let drawX = x
  let align = 'center'
  if (x - halfWidth < chartLeft + padding) {
    drawX = chartLeft + padding
    align = 'left'
  } else if (x + halfWidth > chartRight - padding) {
    drawX = chartRight - padding
    align = 'right'
  }
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  ctx.fillStyle = LABEL_COLOR
  ctx.fillText(text, drawX, y)
}

/**
 * Thin vertical publish markers across the plot with version labels at the top.
 *
 * @param {ModelPublishMarkerLine[]} markers
 */
export function createModelPublishLinePlugin(markers) {
  return {
    id: 'dungeonRunnerModelPublishLines',
    beforeDatasetsDraw(chart) {
      if (!markers?.length) return
      const xScale = chart.scales?.x
      const chartArea = chart.chartArea
      if (!xScale || !chartArea) return

      const { ctx } = chart
      ctx.save()
      ctx.strokeStyle = LINE_COLOR
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      for (const marker of markers) {
        const x = xScale.getPixelForValue(marker.labelIndex)
        if (!Number.isFinite(x)) continue
        ctx.beginPath()
        ctx.moveTo(x, chartArea.top)
        ctx.lineTo(x, chartArea.bottom)
        ctx.stroke()
      }
      ctx.restore()
    },
    afterDraw(chart) {
      if (!markers?.length) return
      const xScale = chart.scales?.x
      const chartArea = chart.chartArea
      if (!xScale || !chartArea) return

      const { ctx } = chart
      ctx.save()
      for (const marker of markers) {
        const x = xScale.getPixelForValue(marker.labelIndex)
        if (!Number.isFinite(x)) continue
        drawModelPublishLabel(ctx, marker.modelId, x, chartArea.top + 2, chartArea.left, chartArea.right)
      }
      ctx.restore()
    },
  }
}
