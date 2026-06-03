/** Win/loss band fills behind the plot (0 = loss, 100 = win). */
export const MATCH_OUTCOME_BAND_WIN_FILL = 'rgba(52, 211, 153, 0.32)'
export const MATCH_OUTCOME_BAND_LOSS_FILL = 'rgba(251, 113, 133, 0.32)'

/**
 * @param {number} value per-match outcome encoded as 0 or 100
 * @returns {string}
 */
export function outcomeBandFillForValue(value) {
  return value >= 50 ? MATCH_OUTCOME_BAND_WIN_FILL : MATCH_OUTCOME_BAND_LOSS_FILL
}

/**
 * Horizontal span for one category band on a category x scale.
 *
 * @param {{ getPixelForValue: (index: number) => number }} xScale
 * @param {number} index
 * @param {number} count
 * @param {{ left: number, right: number }} chartArea
 * @returns {{ left: number, right: number } | null}
 */
export function resolveCategoryBandHorizontalBounds(xScale, index, count, chartArea) {
  if (!Number.isFinite(index) || index < 0 || count < 1) {
    return null
  }
  const center = xScale.getPixelForValue(index)
  if (!Number.isFinite(center)) {
    return null
  }
  if (count === 1) {
    return { left: chartArea.left, right: chartArea.right }
  }
  if (index === 0) {
    const nextCenter = xScale.getPixelForValue(1)
    if (!Number.isFinite(nextCenter)) return null
    return { left: chartArea.left, right: (center + nextCenter) / 2 }
  }
  if (index === count - 1) {
    const prevCenter = xScale.getPixelForValue(index - 1)
    if (!Number.isFinite(prevCenter)) return null
    return { left: (center + prevCenter) / 2, right: chartArea.right }
  }
  const prevCenter = xScale.getPixelForValue(index - 1)
  const nextCenter = xScale.getPixelForValue(index + 1)
  if (!Number.isFinite(prevCenter) || !Number.isFinite(nextCenter)) {
    return null
  }
  return { left: (center + prevCenter) / 2, right: (center + nextCenter) / 2 }
}

/**
 * @param {number[]} outcomeValues oldest→newest (0 loss, 100 win)
 */
export function createMatchOutcomeBandsPlugin(outcomeValues) {
  return {
    id: 'dungeonRunnerMatchOutcomeBands',
    beforeDatasetsDraw(chart) {
      if (!Array.isArray(outcomeValues) || outcomeValues.length === 0) {
        return
      }
      const xScale = chart.scales?.x
      const chartArea = chart.chartArea
      if (!xScale || !chartArea) {
        return
      }

      const { ctx } = chart
      const count = outcomeValues.length
      ctx.save()
      for (let index = 0; index < count; index += 1) {
        const bounds = resolveCategoryBandHorizontalBounds(xScale, index, count, chartArea)
        if (!bounds) continue
        const value = outcomeValues[index]
        if (!Number.isFinite(value)) continue
        ctx.fillStyle = outcomeBandFillForValue(value)
        ctx.fillRect(bounds.left, chartArea.top, bounds.right - bounds.left, chartArea.bottom - chartArea.top)
      }
      ctx.restore()
    },
  }
}
