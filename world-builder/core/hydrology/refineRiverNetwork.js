import { SEA_LEVEL } from '../biomeIds.js'
import { createSeededRandom, deriveFieldSeed } from '../noise/seededRandom.js'
import {
  coastalMouthMergeRadiusForGrid,
  riverDisplayFlowCutoffForGrid,
  scaleForGridSize,
} from '../types.js'
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
 * Turn a flow-accumulation river sketch into a connected corridor mask by extracting
 * structural nodes (sources, junctions, mouths) and routing least-resistance paths
 * between them, biased to stay near the sketch.
 * @param {Object} params
 * @param {Uint8Array} params.sketchMask
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {Int16Array} params.flowDirection
 * @param {Float32Array} params.flowAccumulation
 * @param {Uint8Array} [params.lakeMask]
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {number} [params.meanderStrength]
 * @param {number} [params.settlementStepCount]
 * @param {number} [params.mergeStrength]
 * @param {number} [params.channelWear]
 * @param {number} [params.seaLevel]
 * @param {number} [params.navigableFlowCutoffScale]
 * @returns {{ riverNetworkMask: Uint8Array, elevation: Float32Array }}
 */
export function refineRiverNetworkFromSketch({
  sketchMask,
  elevation,
  ocean,
  flowDirection,
  flowAccumulation,
  lakeMask,
  width,
  height,
  geographySeed,
  meanderStrength = 1,
  settlementStepCount = 0,
  mergeStrength = 1,
  channelWear = 0.003,
  seaLevel = SEA_LEVEL,
  navigableFlowCutoffScale = 1,
}) {
  const tributaryCutoff = Math.max(
    2,
    Math.round(riverDisplayFlowCutoffForGrid(width) * navigableFlowCutoffScale),
  )
  const branchKeepRatio = branchKeepRatioForMergeStrength(mergeStrength)
  const mergeRadius = coastalMouthMergeRadiusForGrid(width)

  const { isNode } = markStructuralNodes({
    sketchMask,
    flowAccumulation,
    flowDirection,
    ocean,
    lakeMask,
    width,
    height,
    tributaryCutoff,
    branchKeepRatio,
    mergeRadius,
  })

  const edges = buildRiverEdges({
    isNode,
    sketchMask,
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
    tributaryCutoff,
    branchKeepRatio,
  })

  if (edges.length === 0) {
    return {
      riverNetworkMask: new Uint8Array(width * height),
      elevation: settlementStepCount > 0 ? new Float32Array(elevation) : elevation,
    }
  }

  const routedMask = drawRiverEdges({
    edges,
    elevation,
    ocean,
    sketchMask,
    flowAccumulation,
    width,
    height,
    geographySeed,
    meanderStrength,
  })

  const carvedElevation =
    settlementStepCount > 0
      ? applyRiverChannelCarving({
          elevation,
          riverNetworkMask: routedMask,
          ocean,
          width,
          height,
          geographySeed,
          stepCount: settlementStepCount,
          channelWear,
          seaLevel,
        })
      : new Float32Array(elevation)

  return {
    riverNetworkMask: routedMask,
    elevation: carvedElevation,
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
 * @param {number} mergeStrength
 */
export function branchKeepRatioForMergeStrength(mergeStrength) {
  if (mergeStrength <= 0) return 0.35
  return Math.max(0.08, Math.min(0.9, 0.35 - mergeStrength * 0.12))
}

/**
 * @param {Object} params
 * @param {Uint8Array} params.sketchMask
 * @param {Float32Array} params.flowAccumulation
 * @param {Int16Array} params.flowDirection
 * @param {boolean[]} params.ocean
 * @param {Uint8Array | undefined} params.lakeMask
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.tributaryCutoff
 * @param {number} params.branchKeepRatio
 * @param {number} params.mergeRadius
 */
function markStructuralNodes({
  sketchMask,
  flowAccumulation,
  flowDirection,
  ocean,
  lakeMask,
  width,
  height,
  tributaryCutoff,
  branchKeepRatio,
  mergeRadius,
}) {
  const cellCount = width * height
  const upstream = buildUpstreamAdjacency(cellCount, width, flowDirection, ocean, sketchMask)
  const isNode = new Uint8Array(cellCount)

  /** @type {number[]} */
  const mouthCandidates = []
  for (let idx = 0; idx < cellCount; idx += 1) {
    if (!sketchMask[idx] || ocean[idx]) continue
    if (!cellTouchesOcean(idx, ocean, width, height)) continue
    if (flowAccumulation[idx] >= tributaryCutoff) {
      mouthCandidates.push(idx)
    }
  }

  const mouths = selectCoastalMouths(
    mouthCandidates,
    flowAccumulation,
    width,
    mergeRadius,
    tributaryCutoff,
  )
  for (const mouthIdx of mouths) {
    isNode[mouthIdx] = 1
    markUpstreamStructure(
      mouthIdx,
      upstream,
      sketchMask,
      flowAccumulation,
      tributaryCutoff,
      branchKeepRatio,
      isNode,
      width,
    )
  }

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (!sketchMask[idx] || ocean[idx]) continue
    const downstream = downstreamIndex(idx, width, flowDirection)
    if (downstream < 0 || !lakeMask?.[downstream]) continue
    isNode[idx] = 1
    isNode[downstream] = 1
    markUpstreamStructure(
      idx,
      upstream,
      sketchMask,
      flowAccumulation,
      tributaryCutoff,
      branchKeepRatio,
      isNode,
      width,
    )
  }

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (!sketchMask[idx] || ocean[idx] || isNode[idx]) continue
    if (!isSketchTerminal(idx, sketchMask, flowDirection, ocean, width)) continue
    isNode[idx] = 1
    markUpstreamStructure(
      idx,
      upstream,
      sketchMask,
      flowAccumulation,
      tributaryCutoff,
      branchKeepRatio,
      isNode,
      width,
    )
  }

  return { isNode, mouths }
}

