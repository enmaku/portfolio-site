import { SEA_LEVEL } from '../biomeIds.js'
import { createSeededRandom, deriveFieldSeed } from '../noise/seededRandom.js'
import { scaleForGridSize } from '../types.js'
import { downstreamIndex } from './computeFlowAccumulation.js'
import {
  buildFractalWaypoints,
  findLeastResistancePath,
  snapToValleyCell,
} from './riverPathfinding.js'

const D8_OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
]
const D8_DIST = [1.414, 1, 1.414, 1, 1, 1.414, 1, 1.414]

/**
 * After the river network is established, meander corridors with fractal offsets,
 * carve local channels, and settle paths into nearby valley cells.
 * @param {Object} params
 * @param {Uint8Array} params.riverNetworkMask
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {Int16Array} params.flowDirection
 * @param {Float32Array} params.flowAccumulation
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {number} [params.meanderStrength]
 * @param {number} [params.settlementStepCount]
 * @param {number} [params.mergeStrength]
 * @param {number} [params.channelWear]
 * @param {number} [params.seaLevel]
 * @returns {{ riverNetworkMask: Uint8Array, elevation: Float32Array }}
 */
export function meanderAndSettleRivers({
  riverNetworkMask,
  elevation,
  ocean,
  flowDirection,
  flowAccumulation,
  width,
  height,
  geographySeed,
  meanderStrength = 1,
  settlementStepCount = 8,
  mergeStrength = 1,
  channelWear = 0.003,
  seaLevel = SEA_LEVEL,
}) {
  if (meanderStrength <= 0 && settlementStepCount <= 0 && mergeStrength <= 0) {
    return {
      riverNetworkMask,
      elevation,
    }
  }

  const meanderedMask = meanderStrength > 0
    ? applyRiverMeandering({
        riverNetworkMask,
        elevation,
        ocean,
        flowDirection,
        flowAccumulation,
        width,
        height,
        geographySeed,
        meanderStrength,
      })
    : new Uint8Array(riverNetworkMask)

  const settledElevation = settlementStepCount > 0
    ? applyRiverSettlementErosion({
        elevation,
        riverNetworkMask: meanderedMask,
        ocean,
        width,
        height,
        geographySeed,
        stepCount: settlementStepCount,
        channelWear,
        seaLevel,
      })
    : new Float32Array(elevation)

  const settledMask = settlementStepCount > 0
    ? settleMaskIntoValleys(
        meanderedMask,
        settledElevation,
        ocean,
        width,
        height,
        mergeStrength <= 0,
      )
    : meanderedMask

  const mergedMask = mergeStrength > 0
    ? mergeParallelRiverBranches({
        riverNetworkMask: settledMask,
        elevation: settledElevation,
        flowAccumulation,
        ocean,
        flowDirection,
        width,
        height,
        mergeStrength,
      })
    : settledMask

  return {
    riverNetworkMask: mergedMask,
    elevation: settledElevation,
  }
}

/**
 * @param {number} gridSize
 * @param {number} steps
 */
export function riverSettlementStepsForGrid(gridSize, steps) {
  if (steps <= 0) return 0
  const scale = scaleForGridSize(1, gridSize)
  return Math.max(1, Math.round(steps * Math.sqrt(scale)))
}

/**
 * @param {Object} params
 * @param {Uint8Array} params.riverNetworkMask
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {Int16Array} params.flowDirection
 * @param {Float32Array} params.flowAccumulation
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {number} params.meanderStrength
 * @returns {Uint8Array}
 */
