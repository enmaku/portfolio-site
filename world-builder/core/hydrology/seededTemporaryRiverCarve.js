import { SEA_LEVEL } from '../biomeIds.js'
import { isRimCell } from '../fields/applyClosedIslandRim.js'
import { computeSlopeField } from '../fields/elevationPriors.js'
import { createSeededRandom, deriveFieldSeed } from '../noise/seededRandom.js'
import { REFERENCE_NAVIGABLE_GRADIENT_CUTOFF, riverDisplayFlowCutoffForGrid } from '../types.js'
import { downstreamIndex, D8_OFFSETS } from './computeFlowAccumulation.js'

const D8_DIST = [Math.SQRT2, 1, Math.SQRT2, 1, 1, Math.SQRT2, 1, Math.SQRT2]
const MIN_SLOPE = 0.002
const MIN_ELEVATION_ABOVE_SEA = 0.08
const MAX_PATH_LENGTH_SCALE = 0.75

export const MAX_INCISE_ITERATIONS = 12
export const MAX_STREAM_POWER_K = 0.008
export const MIN_STREAM_POWER_M = 0.2
export const MAX_STREAM_POWER_M = 0.8
export const MIN_STREAM_POWER_N = 0.5
export const MAX_STREAM_POWER_N = 2

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  if (value < min) return min
  if (value > max) return max
  return value
}

/**
 * @param {Partial<{
 *   inciseIterations: number,
 *   streamPowerK: number,
 *   streamPowerM: number,
 *   streamPowerN: number,
 *   channelInitiationThreshold: number,
 * }>} options
 */
export function clampStreamPowerOptions(options = {}) {
  return {
    inciseIterations: Math.min(
      MAX_INCISE_ITERATIONS,
      Math.max(0, Math.round(options.inciseIterations ?? 0)),
    ),
    streamPowerK: clamp(options.streamPowerK ?? 0, 0, MAX_STREAM_POWER_K),
    streamPowerM: clamp(options.streamPowerM ?? 0.45, MIN_STREAM_POWER_M, MAX_STREAM_POWER_M),
    streamPowerN: clamp(options.streamPowerN ?? 1.1, MIN_STREAM_POWER_N, MAX_STREAM_POWER_N),
    channelInitiationThreshold: Math.max(0, options.channelInitiationThreshold ?? 0),
  }
}

/**
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {Float32Array} params.flowAccumulation
 * @param {Int16Array} params.flowDirection
 * @param {Uint8Array | null | undefined} [params.lakeMask]
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {number} [params.seaLevel]
 * @returns {number[]}
 */
export function selectTemporaryRiverSources({
  elevation,
  ocean,
  flowAccumulation,
  flowDirection,
  lakeMask,
  width,
  height,
  geographySeed,
  seaLevel = SEA_LEVEL,
}) {
  const cellCount = width * height
  const slopes = computeSlopeField(elevation, width, height)
  const random = createSeededRandom(deriveFieldSeed(geographySeed, 'temporary-river-sources'))
  const sourceSpacing = Math.max(20, Math.round(Math.max(width, height) / 20))
  const maxSources = Math.max(12, Math.round(Math.max(width, height) / 48))
  const rimMargin = Math.max(2, Math.round(Math.max(width, height) / 64))
  const minPathCells = Math.max(2, Math.round(Math.max(width, height) * 0.06))

  /** @type {{ idx: number, score: number, tie: number }[]} */
  const candidates = []

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (ocean[idx] || (lakeMask && lakeMask[idx])) continue
    if (elevation[idx] < seaLevel + MIN_ELEVATION_ABOVE_SEA) continue
    if (slopes[idx] < MIN_SLOPE) continue
    if (isNearRimCell(idx, width, height, rimMargin)) continue
    if (!isMountainBaseCell(idx, elevation, ocean, width, height)) continue
    if (drainsDirectlyToOcean(idx, ocean, flowDirection, width)) continue

    const initiation = slopes[idx] * Math.sqrt(flowAccumulation[idx] + 1)
    if (initiation <= 0) continue
    candidates.push({ idx, score: initiation, tie: random() })
  }

  candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    return left.tie - right.tie
  })

  /** @type {number[]} */
  const selected = []
  for (const candidate of candidates) {
    if (selected.length >= maxSources) break
    const path = routeDownslopePath({
      sourceIdx: candidate.idx,
      elevation,
      ocean,
      flowDirection,
      lakeMask,
      width,
      height,
    })
    if (path.length < minPathCells) continue
    if (pathEndsAtRimMouth(path, ocean, width, height)) continue
    const x = candidate.idx % width
    const y = Math.floor(candidate.idx / width)
    const tooClose = selected.some((otherIdx) => {
      const ox = otherIdx % width
      const oy = Math.floor(otherIdx / width)
      return Math.hypot(x - ox, y - oy) < sourceSpacing
    })
    if (!tooClose) {
      selected.push(candidate.idx)
    }
  }

  return selected
}