/**
 * @param {number} idx
 * @param {number[][]} upstream
 * @param {Uint8Array} sketchMask
 * @param {Float32Array} flowAccumulation
 * @param {number} tributaryCutoff
 * @param {number} branchKeepRatio
 * @param {Uint8Array} isNode
 * @param {number} width
 */
function markUpstreamStructure(
  idx,
  upstream,
  sketchMask,
  flowAccumulation,
  tributaryCutoff,
  branchKeepRatio,
  isNode,
  width,
) {
  const ups = qualifyingUpstream(
    idx,
    upstream,
    sketchMask,
    flowAccumulation,
    tributaryCutoff,
    branchKeepRatio,
    width,
  )
  if (ups.length === 0) {
    isNode[idx] = 1
    return
  }

  if (ups.length >= 2) {
    isNode[idx] = 1
    for (const upIdx of ups) {
      walkUpstreamToStructure(
        upIdx,
        upstream,
        sketchMask,
        flowAccumulation,
        tributaryCutoff,
        branchKeepRatio,
        isNode,
        width,
      )
    }
    return
  }

  walkUpstreamToStructure(
    ups[0],
    upstream,
    sketchMask,
    flowAccumulation,
    tributaryCutoff,
    branchKeepRatio,
    isNode,
    width,
  )
}

/**
 * @param {number} startIdx
 * @param {number[][]} upstream
 * @param {Uint8Array} sketchMask
 * @param {Float32Array} flowAccumulation
 * @param {number} tributaryCutoff
 * @param {number} branchKeepRatio
 * @param {Uint8Array} isNode
 * @param {number} width
 */
function walkUpstreamToStructure(
  startIdx,
  upstream,
  sketchMask,
  flowAccumulation,
  tributaryCutoff,
  branchKeepRatio,
  isNode,
  width,
) {
  let current = startIdx
  const visited = new Set()

  while (true) {
    if (visited.has(current)) return
    visited.add(current)

    const ups = qualifyingUpstream(
      current,
      upstream,
      sketchMask,
      flowAccumulation,
      tributaryCutoff,
      branchKeepRatio,
      width,
    )
    if (ups.length >= 2) {
      isNode[current] = 1
      markUpstreamStructure(
        current,
        upstream,
        sketchMask,
        flowAccumulation,
        tributaryCutoff,
        branchKeepRatio,
        isNode,
        width,
      )
      return
    }
    if (ups.length === 0) {
      isNode[current] = 1
      return
    }
    current = ups[0]
  }
}

/**
 * @param {Object} params
 * @param {Uint8Array} params.isNode
 * @param {Uint8Array} params.sketchMask
 * @param {Float32Array} params.flowAccumulation
 * @param {Int16Array} params.flowDirection
 * @param {boolean[]} params.ocean
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.tributaryCutoff
 * @param {number} params.branchKeepRatio
 * @returns {Array<{ from: number, to: number }>}
 */