function applyRiverMeandering({
  riverNetworkMask,
  elevation,
  ocean,
  flowDirection,
  flowAccumulation,
  width,
  height,
  geographySeed,
  meanderStrength,
}) {
  const segments = extractRiverSegments({
    riverNetworkMask,
    flowDirection,
    elevation,
    ocean,
    width,
    height,
  })
  const mask = new Uint8Array(riverNetworkMask.length)
  const minSegmentLength = Math.max(6, Math.round(8 * meanderStrength))

  for (let segmentId = 0; segmentId < segments.length; segmentId += 1) {
    const segment = segments[segmentId]
    if (segment.length < minSegmentLength) {
      for (const idx of segment) {
        mask[idx] = 1
      }
      continue
    }

    const meandered = meanderSegment({
      segment,
      elevation,
      ocean,
      width,
      height,
      geographySeed,
      segmentId,
      meanderStrength,
      flowAccumulation,
    })
    for (const idx of meandered) {
      mask[idx] = 1
    }
  }

  for (let idx = 0; idx < riverNetworkMask.length; idx += 1) {
    if (riverNetworkMask[idx] && !mask[idx]) {
      mask[idx] = 1
    }
  }

  return mask
}

/**
 * @param {Object} params
 * @param {Uint8Array} params.riverNetworkMask
 * @param {Int16Array} params.flowDirection
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {number} params.width
 * @param {number} params.height
 * @returns {number[][]}
 */
function extractRiverSegments({
  riverNetworkMask,
  flowDirection,
  elevation,
  ocean,
  width,
  height,
}) {
  const cellCount = width * height
  const degree = computeRiverDegree(riverNetworkMask, width, height)
  const visited = new Uint8Array(cellCount)
  /** @type {number[][]} */
  const segments = []

  const traceFrom = (startIdx) => {
    /** @type {number[]} */
    const path = []
    let current = startIdx

    while (current >= 0 && riverNetworkMask[current] && !visited[current]) {
      path.push(current)
      visited[current] = 1

      const downstream = downstreamRiverCell({
        idx: current,
        riverNetworkMask,
        flowDirection,
        elevation,
        ocean,
        width,
        height,
      })
      if (downstream < 0) break
      if (degree[downstream] >= 3 && path.length > 0) {
        path.push(downstream)
        visited[downstream] = 1
        break
      }
      if (visited[downstream]) break
      current = downstream
    }

    if (path.length >= 2) {
      segments.push(path)
    }
  }

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (!riverNetworkMask[idx] || visited[idx]) continue
    if (degree[idx] === 1) {
      traceFrom(idx)
    }
  }

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (!riverNetworkMask[idx] || visited[idx] || degree[idx] < 3) continue
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue
        const nx = (idx % width) + dx
        const ny = Math.floor(idx / width) + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const nIdx = ny * width + nx
        if (!riverNetworkMask[nIdx] || visited[nIdx]) continue
        traceFrom(nIdx)
      }
    }
  }

  return segments
}

/**
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 */
function computeRiverDegree(mask, width, height) {
  const degree = new Uint8Array(mask.length)
  for (let idx = 0; idx < mask.length; idx += 1) {
    if (!mask[idx]) continue
    const x = idx % width
    const y = Math.floor(idx / width)
    let count = 0
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        if (mask[ny * width + nx]) count += 1
      }
    }
    degree[idx] = count
  }
  return degree
}

/**
 * @param {Object} params
 * @param {number} params.idx
 * @param {Uint8Array} params.riverNetworkMask
 * @param {Int16Array} params.flowDirection
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {number} params.width
 * @param {number} params.height
 */
function downstreamRiverCell({
  idx,
  riverNetworkMask,
  flowDirection,
  elevation,
  ocean,
  width,
  height,
}) {
  const downstream = downstreamIndex(idx, width, flowDirection)
  if (downstream >= 0 && riverNetworkMask[downstream] && !ocean[downstream]) {
    return downstream
  }

  const x = idx % width
  const y = Math.floor(idx / width)
  let bestIdx = -1
  let bestElev = Number.POSITIVE_INFINITY

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nIdx = ny * width + nx
      if (!riverNetworkMask[nIdx] || ocean[nIdx]) continue
      if (elevation[nIdx] < bestElev) {
        bestElev = elevation[nIdx]
        bestIdx = nIdx
      }
    }
  }

  return bestIdx
}

/**
 * @param {Object} params
 * @param {number[]} params.segment
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {number} params.segmentId
 * @param {number} params.meanderStrength
 * @param {Float32Array} params.flowAccumulation
 * @returns {number[]}
 */
