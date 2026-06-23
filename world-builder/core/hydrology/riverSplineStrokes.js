import {
  capRiverCorridorRadiusAtWaterEdge,
  computeRiverNetworkMaxChannelWidth,
  traceRiverChainSegments,
} from './riverCorridorDisplay.js'

/** Minimum stroke width in grid cells. */
export const RIVER_STROKE_MIN_WIDTH = 1

/** Maximum stroke width in grid cells at reference grid size. */
export const RIVER_STROKE_MAX_WIDTH = 7

/**
 * @typedef {{ x: number, y: number }} SplinePoint
 * @typedef {{ x: number, y: number, width: number }} RiverStrokePoint
 * @typedef {{ points: RiverStrokePoint[] }} RiverStrokeSegment
 */

/**
 * @param {number} gridSize
 * @returns {number}
 */
export function riverStrokeMaxWidthForGrid(gridSize) {
  const scale = Math.sqrt(gridSize / 256)
  return Math.min(12, Math.max(RIVER_STROKE_MAX_WIDTH, RIVER_STROKE_MAX_WIDTH * scale))
}

/**
 * @param {number} idx
 * @param {Object} params
 * @param {Float32Array | undefined} params.channelWidth
 * @param {number} params.maxChannelWidth
 * @param {Int16Array} params.flowDirection
 * @param {number} params.width
 * @param {number} params.height
 * @param {boolean[] | undefined} params.ocean
 * @param {Uint8Array | undefined} params.lakeMask
 * @returns {number}
 */
export function resolveRiverStrokeWidth({
  idx,
  channelWidth,
  maxChannelWidth,
  flowDirection,
  width,
  height,
  ocean,
  lakeMask,
}) {
  const x = idx % width
  const y = Math.floor(idx / width)
  const maxWidth = riverStrokeMaxWidthForGrid(width)

  let strokeWidth = RIVER_STROKE_MIN_WIDTH
  if (channelWidth && maxChannelWidth > 0 && channelWidth[idx] > 0) {
    const flowRatio = Math.sqrt(channelWidth[idx] / maxChannelWidth)
    strokeWidth = RIVER_STROKE_MIN_WIDTH + flowRatio * (maxWidth - RIVER_STROKE_MIN_WIDTH)
  }

  const capped = capRiverCorridorRadiusAtWaterEdge(
    strokeWidth - RIVER_STROKE_MIN_WIDTH,
    x,
    y,
    width,
    height,
    ocean,
    lakeMask,
    flowDirection,
    idx,
  )

  if (capped <= 0) return RIVER_STROKE_MIN_WIDTH
  return capped + RIVER_STROKE_MIN_WIDTH
}

/**
 * @param {SplinePoint} p0
 * @param {SplinePoint} p1
 * @param {SplinePoint} p2
 * @param {SplinePoint} p3
 * @param {number} t
 * @returns {SplinePoint}
 */
export function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t
  const t3 = t2 * t
  return {
    x: 0.5 * (
      (2 * p1.x)
      + (-p0.x + p2.x) * t
      + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2
      + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
    ),
    y: 0.5 * (
      (2 * p1.y)
      + (-p0.y + p2.y) * t
      + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2
      + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
    ),
  }
}

/**
 * @param {SplinePoint[]} controlPoints
 * @param {number[]} widths
 * @param {number} [samplesPerSpan]
 * @returns {RiverStrokePoint[]}
 */
export function sampleRiverSpline(controlPoints, widths, samplesPerSpan = 6) {
  if (controlPoints.length === 0) return []
  if (controlPoints.length === 1) {
    return [{ ...controlPoints[0], width: widths[0] ?? RIVER_STROKE_MIN_WIDTH }]
  }

  /** @type {RiverStrokePoint[]} */
  const samples = []

  for (let i = 0; i < controlPoints.length - 1; i += 1) {
    const p0 = controlPoints[Math.max(0, i - 1)]
    const p1 = controlPoints[i]
    const p2 = controlPoints[i + 1]
    const p3 = controlPoints[Math.min(controlPoints.length - 1, i + 2)]
    const widthStart = widths[i] ?? RIVER_STROKE_MIN_WIDTH
    const widthEnd = widths[i + 1] ?? RIVER_STROKE_MIN_WIDTH

    for (let step = 0; step < samplesPerSpan; step += 1) {
      const t = step / samplesPerSpan
      const point = catmullRomPoint(p0, p1, p2, p3, t)
      samples.push({
        x: point.x,
        y: point.y,
        width: widthStart + (widthEnd - widthStart) * t,
      })
    }
  }

  const last = controlPoints[controlPoints.length - 1]
  samples.push({
    x: last.x,
    y: last.y,
    width: widths[widths.length - 1] ?? RIVER_STROKE_MIN_WIDTH,
  })

  return samples
}

/**
 * @param {import('../types.js').WorldDocument} worldDocument
 * @param {boolean[] | undefined} [ocean]
 * @returns {RiverStrokeSegment[]}
 */
export function buildRiverSplineStrokeSegments(worldDocument, ocean) {
  const {
    riverNetworkMask,
    flowDirection,
    channelWidth,
    gridWidth,
    gridHeight,
    lakeMask,
    fields,
  } = worldDocument

  if (!riverNetworkMask || !flowDirection) return []

  const width = gridWidth
  const height = gridHeight
  const maxChannelWidth = channelWidth
    ? computeRiverNetworkMaxChannelWidth(channelWidth, riverNetworkMask)
    : 0

  const oceanMask = ocean ?? (fields?.elevation
    ? isOceanCell(fields.elevation, width, height)
    : undefined)

  const chains = traceRiverChainSegments(riverNetworkMask, flowDirection, width, height)

  return chains.map((chain) => {
    const controlPoints = chain.map((idx) => ({
      x: (idx % width) + 0.5,
      y: Math.floor(idx / width) + 0.5,
    }))
    const widths = chain.map((idx) => resolveRiverStrokeWidth({
      idx,
      channelWidth,
      maxChannelWidth,
      flowDirection,
      width,
      height,
      ocean: oceanMask,
      lakeMask,
    }))
    return {
      points: sampleRiverSpline(controlPoints, widths),
    }
  })
}

import { isOceanCell } from '../fields/applyClosedIslandRim.js'