function buildRiverEdges({
  isNode,
  sketchMask,
  flowAccumulation,
  flowDirection,
  ocean,
  width,
  height,
  tributaryCutoff,
  branchKeepRatio,
}) {
  const cellCount = width * height
  const upstream = buildUpstreamAdjacency(cellCount, width, flowDirection, ocean, sketchMask)
  /** @type {Array<{ from: number, to: number }>} */
  const edges = []
  const edgeKeys = new Set()

  const addEdge = (from, to) => {
    if (from < 0 || to < 0 || from === to) return
    if (!sketchMask[from] || !sketchMask[to]) return
    const key = `${from}->${to}`
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push({ from, to })
  }

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (!isNode[idx] || !sketchMask[idx] || ocean[idx]) continue

    const ups = qualifyingUpstream(
      idx,
      upstream,
      sketchMask,
      flowAccumulation,
      tributaryCutoff,
      branchKeepRatio,
      width,
    )
    if (ups.length === 0) continue

    for (const upIdx of ups) {
      const fromNode = resolveUpstreamNode(
        upIdx,
        isNode,
        upstream,
        sketchMask,
        flowAccumulation,
        tributaryCutoff,
        branchKeepRatio,
        width,
      )
      addEdge(fromNode, idx)
    }
  }

  return edges
}

/**
 * @param {number} startIdx
 * @param {Uint8Array} isNode
 * @param {number[][]} upstream
 * @param {Uint8Array} sketchMask
 * @param {Float32Array} flowAccumulation
 * @param {number} tributaryCutoff
 * @param {number} branchKeepRatio
 * @param {number} width
 */
function resolveUpstreamNode(
  startIdx,
  isNode,
  upstream,
  sketchMask,
  flowAccumulation,
  tributaryCutoff,
  branchKeepRatio,
  width,
) {
  let current = startIdx
  const visited = new Set()

  while (!isNode[current]) {
    if (visited.has(current)) return startIdx
    visited.add(current)
    const ups = qualifyingUpstream(
      current,
      upstream,
      sketchMask,
      flowAccumulation,
      tributaryCutoff,
      branchKeepRatio,
      width,
    )
    if (ups.length === 0) return current
    if (ups.length >= 2) return current
    current = ups[0]
  }

  return current
}

/**
 * @param {Object} params
 * @param {Array<{ from: number, to: number }>} params.edges
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {Uint8Array} params.sketchMask
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {number} params.meanderStrength
 */
function drawRiverEdges({
  edges,
  elevation,
  ocean,
  sketchMask,
  flowAccumulation,
  width,
  height,
  geographySeed,
  meanderStrength,
}) {
  const mask = new Uint8Array(width * height)

  for (let edgeId = 0; edgeId < edges.length; edgeId += 1) {
    const { from, to } = edges[edgeId]
    const path = routeRiverEdge({
      fromIdx: from,
      toIdx: to,
      elevation,
      ocean,
      sketchMask,
      width,
      height,
      geographySeed,
      edgeId,
      meanderStrength,
      flow: Math.max(flowAccumulation[from], flowAccumulation[to]),
    })
    for (const idx of path) {
      mask[idx] = 1
    }
  }

  return mask
}

/**
 * @param {Object} params
 * @param {number} params.fromIdx
 * @param {number} params.toIdx
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {Uint8Array} params.sketchMask
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {number} params.edgeId
 * @param {number} params.meanderStrength
 * @param {number} params.flow
 * @returns {number[]}
 */
function routeRiverEdge({
  fromIdx,
  toIdx,
  elevation,
  ocean,
  sketchMask,
  width,
  height,
  geographySeed,
  edgeId,
  meanderStrength,
  flow,
}) {
  const routedSpan = Math.hypot(
    (toIdx % width) - (fromIdx % width),
    Math.floor(toIdx / width) - Math.floor(fromIdx / width),
  )
  if (routedSpan < 2) {
    return [fromIdx, toIdx]
  }

  if (meanderStrength <= 0) {
    const direct = findLeastResistancePath({
      fromIdx,
      toIdx,
      elevation,
      ocean,
      width,
      height,
      heuristicWeight: 0.12,
      preferDownhill: true,
      sketchMask,
    })
    return direct ?? fallbackLine(fromIdx, toIdx, width)
  }

  const seed = deriveFieldSeed(
    geographySeed,
    `river-refine:${edgeId}:${fromIdx}:${toIdx}`,
  )
  const random = createSeededRandom(seed)
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
      preferDownhill: true,
      sketchMask,
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

  return path.length > 0 ? path : fallbackLine(fromIdx, toIdx, width)
}

