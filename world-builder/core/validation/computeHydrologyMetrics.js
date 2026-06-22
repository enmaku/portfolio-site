/** Continental width in km at REFERENCE_GRID_SIZE; scales inversely with grid width. */
const CONTINENT_WIDTH_KM = 2048

/**
 * @typedef {Object} HydrologyMetrics
 * @property {number} riverCellCount
 * @property {number} navigableEdgeCount
 * @property {number} navigableKmEstimate
 * @property {number} mouthCount
 * @property {number | null} hacksLawExponent
 * @property {number[]} slopeAreaConcavitySamples
 * @property {number} parallelStrandRatio
 * @property {number} coastConnectedNavigablePathLength
 */

/**
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.drainage
 * @param {import('../types.js').RiverGraph} params.riverGraph
 * @param {Uint8Array} [params.riverNetworkMask]
 * @param {number} params.gridWidth
 * @param {number} params.gridHeight
 * @returns {HydrologyMetrics}
 */
export function computeHydrologyMetrics({
  elevation,
  drainage,
  riverGraph,
  riverNetworkMask,
  gridWidth,
  gridHeight,
}) {
  const navigableEdges = riverGraph.edges.filter((edge) => edge.navigable)
  const navigableEdgeCount = navigableEdges.length
  const mouthCount = riverGraph.nodes.filter((node) => node.kind === 'mouth').length
  const navigableCells = collectNavigableCells(navigableEdges)
  const riverCellCount = countMarkedCells(riverNetworkMask)
  const navigableRiverCellCount = navigableCells.size
  const kmPerCell = CONTINENT_WIDTH_KM / gridWidth
  const navigableKmEstimate = navigableRiverCellCount * kmPerCell
  const parallelStrandRatio = computeParallelStrandRatio(
    navigableEdges,
    navigableCells,
    gridWidth,
  )
  const coastConnectedNavigablePathLength = computeLongestCoastConnectedPath(
    riverGraph,
    navigableEdges,
  )
  const trunkSamples = collectTrunkSamples(navigableEdges, drainage, elevation, gridWidth)
  const hacksLawExponent = estimateHacksLawExponent(trunkSamples)
  const slopeAreaConcavitySamples = estimateSlopeAreaConcavitySamples(
    trunkSamples,
    elevation,
    gridWidth,
    gridHeight,
  )

  return {
    riverCellCount,
    navigableEdgeCount,
    navigableKmEstimate,
    mouthCount,
    hacksLawExponent,
    slopeAreaConcavitySamples,
    parallelStrandRatio,
    coastConnectedNavigablePathLength,
  }
}

/**
 * @param {Uint8Array | undefined} mask
 */
function countMarkedCells(mask) {
  if (!mask) return 0
  let count = 0
  for (let idx = 0; idx < mask.length; idx += 1) {
    if (mask[idx]) count += 1
  }
  return count
}

/**
 * @param {import('../types.js').RiverGraphEdge[]} navigableEdges
 */
function collectNavigableCells(navigableEdges) {
  const cells = new Set()
  for (const edge of navigableEdges) {
    if (!edge.cellPath) continue
    for (const cellIdx of edge.cellPath) {
      cells.add(cellIdx)
    }
  }
  return cells
}

/**
 * @param {import('../types.js').RiverGraphEdge[]} navigableEdges
 * @param {Set<number>} navigableCells
 * @param {number} gridWidth
 */
function computeParallelStrandRatio(navigableEdges, navigableCells, gridWidth) {
  if (navigableCells.size === 0) return 0

  const cellOwners = new Map()
  navigableEdges.forEach((edge, edgeIndex) => {
    if (!edge.cellPath) return
    for (const cellIdx of edge.cellPath) {
      const owners = cellOwners.get(cellIdx) ?? new Set()
      owners.add(edgeIndex)
      cellOwners.set(cellIdx, owners)
    }
  })

  let parallelCells = 0
  for (const cellIdx of navigableCells) {
    if (hasAdjacentParallelStrand(cellIdx, navigableCells, cellOwners, gridWidth)) {
      parallelCells += 1
    }
  }

  return parallelCells / navigableCells.size
}

/**
 * @param {number} cellIdx
 * @param {Set<number>} navigableCells
 * @param {Map<number, Set<number>>} cellOwners
 * @param {number} gridWidth
 */
function hasAdjacentParallelStrand(cellIdx, navigableCells, cellOwners, gridWidth) {
  const owners = cellOwners.get(cellIdx)
  if (!owners) return false

  const x = cellIdx % gridWidth
  const y = Math.floor(cellIdx / gridWidth)
  const candidates = [
    y * gridWidth + (x - 1),
    y * gridWidth + (x + 1),
    (y - 1) * gridWidth + x,
    (y + 1) * gridWidth + x,
  ]

  for (const neighborIdx of candidates) {
    if (!navigableCells.has(neighborIdx)) continue
    const neighborOwners = cellOwners.get(neighborIdx)
    if (!neighborOwners) continue
    for (const owner of owners) {
      if (!neighborOwners.has(owner)) return true
    }
  }
  return false
}

