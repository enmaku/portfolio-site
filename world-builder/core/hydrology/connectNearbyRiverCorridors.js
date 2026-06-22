import { scaleForGridSize } from '../types.js'
import { createSeededRandom, deriveFieldSeed } from '../noise/seededRandom.js'
import { downstreamIndex } from './computeFlowAccumulation.js'
import {
  angleDegrees,
  buildFractalWaypoints,
  findLeastResistancePath,
  snapToValleyCell,
  unitVector,
} from './riverPathfinding.js'

/** @typedef {{ x: number, y: number }} Vec2 */
/** @typedef {{ minX: number, minY: number, maxX: number, maxY: number }} ComponentBounds */

/**
 * When two river corridors pass within the attraction radius, connect them along the
 * lowest-resistance path (preferring low, downhill terrain).
 * @param {Object} params
 * @param {Uint8Array} params.riverNetworkMask
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.attractionRadius]
 * @param {number} [params.geographySeed]
 * @param {Int16Array} [params.flowDirection]
 * @returns {Uint8Array}
 */
export function connectNearbyRiverCorridors({
  riverNetworkMask,
  elevation,
  ocean,
  width,
  height,
  attractionRadius = 0,
  geographySeed = 0,
  flowDirection,
}) {
  if (attractionRadius <= 0) {
    return riverNetworkMask
  }

  const mask = new Uint8Array(riverNetworkMask)
  const components = labelRiverComponents(mask, width, height)
  if (components.length < 2) {
    return mask
  }

  const sampled = components.map((cells) => sampleCells(cells, 48))
  const bounds = components.map((cells) => boundsForCells(cells, width))
  const reachesOceanViaMask = components.map((cells) =>
    componentReachesOceanViaMask(cells, mask, ocean, flowDirection, width, height),
  )

  /** @type {{ a: number, b: number, dist: number, fromIdx: number, toIdx: number }[]} */
  const candidates = []

  for (let i = 0; i < components.length; i += 1) {
    for (let j = i + 1; j < components.length; j += 1) {
      if (reachesOceanViaMask[i] && reachesOceanViaMask[j]) continue
      if (bboxDistance(bounds[i], bounds[j]) > attractionRadius) continue

      let fromComponent = i
      let toComponent = j
      if (reachesOceanViaMask[i] && !reachesOceanViaMask[j]) {
        fromComponent = j
        toComponent = i
      } else if (!reachesOceanViaMask[i] && reachesOceanViaMask[j]) {
        fromComponent = i
        toComponent = j
      } else if (meanCellElevation(components[j], elevation) > meanCellElevation(components[i], elevation)) {
        fromComponent = j
        toComponent = i
      }
      const closest = bestConnectionPair({
        orphanCells: sampled[fromComponent],
        seaCells: sampled[toComponent],
        elevation,
        mask,
        flowDirection,
        width,
        height,
        maxDist: attractionRadius,
      })
      if (!closest) continue
      candidates.push({
        a: fromComponent,
        b: toComponent,
        dist: closest.dist,
        fromIdx: closest.fromIdx,
        toIdx: closest.toIdx,
      })
    }
  }

  if (candidates.length === 0) {
    return mask
  }

  candidates.sort((left, right) => left.dist - right.dist)

  const parent = components.map((_, idx) => idx)
  const find = (idx) => {
    if (parent[idx] === idx) return idx
    parent[idx] = find(parent[idx])
    return parent[idx]
  }
  const unite = (a, b) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA === rootB) return false
    parent[rootB] = rootA
    return true
  }

  for (const candidate of candidates) {
    if (!unite(candidate.a, candidate.b)) continue
    const path = findMeanderingRiverPath({
      fromIdx: candidate.fromIdx,
      toIdx: candidate.toIdx,
      elevation,
      ocean,
      mask,
      flowDirection,
      width,
      height,
      geographySeed,
    })
    if (!path) continue
    for (const idx of path) {
      mask[idx] = 1
    }
  }

  return mask
}

/**
 * @param {number} gridSize
 * @param {number} scale
 */
