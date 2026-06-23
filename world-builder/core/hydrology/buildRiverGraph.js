import {
  minRiverMouthChannelCellsForGrid,
  navigableFlowCutoffForGrid,
  riverDisplayFlowCutoffForGrid,
  sourceFlowCutoffForGrid,
} from '../types.js'
import { downstreamIndex } from './computeFlowAccumulation.js'

/**
 * @param {Object} params
 * @param {Float32Array} params.flowAccumulation
 * @param {Int16Array} params.flowDirection
 * @param {boolean[]} params.ocean
 * @param {Uint8Array} params.lakeMask
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.navigableFlowCutoffScale]
 * @param {Uint8Array} [params.channelMask]
 * @returns {import('../types.js').RiverGraph}
 */
export function buildRiverGraph({
  flowAccumulation,
  flowDirection,
  ocean,
  lakeMask,
  width,
  height,
  navigableFlowCutoffScale = 1,
  channelMask,
}) {
  const flowCutoff = Math.max(
    2,
    Math.round(navigableFlowCutoffForGrid(width) * navigableFlowCutoffScale),
  )
  const junctionFlowCutoff = channelMask ? 2 : flowCutoff
  const sourceFlowCutoff = Math.max(
    2,
    Math.round(sourceFlowCutoffForGrid(width) * navigableFlowCutoffScale),
  )
  const cellCount = width * height
  const mouthFlowCutoff = channelMask
    ? Math.max(
        2,
        Math.round(riverDisplayFlowCutoffForGrid(width) * navigableFlowCutoffScale),
      )
    : sourceFlowCutoff
  const headwaterFlowCutoff = channelMask ? 2 : sourceFlowCutoff
  const minMouthChannelCells = channelMask ? minRiverMouthChannelCellsForGrid(width) : 0
  const maskedUpstream =
    channelMask && minMouthChannelCells > 0
      ? buildMaskedUpstreamAdjacency(cellCount, width, flowDirection, ocean, channelMask)
      : null
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
    const isMouthCandidate = isRiverMouthDrainageCell(downstream, ocean)
    const isMouth =
      isMouthCandidate &&
      flow >= mouthFlowCutoff &&
      qualifiesAsRiverMouth(idx, channelMask, maskedUpstream, minMouthChannelCells)
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
        edges.push({
          fromNodeId: fromNode.id,
          toNodeId: toNode.id,
          navigable: true,
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
 */
export function isRiverMouthDrainageCell(downstreamIdx, ocean) {
  return downstreamIdx >= 0 && ocean[downstreamIdx]
}

/**
 * @param {number} mouthIdx
 * @param {Uint8Array | undefined} channelMask
 * @param {number[][] | null} maskedUpstream
 * @param {number} minChannelCells
 */
export function qualifiesAsRiverMouth(mouthIdx, channelMask, maskedUpstream, minChannelCells) {
  if (!channelMask || minChannelCells <= 0) return true
  if (!channelMask[mouthIdx] || !maskedUpstream) return false
  return countMaskedUpstreamChannelCells(mouthIdx, channelMask, maskedUpstream) >= minChannelCells
}

/**
 * @param {number} startIdx
 * @param {Uint8Array} channelMask
 * @param {number[][]} upstream
 */
export function countMaskedUpstreamChannelCells(startIdx, channelMask, upstream) {
  let count = 0
  /** @type {number[]} */
  const stack = [startIdx]
  const visited = new Uint8Array(channelMask.length)

  while (stack.length > 0) {
    const idx = stack.pop()
    if (idx === undefined || visited[idx]) continue
    visited[idx] = 1
    count += 1
    for (const upIdx of upstream[idx]) {
      if (channelMask[upIdx]) stack.push(upIdx)
    }
  }

  return count
}

/**
 * @param {number} cellCount
 * @param {number} width
 * @param {Int16Array} flowDirection
 * @param {boolean[]} ocean
 * @param {Uint8Array} channelMask
 */
function buildMaskedUpstreamAdjacency(cellCount, width, flowDirection, ocean, channelMask) {
  /** @type {number[][]} */
  const upstream = Array.from({ length: cellCount }, () => [])
  for (let idx = 0; idx < cellCount; idx += 1) {
    if (!channelMask[idx] || ocean[idx]) continue
    const downstream = downstreamIndex(idx, width, flowDirection)
    if (downstream < 0 || ocean[downstream] || !channelMask[downstream]) continue
    upstream[downstream].push(idx)
  }
  return upstream
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
    if (!edge.cellPath) continue
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