/**
 * @param {import('../types.js').RiverGraph} riverGraph
 * @param {import('../types.js').RiverGraphEdge[]} navigableEdges
 */
function computeLongestCoastConnectedPath(riverGraph, navigableEdges) {
  if (navigableEdges.length === 0) return 0

  const mouthNodeIds = new Set(
    riverGraph.nodes.filter((node) => node.kind === 'mouth').map((node) => node.id),
  )
  if (mouthNodeIds.size === 0) return 0

  const upstream = new Map()
  for (const edge of navigableEdges) {
    if (!edge.cellPath || edge.cellPath.length === 0) continue
    const length = edge.cellPath.length
    const list = upstream.get(edge.toNodeId) ?? []
    list.push({ fromNodeId: edge.fromNodeId, length })
    upstream.set(edge.toNodeId, list)
  }

  let longest = 0
  for (const mouthId of mouthNodeIds) {
    const visited = new Set()
    const walk = (nodeId, total) => {
      longest = Math.max(longest, total)
      const parents = upstream.get(nodeId) ?? []
      for (const parent of parents) {
        if (visited.has(parent.fromNodeId)) continue
        visited.add(parent.fromNodeId)
        walk(parent.fromNodeId, total + parent.length)
      }
    }
    walk(mouthId, 0)
  }
  return longest
}

/**
 * @typedef {{ lengthFromSource: number, drainageArea: number, cellIdx: number }} TrunkSample
 */

/**
 * @param {import('../types.js').RiverGraphEdge[]} navigableEdges
 * @param {Float32Array} drainage
 * @param {Float32Array} elevation
 * @param {number} gridWidth
 * @returns {TrunkSample[]}
 */
function collectTrunkSamples(navigableEdges, drainage, elevation, gridWidth) {
  /** @type {TrunkSample[]} */
  const samples = []

  for (const edge of navigableEdges) {
    if (!edge.cellPath || edge.cellPath.length < 2) continue
    let lengthFromSource = 0
    for (let i = 0; i < edge.cellPath.length; i += 1) {
      const cellIdx = edge.cellPath[i]
      if (i > 0) {
        const prevIdx = edge.cellPath[i - 1]
        lengthFromSource += cellDistance(prevIdx, cellIdx, gridWidth)
      }
      if (lengthFromSource <= 0) continue
      const area = Math.max(drainage[cellIdx], 1e-4)
      samples.push({ lengthFromSource, drainageArea: area, cellIdx })
    }
  }

  return samples
}

/**
 * @param {TrunkSample[]} samples
 */
function estimateHacksLawExponent(samples) {
  if (samples.length < 3) return null

  const logA = []
  const logL = []
  for (const sample of samples) {
    if (sample.drainageArea <= 0 || sample.lengthFromSource <= 0) continue
    logA.push(Math.log(sample.drainageArea))
    logL.push(Math.log(sample.lengthFromSource))
  }
  if (logA.length < 3) return null

  const meanA = average(logA)
  const meanL = average(logL)
  let numerator = 0
  let denominator = 0
  for (let i = 0; i < logA.length; i += 1) {
    const deltaA = logA[i] - meanA
    numerator += deltaA * (logL[i] - meanL)
    denominator += deltaA * deltaA
  }
  if (denominator <= 1e-9) return null
  return numerator / denominator
}

/**
 * @param {TrunkSample[]} samples
 * @param {Float32Array} elevation
 * @param {number} gridWidth
 * @param {number} gridHeight
 */
function estimateSlopeAreaConcavitySamples(samples, elevation, gridWidth, gridHeight) {
  /** @type {number[]} */
  const concavity = []
  const stride = Math.max(1, Math.floor(samples.length / 12))

  for (let i = 0; i < samples.length; i += stride) {
    const sample = samples[i]
    const slope = localSlope(sample.cellIdx, elevation, gridWidth, gridHeight)
    if (slope <= 1e-6 || sample.drainageArea <= 1e-4) continue
    const theta = -Math.log(slope) / Math.log(sample.drainageArea)
    if (Number.isFinite(theta)) concavity.push(theta)
  }

  return concavity
}

/**
 * @param {number} idx
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 */
function localSlope(idx, elevation, width, height) {
  const x = idx % width
  const y = Math.floor(idx / width)
  const center = elevation[idx]
  let maxDrop = 0

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const neighbor = elevation[ny * width + nx]
      const drop = center - neighbor
      const distance = Math.hypot(dx, dy)
      maxDrop = Math.max(maxDrop, drop / distance)
    }
  }

  return Math.max(maxDrop, 0)
}

/**
 * @param {number} fromIdx
 * @param {number} toIdx
 * @param {number} width
 */
function cellDistance(fromIdx, toIdx, width) {
  const fx = fromIdx % width
  const fy = Math.floor(fromIdx / width)
  const tx = toIdx % width
  const ty = Math.floor(toIdx / width)
  return Math.hypot(tx - fx, ty - fy)
}

/**
 * @param {number[]} values
 */
function average(values) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