export function riverAttractionRadiusForGrid(gridSize, scale) {
  if (scale <= 0) return 0
  return Math.max(4, Math.round(scaleForGridSize(64, gridSize) * scale))
}

/**
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @returns {number[][]}
 */
function labelRiverComponents(mask, width, height) {
  const cellCount = width * height
  const labels = new Int32Array(cellCount).fill(-1)
  /** @type {number[][]} */
  const components = []
  let nextLabel = 0

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (!mask[idx] || labels[idx] >= 0) continue

    /** @type {number[]} */
    const cells = []
    /** @type {number[]} */
    const stack = [idx]
    labels[idx] = nextLabel

    while (stack.length > 0) {
      const current = stack.pop()
      cells.push(current)
      const x = current % width
      const y = Math.floor(current / width)

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const nIdx = ny * width + nx
          if (!mask[nIdx] || labels[nIdx] >= 0) continue
          labels[nIdx] = nextLabel
          stack.push(nIdx)
        }
      }
    }

    components.push(cells)
    nextLabel += 1
  }

  return components
}

/**
 * @param {number[]} cells
 * @param {number} maxSamples
 */
function sampleCells(cells, maxSamples) {
  if (cells.length <= maxSamples) return cells
  const step = Math.max(1, Math.floor(cells.length / maxSamples))
  /** @type {number[]} */
  const sampled = []
  for (let i = 0; i < cells.length; i += step) {
    sampled.push(cells[i])
  }
  return sampled
}

/**
 * @param {number[]} cells
 * @param {number} width
 * @returns {ComponentBounds}
 */