/**
 * @param {number[]} sources
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {Int16Array} params.flowDirection
 * @param {Uint8Array | null | undefined} [params.lakeMask]
 * @param {number} params.width
 * @param {number} params.height
 * @returns {number[]}
 */
export function filterTemporaryRiverSourcesByPathLength(sources, {
  elevation,
  ocean,
  flowDirection,
  lakeMask,
  width,
  height,
}) {
  const minPathCells = Math.max(2, Math.round(Math.max(width, height) * 0.06))
  /** @type {number[]} */
  const filtered = []

  for (const sourceIdx of sources) {
    const path = routeDownslopePath({
      sourceIdx,
      elevation,
      ocean,
      flowDirection,
      lakeMask,
      width,
      height,
    })
    if (path.length < minPathCells) continue
    if (pathEndsAtRimMouth(path, ocean, width, height)) continue
    filtered.push(sourceIdx)
  }

  return filtered
}

/**
 * @param {Object} params
 * @param {number} params.sourceIdx
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {Int16Array} params.flowDirection
 * @param {Uint8Array | null | undefined} [params.lakeMask]
 * @param {number} params.width
 * @param {number} params.height
 * @returns {number[]}
 */
export function routeDownslopePath({
  sourceIdx,
  elevation,
  ocean,
  flowDirection,
  lakeMask,
  width,
  height,
}) {
  const maxLength = Math.max(8, Math.round(Math.max(width, height) * MAX_PATH_LENGTH_SCALE))
  /** @type {number[]} */
  const path = [sourceIdx]
  const visited = new Set([sourceIdx])
  let current = sourceIdx

  for (let step = 0; step < maxLength; step += 1) {
    const downstream = downstreamIndex(current, width, flowDirection)
    let next = downstream

    if (next < 0 || ocean[next] || visited.has(next) || (lakeMask && lakeMask[next])) {
      next = steepestDescentNeighbor(current, elevation, ocean, lakeMask, width, height)
    }

    if (next < 0 || visited.has(next)) break
    if (elevation[next] > elevation[current] + 1e-5) break

    path.push(next)
    visited.add(next)
    current = next

    if (ocean[current]) break
  }

  return path
}

/**
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {Int16Array} params.flowDirection
 * @param {Float32Array} params.flowAccumulation
 * @param {Uint8Array | null | undefined} [params.lakeMask]
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {number} [params.seaLevel]
 * @param {number} [params.incisionDepth]
 * @param {number} [params.inciseIterations]
 * @param {number} [params.streamPowerK]
 * @param {number} [params.streamPowerM]
 * @param {number} [params.streamPowerN]
 * @param {Uint8Array} [params.channelSeedMask]
 * @param {number} [params.channelInitiationThreshold]
 * @param {(progress: number) => void} [params.onProgress]
 * @returns {{ elevation: Float32Array, corridorMask: Uint8Array, paths: number[][] }}
 */