function meanderSegment({
  segment,
  elevation,
  ocean,
  width,
  height,
  geographySeed,
  segmentId,
  meanderStrength,
  flowAccumulation,
}) {
  const chunkSize = Math.max(8, Math.round(20 / Math.sqrt(meanderStrength)))
  /** @type {number[]} */
  const anchorPoints = [segment[0]]
  for (let i = chunkSize; i < segment.length - 1; i += chunkSize) {
    anchorPoints.push(segment[i])
  }
  anchorPoints.push(segment[segment.length - 1])

  /** @type {number[]} */
  const path = []
  const seen = new Set()

  for (let i = 0; i < anchorPoints.length - 1; i += 1) {
    const fromIdx = anchorPoints[i]
    const toIdx = anchorPoints[i + 1]
    const chunk = meanderBetween({
      fromIdx,
      toIdx,
      elevation,
      ocean,
      width,
      height,
      geographySeed,
      segmentId,
      chunkId: i,
      meanderStrength,
      flow: Math.max(flowAccumulation[fromIdx], flowAccumulation[toIdx]),
    })
    for (const idx of chunk) {
      if (seen.has(idx)) continue
      seen.add(idx)
      path.push(idx)
    }
  }

  return path.length > 0 ? path : segment
}

/**
 * @param {Object} params
 * @param {number} params.fromIdx
 * @param {number} params.toIdx
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {number} params.segmentId
 * @param {number} params.chunkId
 * @param {number} params.meanderStrength
 * @param {number} params.flow
 * @returns {number[]}
 */
function meanderBetween({
  fromIdx,
  toIdx,
  elevation,
  ocean,
  width,
  height,
  geographySeed,
  segmentId,
  chunkId,
  meanderStrength,
  flow,
}) {
  const seed = deriveFieldSeed(
    geographySeed,
    `river-meander:${segmentId}:${chunkId}:${fromIdx}:${toIdx}`,
  )
  const random = createSeededRandom(seed)
  const routedSpan = Math.hypot(
    (toIdx % width) - (fromIdx % width),
    Math.floor(toIdx / width) - Math.floor(fromIdx / width),
  )
  if (routedSpan < 3) {
    return [fromIdx, toIdx]
  }

  const flowBoost = Math.min(1.4, 0.85 + Math.log10(Math.max(2, flow)) * 0.08)
  const wiggleScale = meanderStrength * flowBoost
  const depth =
    routedSpan < 12 ? 2 : routedSpan < 32 ? 3 : routedSpan < 96 ? 4 : 5
  const valleyRadius = Math.max(2, Math.round(routedSpan * 0.1 * wiggleScale))

  const waypoints = buildFractalWaypoints({
    fromIdx,
    toIdx,
    width,
    height,
    random,
    depth,
    wiggleScale,
  }).map((idx) =>
    snapToValleyCell(idx, elevation, ocean, width, height, valleyRadius),
  )

  /** @type {number[]} */
  const path = []
  const seen = new Set()
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const segment = findLeastResistancePath({
      fromIdx: waypoints[i],
      toIdx: waypoints[i + 1],
      elevation,
      ocean,
      width,
      height,
      heuristicWeight: 0.12,
    })
    if (!segment) {
      path.push(waypoints[i])
      if (i === waypoints.length - 2) {
        path.push(waypoints[i + 1])
      }
      continue
    }
    for (const idx of segment) {
      if (seen.has(idx)) continue
      seen.add(idx)
      path.push(idx)
    }
  }

  return path.length > 0 ? path : [fromIdx, toIdx]
}

/**
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Uint8Array} params.riverNetworkMask
 * @param {boolean[]} params.ocean
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {number} params.stepCount
 * @param {number} params.channelWear
 * @param {number} params.seaLevel
 */