function boundsForCells(cells, width) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const idx of cells) {
    const x = idx % width
    const y = Math.floor(idx / width)
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

/**
 * @param {number[]} cells
 * @param {Float32Array} elevation
 */
function meanCellElevation(cells, elevation) {
  if (cells.length === 0) return 0
  let sum = 0
  for (const idx of cells) {
    sum += elevation[idx]
  }
  return sum / cells.length
}

/**
 * @param {ComponentBounds} left
 * @param {ComponentBounds} right
 */
function bboxDistance(left, right) {
  const dx = Math.max(0, left.minX - right.maxX, right.minX - left.maxX)
  const dy = Math.max(0, left.minY - right.maxY, right.minY - left.maxY)
  return Math.hypot(dx, dy)
}

/**
 * @param {number[]} cells
 * @param {Uint8Array} mask
 * @param {boolean[]} ocean
 * @param {Int16Array | undefined} flowDirection
 * @param {number} width
 * @param {number} height
 */
function componentReachesOceanViaMask(cells, mask, ocean, flowDirection, width, height) {
  for (const idx of cells) {
    if (cellReachesOceanViaMask(idx, mask, ocean, flowDirection, width, height)) {
      return true
    }
  }
  return false
}

/**
 * @param {number} idx
 * @param {Uint8Array} mask
 * @param {boolean[]} ocean
 * @param {Int16Array | undefined} flowDirection
 * @param {number} width
 * @param {number} height
 */
function cellReachesOceanViaMask(idx, mask, ocean, flowDirection, width, height) {
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
  if (!flowDirection) return false

  const visitLimit = width * height
  const seen = new Set()
  let current = idx
  for (let step = 0; step < visitLimit; step += 1) {
    if (seen.has(current)) return false
    seen.add(current)
    const downstream = downstreamIndex(current, width, flowDirection)
    if (downstream < 0) return false
    if (ocean[downstream]) return true
    if (!mask[downstream]) return false
    current = downstream
  }
  return false
}

/**
 * @param {Object} params
 * @param {number[]} params.orphanCells
 * @param {number[]} params.seaCells
 * @param {Float32Array} params.elevation
 * @param {Uint8Array} params.mask
 * @param {Int16Array | undefined} params.flowDirection
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.maxDist
 */
function bestConnectionPair({
  orphanCells,
  seaCells,
  elevation,
  mask,
  flowDirection,
  width,
  height,
  maxDist,
}) {
  let bestScore = Number.POSITIVE_INFINITY
  let fromIdx = -1
  let toIdx = -1
  let bestDist = maxDist + 1

  for (const orphanIdx of orphanCells) {
    const ox = orphanIdx % width
    const oy = Math.floor(orphanIdx / width)
    for (const seaIdx of seaCells) {
      const sx = seaIdx % width
      const sy = Math.floor(seaIdx / width)
      const dist = Math.hypot(ox - sx, oy - sy)
      if (dist > maxDist) continue

      const score = scoreConnectionPair({
        fromIdx: orphanIdx,
        toIdx: seaIdx,
        dist,
        elevation,
        mask,
        flowDirection,
        width,
        height,
      })
      if (score < bestScore) {
        bestScore = score
        bestDist = dist
        fromIdx = orphanIdx
        toIdx = seaIdx
      }
    }
  }

  if (fromIdx < 0) return null
  return { fromIdx, toIdx, dist: bestDist }
}

/**
 * @param {Object} params
 * @param {number} params.fromIdx
 * @param {number} params.toIdx
 * @param {number} params.dist
 * @param {Float32Array} params.elevation
 * @param {Uint8Array} params.mask
 * @param {Int16Array | undefined} params.flowDirection
 * @param {number} params.width
 * @param {number} params.height
 */
function scoreConnectionPair({
  fromIdx,
  toIdx,
  dist,
  elevation,
  mask,
  flowDirection,
  width,
  height,
}) {
  const drop = elevation[fromIdx] - elevation[toIdx]
  if (drop < -0.002) return Number.POSITIVE_INFINITY

  let score = dist - Math.min(drop, 0.08) * 24
  if (drop < 0.001) score += 6

  if (!flowDirection) return score

  const pathStart = stepUpstreamOnRiver(fromIdx, mask, flowDirection, width, height, 1)
  const pathGoal = mergeApproachGoal({
    fromIdx,
    toIdx,
    mask,
    flowDirection,
    elevation: null,
    ocean: null,
    width,
    height,
    skipSnap: true,
  })
  const conn = unitVector(pathStart, pathGoal, width)
  const flowFrom = riverFlowVector(fromIdx, mask, flowDirection, width, height)
  const flowTo = riverFlowVector(toIdx, mask, flowDirection, width, height)
  if (!flowFrom || !flowTo) return score

  const mergeAngleDeg = angleDegrees({ x: -conn.x, y: -conn.y }, flowTo)
  const leaveAngleDeg = angleDegrees(flowFrom, conn)

  if (mergeAngleDeg > 70 && mergeAngleDeg < 110) score += 10
  if (mergeAngleDeg >= 110) score += 5
  if (mergeAngleDeg < 20) score += 4
  if (leaveAngleDeg > 55) score += 4

  return score
}

/**
 * @param {number} fromIdx
 * @param {number} toIdx
 * @param {Uint8Array} mask
 * @param {Int16Array} flowDirection
 * @param {number} width
 * @param {number} height
 */
function riverFlowVector(fromIdx, mask, flowDirection, width, height) {
  const downstream = downstreamIndex(fromIdx, width, flowDirection)
  if (downstream >= 0 && mask[downstream]) {
    return unitVector(fromIdx, downstream, width)
  }

  const upstream = findUpstreamOnMask(fromIdx, mask, flowDirection, width, height)
  if (upstream >= 0) {
    return unitVector(upstream, fromIdx, width)
  }

  return dominantMaskAxis(fromIdx, mask, width, height)
}

/**
 * @param {number} idx
 * @param {Uint8Array} mask
 * @param {Int16Array} flowDirection
 * @param {number} width
 * @param {number} height
 */
function findUpstreamOnMask(idx, mask, flowDirection, width, height) {
  const x = idx % width
  const y = Math.floor(idx / width)
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nIdx = ny * width + nx
      if (!mask[nIdx]) continue
      if (downstreamIndex(nIdx, width, flowDirection) === idx) {
        return nIdx
      }
    }
  }
  return -1
}

/**
 * @param {number} idx
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @returns {Vec2 | null}
 */
function dominantMaskAxis(idx, mask, width, height) {
  const x = idx % width
  const y = Math.floor(idx / width)
  let best = null
  let bestLen = 0
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      if (!mask[ny * width + nx]) continue
      const len = Math.hypot(dx, dy)
      if (len > bestLen) {
        bestLen = len
        best = { x: dx / len, y: dy / len }
      }
    }
  }
  return best
}