export function carveTemporaryRivers({
  elevation,
  ocean,
  flowDirection,
  flowAccumulation,
  lakeMask,
  width,
  height,
  geographySeed,
  seaLevel = SEA_LEVEL,
  incisionDepth = 0.008,
  inciseIterations,
  streamPowerK,
  streamPowerM,
  streamPowerN,
  channelInitiationThreshold,
  channelSeedMask,
  onProgress,
}) {
  /** @type {number[][]} */
  const paths = []
  const corridorMask = new Uint8Array(width * height)
  const cellCount = width * height

  if (channelSeedMask) {
    for (let idx = 0; idx < cellCount; idx += 1) {
      if (!channelSeedMask[idx] || ocean[idx] || (lakeMask && lakeMask[idx])) continue
      corridorMask[idx] = 1
    }
  } else {
    const sources = selectTemporaryRiverSources({
      elevation,
      ocean,
      flowAccumulation,
      flowDirection,
      lakeMask,
      width,
      height,
      geographySeed,
      seaLevel,
    })

    for (const sourceIdx of sources) {
      paths.push(
        routeDownslopePath({
          sourceIdx,
          elevation,
          ocean,
          flowDirection,
          lakeMask,
          width,
          height,
        }),
      )
    }

    for (const path of paths) {
      for (const idx of path) {
        if (ocean[idx]) continue
        corridorMask[idx] = 1
      }
    }
  }

  const streamPower = clampStreamPowerOptions({
    inciseIterations,
    streamPowerK,
    streamPowerM,
    streamPowerN,
    channelInitiationThreshold,
  })
  const carveProgressWeight = streamPower.inciseIterations > 0 ? 0.35 : 1

  onProgress?.(0)

  const out = new Float32Array(elevation)
  const random = createSeededRandom(deriveFieldSeed(geographySeed, 'temporary-river-carve'))
  const slopes = computeSlopeField(elevation, width, height)
  let totalCells = 0
  for (let idx = 0; idx < cellCount; idx += 1) {
    if (corridorMask[idx]) totalCells += 1
  }
  totalCells = Math.max(1, totalCells)
  let carvedCells = 0

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (!corridorMask[idx] || ocean[idx]) continue
    const slopeFactor = 1 + slopes[idx] * 6
    const depth = incisionDepth * slopeFactor * (0.85 + random() * 0.3)
    out[idx] = Math.max(seaLevel, out[idx] - depth)
    carvedCells += 1
    if (onProgress && carvedCells % 8 === 0) {
      onProgress(Math.min(carveProgressWeight, (carvedCells / totalCells) * carveProgressWeight))
    }
  }

  const incised = applyLiteStreamPower({
    elevation: out,
    corridorMask,
    ocean,
    flowAccumulation,
    flowDirection,
    width,
    height,
    seaLevel,
    geographySeed,
    ...streamPower,
    onProgress:
      streamPower.inciseIterations > 0 && onProgress
        ? (progress) => {
            onProgress(carveProgressWeight + progress * (1 - carveProgressWeight))
          }
        : undefined,
  })

  onProgress?.(1)

  return {
    elevation: incised,
    corridorMask,
    paths,
  }
}

/**
 * Lite stream-power erosion (E = K × A^m × S^n) with transport-limited floodplain deposition.
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Uint8Array} params.corridorMask
 * @param {boolean[]} params.ocean
 * @param {Float32Array} params.flowAccumulation
 * @param {Int16Array} [params.flowDirection]
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.seaLevel
 * @param {number} params.geographySeed
 * @param {number} params.inciseIterations
 * @param {number} params.streamPowerK
 * @param {number} params.streamPowerM
 * @param {number} params.streamPowerN
 * @param {number} params.channelInitiationThreshold
 * @param {(progress: number) => void} [params.onProgress]
 * @returns {Float32Array}
 */