function applyRiverSettlementErosion({
  elevation,
  riverNetworkMask,
  ocean,
  width,
  height,
  geographySeed,
  stepCount,
  channelWear,
  seaLevel,
}) {
  const out = new Float32Array(elevation)
  const random = createSeededRandom(deriveFieldSeed(geographySeed, 'river-settlement'))

  for (let step = 0; step < stepCount; step += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x
        if (!riverNetworkMask[idx] || ocean[idx] || out[idx] < seaLevel) continue

        let steepestDrop = 0
        let steepestIdx = -1

        for (let d = 0; d < D8_OFFSETS.length; d += 1) {
          const nx = x + D8_OFFSETS[d][0]
          const ny = y + D8_OFFSETS[d][1]
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const nIdx = ny * width + nx
          if (ocean[nIdx]) continue
          const drop = (out[idx] - out[nIdx]) / D8_DIST[d]
          if (drop > steepestDrop) {
            steepestDrop = drop
            steepestIdx = nIdx
          }
        }

        if (steepestDrop <= 0) continue

        const tieBreak = random() * 0.0003
        const wear = channelWear * (0.6 + steepestDrop * 4) + tieBreak
        out[idx] = Math.max(seaLevel, out[idx] - wear)
        if (steepestIdx >= 0) {
          out[steepestIdx] = Math.max(seaLevel, out[steepestIdx] - wear * 0.45)
        }

        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            const nIdx = ny * width + nx
            if (ocean[nIdx]) continue
            out[nIdx] = Math.max(seaLevel, out[nIdx] - wear * 0.12)
          }
        }
      }
    }
  }

  return out
}

/**
 * @param {Uint8Array} mask
 * @param {Float32Array} elevation
 * @param {boolean[]} ocean
 * @param {number} width
 * @param {number} height
 * @param {boolean} preserveOriginal
 */
function settleMaskIntoValleys(mask, elevation, ocean, width, height, preserveOriginal) {
  const settled = new Uint8Array(mask.length)
  for (let idx = 0; idx < mask.length; idx += 1) {
    if (!mask[idx]) continue
    const valleyIdx = snapToValleyCell(idx, elevation, ocean, width, height, 2)
    settled[valleyIdx] = 1
  }

  if (preserveOriginal) {
    for (let idx = 0; idx < mask.length; idx += 1) {
      if (mask[idx]) settled[idx] = 1
    }
  }

  return settled
}

/**
 * Collapse parallel river strands toward the primary channel without splitting the network.
 * Only removes cells that are redundant (parallel duplicates); bridge and corridor cells
 * that hold the graph together are kept via articulation checks.
 * @param {Object} params
 * @param {Uint8Array} params.riverNetworkMask
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.flowAccumulation
 * @param {boolean[]} params.ocean
 * @param {Int16Array} params.flowDirection
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.mergeStrength
 * @returns {Uint8Array}
 */
export function mergeParallelRiverBranches({
  riverNetworkMask,
  elevation,
  flowAccumulation,
  ocean,
  flowDirection,
  width,
  height,
  mergeStrength,
}) {
  if (mergeStrength <= 0) {
    return new Uint8Array(riverNetworkMask)
  }

  const mergeRadius = Math.max(2, Math.round(1 + mergeStrength * 2.5))
  const flowKeepRatio = Math.min(0.85, 0.35 + mergeStrength * 0.15)
  const branchKeepRatio = Math.min(0.9, 0.15 + mergeStrength * 0.22)
  const backbone = extractRiverBackbone({
    riverNetworkMask,
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
    branchKeepRatio,
  })

  const candidates = collectParallelRemovalCandidates({
    riverNetworkMask,
    elevation,
    flowAccumulation,
    ocean,
    backbone,
    width,
    height,
    mergeRadius,
    flowKeepRatio,
  })

  const merged = new Uint8Array(riverNetworkMask)
  for (const { idx } of candidates) {
    if (!merged[idx]) continue
    merged[idx] = 0
    if (wouldSplitRiverNetwork(merged, idx, width, height)) {
      merged[idx] = 1
    }
  }

  return merged
}

/**
 * @param {Object} params
 * @param {Uint8Array} params.riverNetworkMask
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.flowAccumulation
 * @param {boolean[]} params.ocean
 * @param {Uint8Array} params.backbone
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.mergeRadius
 * @param {number} params.flowKeepRatio
 * @returns {Array<{ idx: number, score: number }>}
 */
