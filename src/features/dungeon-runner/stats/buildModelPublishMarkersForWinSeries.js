import { parseMatchOutcomeCreatedAtMs } from './parseMatchOutcomeCreatedAtMs.js'

/**
 * @typedef {object} HumanWinSeriesPointWithTime
 * @property {boolean} humanWon
 * @property {unknown} [createdAt]
 */

/**
 * @typedef {object} ModelPublishMarker
 * @property {number} sequence 1-based match position in the loaded series
 * @property {string} modelId semver promoted version (never `latest`)
 * @property {number} publishedAtMs
 */

/**
 * Markers for semver models whose `publishedAt` falls within the loaded match
 * series time span and whose mapped sequence appears on the rolling chart x-axis.
 *
 * @param {{
 *   series: HumanWinSeriesPointWithTime[],
 *   publishedAtByModelId?: Record<string, string>,
 *   chartSequenceMin: number,
 *   chartSequenceMax: number,
 * }} input
 * @returns {ModelPublishMarker[]}
 */
export function buildModelPublishMarkersForWinSeries(input) {
  const { series, publishedAtByModelId, chartSequenceMin, chartSequenceMax } = input ?? {}
  if (!Array.isArray(series) || series.length === 0) {
    return []
  }

  const seriesTimes = series.map((point) => parseMatchOutcomeCreatedAtMs(point?.createdAt))
  const validTimes = seriesTimes.filter((ms) => ms != null)
  if (validTimes.length === 0) {
    return []
  }

  const rangeStartMs = Math.min(...validTimes)
  const rangeEndMs = Math.max(...validTimes)

  /** @type {ModelPublishMarker[]} */
  const markers = []
  const catalog = publishedAtByModelId ?? {}

  for (const [modelId, publishedAt] of Object.entries(catalog)) {
    if (modelId === 'latest' || typeof publishedAt !== 'string' || !publishedAt.trim()) {
      continue
    }
    const publishedAtMs = Date.parse(publishedAt)
    if (!Number.isFinite(publishedAtMs)) {
      continue
    }
    if (publishedAtMs < rangeStartMs || publishedAtMs > rangeEndMs) {
      continue
    }

    let sequence = null
    for (let index = 0; index < series.length; index += 1) {
      const matchMs = seriesTimes[index]
      if (matchMs == null) continue
      if (matchMs >= publishedAtMs) {
        sequence = index + 1
        break
      }
    }
    if (sequence == null || sequence < chartSequenceMin || sequence > chartSequenceMax) {
      continue
    }

    markers.push({ sequence, modelId, publishedAtMs })
  }

  markers.sort((a, b) => a.sequence - b.sequence || a.modelId.localeCompare(b.modelId))
  return markers
}

/**
 * @param {string[]} chartLabels sequence ordinals as strings
 * @param {ModelPublishMarker[]} markers
 * @returns {Array<ModelPublishMarker & { labelIndex: number }>}
 */
export function attachLabelIndexToModelPublishMarkers(chartLabels, markers) {
  if (!Array.isArray(chartLabels) || !Array.isArray(markers)) {
    return []
  }
  return markers
    .map((marker) => {
      const labelIndex = chartLabels.indexOf(String(marker.sequence))
      if (labelIndex < 0) return null
      return { ...marker, labelIndex }
    })
    .filter((marker) => marker != null)
}