export function applyLiteStreamPower({
  elevation,
  corridorMask,
  ocean,
  flowAccumulation,
  flowDirection,
  width,
  height,
  seaLevel,
  geographySeed,
  inciseIterations,
  streamPowerK,
  streamPowerM,
  streamPowerN,
  channelInitiationThreshold,
  onProgress,
}) {
  const options = clampStreamPowerOptions({
    inciseIterations,
    streamPowerK,
    streamPowerM,
    streamPowerN,
    channelInitiationThreshold,
  })
  if (options.inciseIterations <= 0 || options.streamPowerK <= 0) {
    onProgress?.(1)
    return elevation
  }

  const out = new Float32Array(elevation)
  const random = createSeededRandom(deriveFieldSeed(geographySeed, 'lite-stream-power'))
  const downstreamFlowMin = Math.max(2, riverDisplayFlowCutoffForGrid(width) * 0.12)
  const targetGradient = REFERENCE_NAVIGABLE_GRADIENT_CUTOFF
  const floodplainSlopeMax = targetGradient * 0.85
  const maxErosionDelta = options.streamPowerK * 4
  const maxDepositDelta = options.streamPowerK * 2.5

  onProgress?.(0)

  for (let iteration = 0; iteration < options.inciseIterations; iteration += 1) {
    const slopes = computeSlopeField(out, width, height)
    let erosionBudget = 0

    for (let idx = 0; idx < out.length; idx += 1) {
      if (!corridorMask[idx] || ocean[idx]) continue

      const area = flowAccumulation[idx]
      const slope = Math.max(slopes[idx], MIN_SLOPE)
      const initiation = slope * Math.sqrt(area + 1)
      if (initiation < options.channelInitiationThreshold) continue
      if (slope <= targetGradient) continue

      const erosion =
        options.streamPowerK *
        area ** options.streamPowerM *
        slope ** options.streamPowerN
      const tieBreak = random() * options.streamPowerK * 0.05
      const delta = Math.min(maxErosionDelta, erosion + tieBreak)
      out[idx] = Math.max(seaLevel, out[idx] - delta)
      erosionBudget += delta
    }

    for (let idx = 0; idx < out.length; idx += 1) {
      if (!corridorMask[idx] || ocean[idx]) continue

      const area = flowAccumulation[idx]
      const slope = slopes[idx]
      if (slope >= floodplainSlopeMax) continue

      const deposit =
        options.streamPowerK *
        (floodplainSlopeMax - slope + MIN_SLOPE) *
        Math.sqrt(area + 1) *
        (area >= downstreamFlowMin ? 0.1 : 0.06)

      if (deposit <= 0) continue

      const budgetShare = erosionBudget > 0 ? Math.min(1, erosionBudget / (deposit + 1e-6)) : 0.4
      const delta = Math.min(maxDepositDelta, deposit * budgetShare)
      out[idx] = Math.min(0.98, out[idx] + delta)
    }

    relaxSteepCorridorSteps({
      elevation: out,
      corridorMask,
      ocean,
      flowDirection,
      flowAccumulation,
      width,
      seaLevel,
      targetGradient,
      streamPowerK: options.streamPowerK,
      downstreamFlowMin,
    })

    onProgress?.((iteration + 1) / options.inciseIterations)
  }

  return out
}

/**
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Uint8Array} params.corridorMask
 * @param {boolean[]} params.ocean
 * @param {Int16Array} params.flowDirection
 * @param {Float32Array} params.flowAccumulation
 * @param {number} params.width
 * @param {number} params.seaLevel
 * @param {number} params.targetGradient
 * @param {number} params.streamPowerK
 * @param {number} params.downstreamFlowMin
 */
