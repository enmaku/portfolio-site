import { SEA_LEVEL } from '../core/biomeIds.js'

/** Target number of contour lines across land elevation range. */
const TARGET_CONTOUR_COUNT = 16

/** Minimum normalized elevation span before drawing any contours. */
const MIN_LAND_SPAN = 0.04

/**
 * @typedef {{ x0: number, y0: number, x1: number, y1: number }} ContourSegment
 */

/**
 * @param {object} params
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.seaLevel]
 * @param {number} [params.interval]
 * @param {number} [params.stride]
 * @returns {ContourSegment[]}
 */
export function extractTopographyContourSegments({
  elevation,
  width,
  height,
  seaLevel = SEA_LEVEL,
  interval,
  stride,
}) {
  if (width < 2 || height < 2) {
    return []
  }

  const sampleStride = stride ?? (width > 512 ? 2 : 1)
  const sampled = downsampleElevation(elevation, width, height, sampleStride)
  const contourInterval = interval ?? chooseContourInterval(sampled.elevation, seaLevel)
  if (contourInterval <= 0) {
    return []
  }

  const maxLandElevation = maxElevationAtOrAbove(sampled.elevation, seaLevel)
  if (maxLandElevation <= seaLevel + MIN_LAND_SPAN) {
    return []
  }

  /** @type {ContourSegment[]} */
  const segments = []
  for (
    let level = seaLevel + contourInterval;
    level < maxLandElevation;
    level += contourInterval
  ) {
    appendSegmentsForLevel(segments, sampled, level, seaLevel, sampleStride)
  }

  return segments
}

/**
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 * @param {number} stride
 */
function downsampleElevation(elevation, width, height, stride) {
  const sampleWidth = Math.floor((width - 1) / stride) + 1
  const sampleHeight = Math.floor((height - 1) / stride) + 1
  const sampled = new Float32Array(sampleWidth * sampleHeight)

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const sourceX = Math.min(x * stride, width - 1)
      const sourceY = Math.min(y * stride, height - 1)
      sampled[y * sampleWidth + x] = elevation[sourceY * width + sourceX]
    }
  }

  return { elevation: sampled, width: sampleWidth, height: sampleHeight }
}

/**
 * @param {Float32Array} elevation
 * @param {number} seaLevel
 */
function maxElevationAtOrAbove(elevation, seaLevel) {
  let max = seaLevel
  for (let i = 0; i < elevation.length; i += 1) {
    if (elevation[i] >= seaLevel && elevation[i] > max) {
      max = elevation[i]
    }
  }
  return max
}

/**
 * @param {Float32Array} elevation
 * @param {number} seaLevel
 */
function chooseContourInterval(elevation, seaLevel) {
  const maxLand = maxElevationAtOrAbove(elevation, seaLevel)
  const span = maxLand - seaLevel
  if (span <= MIN_LAND_SPAN) {
    return 0
  }
  return span / TARGET_CONTOUR_COUNT
}

/**
 * @param {ContourSegment[]} segments
 * @param {{ elevation: Float32Array, width: number, height: number }} grid
 * @param {number} level
 * @param {number} seaLevel
 * @param {number} scale
 */
function appendSegmentsForLevel(segments, grid, level, seaLevel, scale) {
  const { elevation, width, height } = grid

  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const tl = elevation[y * width + x]
      const tr = elevation[y * width + x + 1]
      const bl = elevation[(y + 1) * width + x]
      const br = elevation[(y + 1) * width + x + 1]

      if (Math.max(tl, tr, bl, br) < seaLevel) {
        continue
      }

      let caseIndex = 0
      if (tl >= level) caseIndex |= 1
      if (tr >= level) caseIndex |= 2
      if (br >= level) caseIndex |= 4
      if (bl >= level) caseIndex |= 8

      if (caseIndex === 0 || caseIndex === 15) {
        continue
      }

      const top = horizontalEdgePoint(x, y, tl, tr, level, scale)
      const right = verticalEdgePoint(x + 1, y, tr, br, level, scale)
      const bottom = horizontalEdgePoint(x, y + 1, bl, br, level, scale)
      const left = verticalEdgePoint(x, y, tl, bl, level, scale)
      const centerHigh = (tl + tr + bl + br) / 4 >= level

      /** @type {[number[], number[]][]} */
      let pairs
      switch (caseIndex) {
        case 1:
          pairs = [[left, top]]
          break
        case 2:
          pairs = [[top, right]]
          break
        case 3:
          pairs = [[left, right]]
          break
        case 4:
          pairs = [[right, bottom]]
          break
        case 5:
          pairs = centerHigh
            ? [
                [left, top],
                [right, bottom],
              ]
            : [
                [top, right],
                [bottom, left],
              ]
          break
        case 6:
          pairs = [[top, bottom]]
          break
        case 7:
          pairs = [[left, bottom]]
          break
        case 8:
          pairs = [[bottom, left]]
          break
        case 9:
          pairs = [[top, bottom]]
          break
        case 10:
          pairs = centerHigh
            ? [
                [top, right],
                [bottom, left],
              ]
            : [
                [left, top],
                [right, bottom],
              ]
          break
        case 11:
          pairs = [[right, bottom]]
          break
        case 12:
          pairs = [[right, left]]
          break
        case 13:
          pairs = [[top, right]]
          break
        case 14:
          pairs = [[left, top]]
          break
        default:
          pairs = []
      }

      for (const [start, end] of pairs) {
        segments.push({
          x0: start[0],
          y0: start[1],
          x1: end[0],
          y1: end[1],
        })
      }
    }
  }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} a
 * @param {number} b
 * @param {number} level
 * @param {number} scale
 */
function horizontalEdgePoint(x, y, a, b, level, scale) {
  const t = interpolateEdgeT(a, b, level)
  return [(x + t) * scale, y * scale]
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} a
 * @param {number} b
 * @param {number} level
 * @param {number} scale
 */
function verticalEdgePoint(x, y, a, b, level, scale) {
  const t = interpolateEdgeT(a, b, level)
  return [x * scale, (y + t) * scale]
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} level
 */
function interpolateEdgeT(a, b, level) {
  const delta = b - a
  if (Math.abs(delta) < 1e-6) {
    return 0.5
  }
  return Math.max(0, Math.min(1, (level - a) / delta))
}
