import {
  minRiverMouthChannelCellsForGrid,
  navigableFlowCutoffForGrid,
  riverDisplayFlowCutoffForGrid,
  sourceFlowCutoffForGrid,
} from '../types.js'
import { downstreamIndex } from './computeFlowAccumulation.js'
import {
  buildUpstreamAdjacency,
  isRiverHeadwaterOnDrainageField,
  isRiverJunctionOnDrainageField,
  isRiverMouthDrainageCell,
  qualifiesAsRiverMouth,
} from './riverNetwork.js'

export {
  buildNavigableRiverMask,
  countMaskedUpstreamChannelCells,
  isRiverMouthDrainageCell,
  qualifiesAsRiverMouth,
} from './riverNetwork.js'

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
      ? buildUpstreamAdjacency({
          cellCount,
          width,
          flowDirection,
          ocean,
          channelMask,
        })
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
    const isSource = isRiverHeadwaterOnDrainageField(idx, width, height, flowDirection, ocean)
    const isJunction = isRiverJunctionOnDrainageField(idx, width, height, flowDirection, ocean)
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