function relaxSteepCorridorSteps({
  elevation,
  corridorMask,
  ocean,
  flowDirection,
  flowAccumulation,
  width,
  seaLevel,
  targetGradient,
  streamPowerK,
  downstreamFlowMin,
}) {
  if (!flowDirection) return

  const maxTrim = streamPowerK * 1.5

  for (let idx = 0; idx < elevation.length; idx += 1) {
    if (!corridorMask[idx] || ocean[idx]) continue
    if (flowAccumulation[idx] < downstreamFlowMin) continue

    const downstream = downstreamIndex(idx, width, flowDirection)
    if (downstream < 0 || ocean[downstream]) continue

    const stepGradient = elevation[idx] - elevation[downstream]
    if (stepGradient <= targetGradient) continue

    const excess = stepGradient - targetGradient
    const trim = Math.min(maxTrim, excess * 0.35)
    elevation[idx] = Math.max(seaLevel, elevation[idx] - trim)
  }
}

/**
 * @param {number} idx
 * @param {Float32Array} elevation
 * @param {boolean[]} ocean
 * @param {number} width
 * @param {number} height
 */
/**
 * @param {number} idx
 * @param {number} width
 * @param {number} height
 * @param {number} margin
 */
function isNearRimCell(idx, width, height, margin) {
  const x = idx % width
  const y = Math.floor(idx / width)
  return x < margin || y < margin || x >= width - margin || y >= height - margin
}

/**
 * @param {number} idx
 * @param {boolean[]} ocean
 * @param {Int16Array} flowDirection
 * @param {number} width
 */
function drainsDirectlyToOcean(idx, ocean, flowDirection, width) {
  const downstream = downstreamIndex(idx, width, flowDirection)
  return downstream >= 0 && ocean[downstream]
}

/**
 * @param {number[]} path
 * @param {boolean[]} ocean
 * @param {number} width
 * @param {number} height
 */
function pathEndsAtRimMouth(path, ocean, width, height) {
  if (path.length === 0) return true

  let lastLandIdx = path.length - 1
  while (lastLandIdx >= 0 && ocean[path[lastLandIdx]]) {
    lastLandIdx -= 1
  }
  if (lastLandIdx < 0) return true

  for (let step = lastLandIdx; step < path.length; step += 1) {
    const idx = path[step]
    if (ocean[idx] && isRimCell(idx, width, height)) return true
  }

  if (lastLandIdx < path.length - 1) {
    const outletIdx = path[lastLandIdx + 1]
    if (ocean[outletIdx] && isRimCell(outletIdx, width, height)) return true
  }

  return false
}

function isMountainBaseCell(idx, elevation, ocean, width, height) {
  const x = idx % width
  const y = Math.floor(idx / width)
  const center = elevation[idx]
  let hasHigherNeighbor = false

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nIdx = ny * width + nx
      if (ocean[nIdx]) continue
      if (elevation[nIdx] > center + 1e-5) {
        hasHigherNeighbor = true
      }
    }
  }

  return hasHigherNeighbor
}

/**
 * @param {number} idx
 * @param {Float32Array} elevation
 * @param {boolean[]} ocean
 * @param {Uint8Array | null | undefined} lakeMask
 * @param {number} width
 * @param {number} height
 * @returns {number}
 */
function steepestDescentNeighbor(idx, elevation, ocean, lakeMask, width, height) {
  const x = idx % width
  const y = Math.floor(idx / width)
  let bestIdx = -1
  let bestDrop = 0

  for (let d = 0; d < D8_OFFSETS.length; d += 1) {
    const nx = x + D8_OFFSETS[d][0]
    const ny = y + D8_OFFSETS[d][1]
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
    const nIdx = ny * width + nx
    if (ocean[nIdx] || (lakeMask && lakeMask[nIdx])) continue
    const drop = (elevation[idx] - elevation[nIdx]) / D8_DIST[d]
    if (drop > bestDrop) {
      bestDrop = drop
      bestIdx = nIdx
    }
  }

  return bestIdx
}