function collectParallelRemovalCandidates({
  riverNetworkMask,
  elevation,
  flowAccumulation,
  ocean,
  backbone,
  width,
  height,
  mergeRadius,
  flowKeepRatio,
}) {
  /** @type {Array<{ idx: number, score: number }>} */
  const candidates = []

  for (let idx = 0; idx < riverNetworkMask.length; idx += 1) {
    if (!riverNetworkMask[idx] || ocean[idx] || backbone[idx]) continue

    const localMaxFlow = maxLocalRiverFlow(
      idx,
      riverNetworkMask,
      flowAccumulation,
      width,
      height,
      mergeRadius,
    )
    const flowRatio = localMaxFlow > 0 ? flowAccumulation[idx] / localMaxFlow : 1
    if (flowRatio >= flowKeepRatio) continue

    const onValleyFloor = isValleyFloorAmongRiverCells(
      idx,
      riverNetworkMask,
      elevation,
      width,
      height,
      mergeRadius,
    )
    if (onValleyFloor && flowRatio >= flowKeepRatio * 0.75) continue

    let score = 1 - flowRatio
    if (!onValleyFloor) score += 0.35
    candidates.push({ idx, score })
  }

  candidates.sort((left, right) => right.score - left.score)
  return candidates
}

/**
 * @param {Uint8Array} mask
 * @param {number} removedIdx
 * @param {number} width
 * @param {number} height
 */
function wouldSplitRiverNetwork(mask, removedIdx, width, height) {
  const neighbors = collectRiverNeighborIndices(mask, removedIdx, width, height)
  if (neighbors.length <= 1) return false

  const visited = new Set()
  let components = 0
  for (const startIdx of neighbors) {
    if (visited.has(startIdx)) continue
    components += 1
    floodRiverNeighbors(startIdx, mask, removedIdx, visited, width, height)
  }

  return components > 1
}

/**
 * @param {Uint8Array} mask
 * @param {number} idx
 * @param {number} width
 * @param {number} height
 * @returns {number[]}
 */
function collectRiverNeighborIndices(mask, idx, width, height) {
  const x = idx % width
  const y = Math.floor(idx / width)
  /** @type {number[]} */
  const neighbors = []

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nIdx = ny * width + nx
      if (mask[nIdx]) neighbors.push(nIdx)
    }
  }

  return neighbors
}

/**
 * @param {number} startIdx
 * @param {Uint8Array} mask
 * @param {number} excludedIdx
 * @param {Set<number>} visited
 * @param {number} width
 * @param {number} height
 */
function floodRiverNeighbors(startIdx, mask, excludedIdx, visited, width, height) {
  /** @type {number[]} */
  const stack = [startIdx]
  visited.add(startIdx)

  while (stack.length > 0) {
    const idx = stack.pop()
    const x = idx % width
    const y = Math.floor(idx / width)

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const nIdx = ny * width + nx
        if (nIdx === excludedIdx || !mask[nIdx] || visited.has(nIdx)) continue
        visited.add(nIdx)
        stack.push(nIdx)
      }
    }
  }
}

/**
 * @param {Object} params
 * @param {Uint8Array} params.riverNetworkMask
 * @param {Float32Array} params.flowAccumulation
 * @param {Int16Array} params.flowDirection
 * @param {boolean[]} params.ocean
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.branchKeepRatio
 */