/**
 * @param {number} fromIdx
 * @param {number} toIdx
 * @param {number} width
 */
function fallbackLine(fromIdx, toIdx, width) {
  const fx = fromIdx % width
  const fy = Math.floor(fromIdx / width)
  const tx = toIdx % width
  const ty = Math.floor(toIdx / width)
  const steps = Math.max(Math.abs(tx - fx), Math.abs(ty - fy), 1)
  /** @type {number[]} */
  const path = []
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps
    const x = Math.round(fx + (tx - fx) * t)
    const y = Math.round(fy + (ty - fy) * t)
    path.push(y * width + x)
  }
  return path
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
function applyRiverChannelCarving({
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
  const random = createSeededRandom(deriveFieldSeed(geographySeed, 'river-channel-carve'))

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
 * @param {number} idx
 * @param {number[][]} upstream
 * @param {Uint8Array} sketchMask
 * @param {Float32Array} flowAccumulation
 * @param {number} tributaryCutoff
 */
function qualifyingUpstream(
  idx,
  upstream,
  sketchMask,
  flowAccumulation,
  tributaryCutoff,
  branchKeepRatio,
  width,
) {
  const qualifying = upstream[idx]
    .filter((upIdx) => sketchMask[upIdx] && flowAccumulation[upIdx] >= tributaryCutoff)
    .sort((left, right) => flowAccumulation[right] - flowAccumulation[left])
  const mainFlow = qualifying.length > 0 ? flowAccumulation[qualifying[0]] : 0
  return dedupeParallelUpstreams(qualifying, flowAccumulation, width).filter(
    (upIdx) => flowAccumulation[upIdx] >= mainFlow * branchKeepRatio,
  )
}

/**
 * @param {number[]} upstreamCells
 * @param {Float32Array} flowAccumulation
 * @param {number} width
 */
function dedupeParallelUpstreams(upstreamCells, flowAccumulation, width) {
  /** @type {number[]} */
  const kept = []
  for (const idx of upstreamCells) {
    const x = idx % width
    const y = Math.floor(idx / width)
    const parallel = kept.some((otherIdx) => {
      const ox = otherIdx % width
      const oy = Math.floor(otherIdx / width)
      return Math.abs(x - ox) <= 2 && Math.abs(y - oy) <= 2
    })
    if (!parallel) kept.push(idx)
  }
  return kept
}

/**
 * @param {number} idx
 * @param {Uint8Array} sketchMask
 * @param {Int16Array} flowDirection
 * @param {boolean[]} ocean
 * @param {number} width
 */
function isSketchTerminal(idx, sketchMask, flowDirection, ocean, width) {
  const downstream = downstreamIndex(idx, width, flowDirection)
  if (downstream < 0) return true
  if (ocean[downstream]) return false
  return !sketchMask[downstream]
}

/**
 * @param {number} cellCount
 * @param {number} width
 * @param {Int16Array} flowDirection
 * @param {boolean[]} ocean
 * @param {Uint8Array} sketchMask
 */
function buildUpstreamAdjacency(cellCount, width, flowDirection, ocean, sketchMask) {
  /** @type {number[][]} */
  const upstream = Array.from({ length: cellCount }, () => [])
  for (let idx = 0; idx < cellCount; idx += 1) {
    if (ocean[idx] || !sketchMask[idx]) continue
    const downstream = downstreamIndex(idx, width, flowDirection)
    if (downstream < 0 || ocean[downstream] || !sketchMask[downstream]) continue
    upstream[downstream].push(idx)
  }
  return upstream
}

/**
 * @param {number[]} candidates
 * @param {Float32Array} flowAccumulation
 * @param {number} width
 * @param {number} mergeRadius
 * @param {number} mouthCutoff
 */
function selectCoastalMouths(candidates, flowAccumulation, width, mergeRadius, mouthCutoff) {
  const qualifying = candidates.filter((idx) => flowAccumulation[idx] >= mouthCutoff)
  qualifying.sort((left, right) => flowAccumulation[right] - flowAccumulation[left])

  /** @type {number[]} */
  const selected = []
  for (const idx of qualifying) {
    const x = idx % width
    const y = Math.floor(idx / width)
    const tooClose = selected.some((otherIdx) => {
      const ox = otherIdx % width
      const oy = Math.floor(otherIdx / width)
      return Math.hypot(x - ox, y - oy) < mergeRadius
    })
    if (!tooClose) {
      selected.push(idx)
    }
  }
  return selected
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
