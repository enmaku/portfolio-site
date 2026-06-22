import { computeCoastNavigability } from '../coast/computeCoastNavigability.js'
import {
  REFERENCE_NAVIGABLE_GRADIENT_CUTOFF,
  REFERENCE_RIVER_MOUTH_COAST_NAVIGABILITY_CUTOFF,
  navigableFlowCutoffForGrid,
  scaleForGridSize,
  sourceFlowCutoffForGrid,
} from '../types.js'
import { downstreamIndex } from './computeFlowAccumulation.js'

/**
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.flowAccumulation
 * @param {Int16Array} params.flowDirection
 * @param {boolean[]} params.ocean
 * @param {Uint8Array} params.lakeMask
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.navigableFlowCutoffScale]
 * @param {Uint8Array} [params.channelMask]
 * @param {Float32Array} [params.coastNavigability]
 * @param {number} [params.seaLevel]
 * @returns {import('../types.js').RiverGraph}
 */
export function buildRiverGraph({
  elevation,
  flowAccumulation,
  flowDirection,
  ocean,
  lakeMask,
  width,
  height,
  navigableFlowCutoffScale = 1,
  channelMask,
  coastNavigability,
  seaLevel,
}) {
  const coastNav =
    coastNavigability ??
    computeCoastNavigability({ elevation, width, height, seaLevel })
  const flowCutoff = Math.max(
    2,
    Math.round(navigableFlowCutoffForGrid(width) * navigableFlowCutoffScale),
  )
  const junctionFlowCutoff = channelMask ? 2 : flowCutoff
  const sourceFlowCutoff = Math.max(
    2,
    Math.round(sourceFlowCutoffForGrid(width) * navigableFlowCutoffScale),
  )
  const mouthFlowCutoff = channelMask ? 2 : sourceFlowCutoff
  const headwaterFlowCutoff = channelMask ? 2 : sourceFlowCutoff
  const gradientCutoff = scaleForGridSize(REFERENCE_NAVIGABLE_GRADIENT_CUTOFF, width)
  const cellCount = width * height
  const nodeByCell = new Map()
  /** @type {import('../types.js').RiverGraphNode[]} */
  const nodes = []
  /** @type {import('../types.js').RiverGraphEdge[]} */
  const edges = []
  let nodeCounter = 0

  const createNode = (x, y, kind) => {
    const id = `n${nodeCounter}`
    nodeCounter += 1
    const node = { id, x, y, kind }
    nodes.push(node)
    return node
  }

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (ocean[idx]) continue
    if (channelMask && !channelMask[idx]) continue
    if (channelMask && lakeMask[idx]) continue
    const flow = flowAccumulation[idx]
    if (flow < 2) continue

    const downstream = downstreamIndex(idx, width, flowDirection)
    const isMouthCandidate = isRiverMouthDrainageCell(
      downstream,
      ocean,
      coastNav,
      REFERENCE_RIVER_MOUTH_COAST_NAVIGABILITY_CUTOFF,
    )
    const isMouth = isMouthCandidate && flow >= mouthFlowCutoff
    const isSource = isHeadwater(idx, width, height, flowDirection, ocean)
    const isJunction = countUpstream(idx, width, height, flowDirection, ocean) >= 2
    const isLakeNode = lakeMask[idx] > 0

    let kind = 'junction'
    if (isLakeNode) kind = 'lake'
    else if (isMouth) kind = 'mouth'
    else if (isSource) kind = 'source'
    else if (isJunction) kind = 'junction'

    const isGraphNode =
      isLakeNode ||
      isMouth ||
      (isSource && flow >= headwaterFlowCutoff) ||
      (isJunction && flow >= junctionFlowCutoff)
    if (isGraphNode) {
      nodeByCell.set(idx, createNode(idx % width, Math.floor(idx / width), kind))
    }
  }

  for (let idx = 0; idx < cellCount; idx += 1) {
    const fromNode = nodeByCell.get(idx)
    if (!fromNode) continue

    let current = idx
    const cellPath = [idx]
    let guard = 0

    while (guard < cellCount) {
      guard += 1
      const downstream = downstreamIndex(current, width, flowDirection)
      if (downstream < 0) break

      cellPath.push(downstream)
      const toNode = nodeByCell.get(downstream)
      if (toNode && toNode.id !== fromNode.id) {
        const gradient = segmentGradient(elevation, cellPath)
        const segmentFlow = flowAccumulation[current]
        const navigable = segmentFlow >= flowCutoff && gradient <= gradientCutoff
        edges.push({
          fromNodeId: fromNode.id,
          toNodeId: toNode.id,
          navigable,
          cellPath,
        })
        break
      }
      current = downstream
      if (ocean[current]) break
    }
  }

  return { nodes, edges }
}

/**
 * @param {number} downstreamIdx
 * @param {boolean[]} ocean
 * @param {Float32Array} coastNavigability
 * @param {number} cutoff
 */
export function isRiverMouthDrainageCell(downstreamIdx, ocean, coastNavigability, cutoff) {
  if (downstreamIdx < 0 || !ocean[downstreamIdx]) return false
  return coastNavigability[downstreamIdx] >= cutoff
}

/**
 * @param {import('../types.js').RiverGraph} riverGraph
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array}
 */
export function buildNavigableRiverMask(riverGraph, width, height) {
  const mask = new Uint8Array(width * height)
  for (const edge of riverGraph.edges) {
    if (!edge.navigable || !edge.cellPath) continue
    for (const cellIdx of edge.cellPath) {
      mask[cellIdx] = 1
    }
  }
  return mask
}

/**
 * @param {number} idx
 * @param {number} width
 * @param {number} height
 * @param {Int16Array} flowDirection
 * @param {boolean[]} ocean
 */
function isHeadwater(idx, width, height, flowDirection, ocean) {
  const x = idx % width
  const y = Math.floor(idx / width)
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nIdx = ny * width + nx
      if (ocean[nIdx]) continue
      if (downstreamIndex(nIdx, width, flowDirection) === idx) return false
    }
  }
  return !ocean[idx]
}

/**
 * @param {number} idx
 * @param {number} width
 * @param {number} height
 * @param {Int16Array} flowDirection
 * @param {boolean[]} ocean
 */
function countUpstream(idx, width, height, flowDirection, ocean) {
  let count = 0
  const x = idx % width
  const y = Math.floor(idx / width)
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nIdx = ny * width + nx
      if (ocean[nIdx]) continue
      if (downstreamIndex(nIdx, width, flowDirection) === idx) count += 1
    }
  }
  return count
}

/**
 * @param {Float32Array} elevation
 * @param {number[]} cellPath
 */
function segmentGradient(elevation, cellPath) {
  if (cellPath.length < 2) return 0
  let maxDrop = 0
  for (let i = 0; i < cellPath.length - 1; i += 1) {
    const drop = elevation[cellPath[i]] - elevation[cellPath[i + 1]]
    if (drop > maxDrop) maxDrop = drop
  }
  return maxDrop
}