function extractRiverBackbone({
  riverNetworkMask,
  flowAccumulation,
  flowDirection,
  ocean,
  width,
  height,
  branchKeepRatio,
}) {
  const cellCount = width * height
  const upstream = buildUpstreamAdjacency(cellCount, width, flowDirection, ocean, riverNetworkMask)
  const backbone = new Uint8Array(cellCount)
  const mergeRadius = Math.max(3, Math.round(2 + (1 - branchKeepRatio) * 8))

  /** @type {number[]} */
  const mouthCandidates = []
  for (let idx = 0; idx < cellCount; idx += 1) {
    if (!riverNetworkMask[idx] || ocean[idx]) continue
    if (!cellTouchesOcean(idx, ocean, width, height)) continue
    mouthCandidates.push(idx)
  }

  mouthCandidates.sort((left, right) => flowAccumulation[right] - flowAccumulation[left])
  /** @type {number[]} */
  const majorMouths = []
  for (const idx of mouthCandidates) {
    const x = idx % width
    const y = Math.floor(idx / width)
    const tooClose = majorMouths.some((otherIdx) => {
      const ox = otherIdx % width
      const oy = Math.floor(otherIdx / width)
      return Math.hypot(x - ox, y - oy) < mergeRadius
    })
    if (!tooClose) {
      majorMouths.push(idx)
    }
  }

  for (const mouthIdx of majorMouths) {
    traceBackboneUpstream(
      mouthIdx,
      backbone,
      upstream,
      riverNetworkMask,
      flowAccumulation,
      branchKeepRatio,
    )
  }

  return backbone
}

/**
 * @param {number} cellCount
 * @param {number} width
 * @param {Int16Array} flowDirection
 * @param {boolean[]} ocean
 * @param {Uint8Array} riverNetworkMask
 */
function buildUpstreamAdjacency(cellCount, width, flowDirection, ocean, riverNetworkMask) {
  /** @type {number[][]} */
  const upstream = Array.from({ length: cellCount }, () => [])
  for (let idx = 0; idx < cellCount; idx += 1) {
    if (ocean[idx] || !riverNetworkMask[idx]) continue
    const downstream = downstreamIndex(idx, width, flowDirection)
    if (downstream < 0 || ocean[downstream] || !riverNetworkMask[downstream]) continue
    upstream[downstream].push(idx)
  }
  return upstream
}

/**
 * @param {number} idx
 * @param {Uint8Array} backbone
 * @param {number[][]} upstream
 * @param {Uint8Array} mask
 * @param {Float32Array} flowAccumulation
 * @param {number} branchKeepRatio
 */
function traceBackboneUpstream(
  idx,
  backbone,
  upstream,
  mask,
  flowAccumulation,
  branchKeepRatio,
) {
  if (backbone[idx]) return
  backbone[idx] = 1

  const ups = upstream[idx].filter((upIdx) => mask[upIdx])
  if (ups.length === 0) return

  ups.sort((left, right) => flowAccumulation[right] - flowAccumulation[left])
  const mainFlow = flowAccumulation[ups[0]]
  for (const upIdx of ups) {
    if (flowAccumulation[upIdx] >= mainFlow * branchKeepRatio) {
      traceBackboneUpstream(upIdx, backbone, upstream, mask, flowAccumulation, branchKeepRatio)
    }
  }
}

/**
 * @param {number} idx
 * @param {boolean[]} ocean
 * @param {number} width
 * @param {number} height
 */
function cellTouchesOcean(idx, ocean, width, height) {
  const x = idx % width
  const y = Math.floor(idx / width)
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      if (ocean[ny * width + nx]) return true
    }
  }
  return false
}

/**
 * @param {number} idx
 * @param {Uint8Array} mask
 * @param {Float32Array} flowAccumulation
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 */
function maxLocalRiverFlow(idx, mask, flowAccumulation, width, height, radius) {
  const x = idx % width
  const y = Math.floor(idx / width)
  let maxFlow = flowAccumulation[idx]
  const radiusSq = radius * radius

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > radiusSq) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nIdx = ny * width + nx
      if (!mask[nIdx]) continue
      if (flowAccumulation[nIdx] > maxFlow) maxFlow = flowAccumulation[nIdx]
    }
  }

  return maxFlow
}

/**
 * @param {number} idx
 * @param {Uint8Array} mask
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 */
function isValleyFloorAmongRiverCells(idx, mask, elevation, width, height, radius) {
  const x = idx % width
  const y = Math.floor(idx / width)
  const localElev = elevation[idx]
  const radiusSq = radius * radius

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx === 0 && dy === 0) continue
      if (dx * dx + dy * dy > radiusSq) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nIdx = ny * width + nx
      if (!mask[nIdx]) continue
      if (elevation[nIdx] + 0.0008 < localElev) return false
    }
  }

  return true
}