/**
 * @param {number} fromIdx
 * @param {number} toIdx
 * @param {Uint8Array} mask
 * @param {Int16Array} flowDirection
 * @param {number} width
 * @param {number} height
 * @param {number} steps
 */
function stepUpstreamOnRiver(idx, mask, flowDirection, width, height, steps) {
  let current = idx
  for (let step = 0; step < steps; step += 1) {
    const upstream = findUpstreamOnMask(current, mask, flowDirection, width, height)
    if (upstream < 0) break
    current = upstream
  }
  return current
}

/**
 * @param {Object} params
 * @param {number} params.fromIdx
 * @param {number} params.toIdx
 * @param {Uint8Array} params.mask
 * @param {Int16Array} params.flowDirection
 * @param {Float32Array | null} params.elevation
 * @param {boolean[] | null} params.ocean
 * @param {number} params.width
 * @param {number} params.height
 * @param {boolean} [params.skipSnap]
 */
function mergeApproachGoal({
  fromIdx,
  toIdx,
  mask,
  flowDirection,
  elevation,
  ocean,
  width,
  height,
  skipSnap = false,
}) {
  const span = Math.hypot(
    (toIdx % width) - (fromIdx % width),
    Math.floor(toIdx / width) - Math.floor(fromIdx / width),
  )
  const upstreamSteps = Math.max(1, Math.round(span * 0.06))
  const goal = stepUpstreamOnRiver(toIdx, mask, flowDirection, width, height, upstreamSteps)

  if (skipSnap || !elevation || !ocean) {
    return goal
  }
  return snapToValleyCell(goal, elevation, ocean, width, height, 2)
}

/**
 * @param {Object} params
 * @param {number} params.fromIdx
 * @param {number} params.toIdx
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {Uint8Array} params.mask
 * @param {Int16Array | undefined} params.flowDirection
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @returns {number[] | null}
 */
function findMeanderingRiverPath({
  fromIdx,
  toIdx,
  elevation,
  ocean,
  mask,
  flowDirection,
  width,
  height,
  geographySeed,
}) {
  let pathStart = fromIdx
  const pathGoal = toIdx
  if (flowDirection) {
    pathStart = stepUpstreamOnRiver(fromIdx, mask, flowDirection, width, height, 1)
  }

  const seed = deriveFieldSeed(
    geographySeed,
    `river-attraction:${pathStart}:${pathGoal}`,
  )
  const random = createSeededRandom(seed)
  const routedSpan = Math.hypot(
    (pathGoal % width) - (pathStart % width),
    Math.floor(pathGoal / width) - Math.floor(pathStart / width),
  )
  const depth = routedSpan < 16 ? 2 : routedSpan < 48 ? 3 : routedSpan < 128 ? 4 : 5

  const waypoints = buildFractalWaypoints({
    fromIdx: pathStart,
    toIdx: pathGoal,
    width,
    height,
    random,
    depth,
  }).map((idx) =>
    snapToValleyCell(
      idx,
      elevation,
      ocean,
      width,
      height,
      Math.max(2, Math.round(routedSpan * 0.08)),
    ),
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
      heuristicWeight: 0.15,
      preferDownhill: true,
    })
    if (!segment) return null
    for (const idx of segment) {
      if (seen.has(idx)) continue
      seen.add(idx)
      path.push(idx)
    }
  }

  if (!pathDescends(path, elevation)) {
    return null
  }

  return path.length > 0 ? path : null
}

/**
 * @param {number[]} path
 * @param {Float32Array} elevation
 */
function pathDescends(path, elevation) {
  if (path.length < 2) return true

  const startElev = elevation[path[0]]
  const endElev = elevation[path[path.length - 1]]
  if (startElev + 0.0015 < endElev) return false

  let peakElev = startElev
  for (const idx of path) {
    if (elevation[idx] > peakElev) peakElev = elevation[idx]
  }

  const netDrop = startElev - endElev
  return peakElev <= startElev + Math.max(0.02, netDrop * 0.75 + 0.01)
}
