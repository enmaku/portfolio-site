import { computeCoastNavigability } from '../coast/computeCoastNavigability.js'
import { isRimCell } from '../fields/applyClosedIslandRim.js'
import { riverDisplayFlowCutoffForGrid } from '../types.js'
import { downstreamIndex } from './computeFlowAccumulation.js'
import { computeFlowAccumulation } from './computeFlowAccumulation.js'
import { buildRiverGraph } from './buildRiverGraph.js'
import { buildRiverNetworkMask } from './buildRiverNetworkMask.js'

/**
 * Cells where incision lowered elevation relative to the filled DEM.
 * @param {Float32Array} beforeElevation
 * @param {Float32Array} afterElevation
 * @param {boolean[]} ocean
 * @param {number} [minDrop]
 * @returns {Uint8Array}
 */
export function deriveIncisedCorridorMask(beforeElevation, afterElevation, ocean, minDrop = 1e-5) {
  const mask = new Uint8Array(beforeElevation.length)
  for (let idx = 0; idx < beforeElevation.length; idx += 1) {
    if (ocean[idx]) continue
    if (beforeElevation[idx] - afterElevation[idx] > minDrop) {
      mask[idx] = 1
    }
  }
  return mask
}

/**
 * @param {Uint8Array} left
 * @param {Uint8Array} right
 * @returns {Uint8Array}
 */
export function unionCorridorMasks(left, right) {
  const mask = new Uint8Array(left.length)
  for (let idx = 0; idx < left.length; idx += 1) {
    if (left[idx] || right[idx]) mask[idx] = 1
  }
  return mask
}

/**
 * Channel mask from incised corridors union post-incision flow-traced network.
 * @param {Object} params
 * @param {Uint8Array} params.incisedCorridorMask
 * @param {Float32Array} params.flowAccumulation
 * @param {Int16Array} params.flowDirection
 * @param {boolean[]} params.ocean
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.navigableFlowCutoffScale]
 * @param {Uint8Array} [params.lakeMask]
 * @param {Float32Array} [params.coastNavigability]
 * @param {Float32Array} [params.elevation]
 * @param {number} [params.seaLevel]
 * @param {Float32Array} [params.meltContribution]
 * @returns {Uint8Array}
 */
export function buildIncisedChannelMask({
  incisedCorridorMask,
  flowAccumulation,
  flowDirection,
  ocean,
  width,
  height,
  navigableFlowCutoffScale = 1,
  lakeMask,
  meltContribution,
}) {
  const cellCount = width * height
  const minBranchFlow = Math.max(
    2,
    Math.round(riverDisplayFlowCutoffForGrid(width) * navigableFlowCutoffScale * 0.35),
  )

  const upstream = buildUpstreamAdjacency(cellCount, width, flowDirection, ocean)
  const incisedMask = new Uint8Array(cellCount)

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (!incisedCorridorMask[idx] || ocean[idx] || lakeMask?.[idx]) continue
    const downstream = downstreamIndex(idx, width, flowDirection)
    if (downstream >= 0 && ocean[downstream] && isRimCell(downstream, width, height)) continue
    incisedMask[idx] = 1
    traceIncisedUpstream(idx, incisedMask, flowAccumulation, upstream, minBranchFlow)
    markDownstreamOnNetwork(idx, incisedMask, flowDirection, ocean, width, height)
  }

  const flowMask = buildRiverNetworkMask({
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
    lakeMask,
    meltContribution,
    navigableFlowCutoffScale,
  })

  return unionCorridorMasks(incisedMask, flowMask)
}

/**
 * @param {Float32Array} params.flowAccumulation
 * @param {Uint8Array} params.channelMask
 * @param {number} params.width
 * @param {number} params.height
 * @returns {Float32Array}
 */
export function buildChannelWidthField({ flowAccumulation, channelMask, width, height }) {
  const cellCount = width * height
  const widthField = new Float32Array(cellCount)
  for (let idx = 0; idx < cellCount; idx += 1) {
    if (!channelMask[idx]) continue
    widthField[idx] = Math.sqrt(Math.max(0, flowAccumulation[idx]))
  }
  return widthField
}

/**
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Uint8Array} params.incisedCorridorMask
 * @param {Float32Array} params.rainfall
 * @param {Float32Array} [params.meltContribution]
 * @param {Float32Array} [params.cellRunoff]
 * @param {Float32Array} [params.soilDrainage]
 * @param {number} [params.soilDrainageScale]
 * @param {number} [params.seaLevel]
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.navigableFlowCutoffScale]
 * @param {Uint8Array} [params.lakeMask]
 * @returns {{
 *   flowDirection: Int16Array,
 *   flowAccumulation: Float32Array,
 *   ocean: boolean[],
 *   channelMask: Uint8Array,
 *   channelWidth: Float32Array,
 *   coastNavigability: Float32Array,
 *   riverGraph: import('../types.js').RiverGraph,
 * }}
 */
export function extractRiverNetworkFromIncisedChannels({
  elevation,
  incisedCorridorMask,
  rainfall,
  meltContribution,
  cellRunoff,
  soilDrainage,
  soilDrainageScale,
  seaLevel,
  width,
  height,
  navigableFlowCutoffScale = 1,
  lakeMask,
}) {
  const { flowDirection, flowAccumulation, ocean } = computeFlowAccumulation({
    elevation,
    width,
    height,
    seaLevel,
    rainfall,
    meltContribution,
    cellRunoff,
    soilDrainage,
    soilDrainageScale,
  })

  const coastNavigability = computeCoastNavigability({
    elevation,
    width,
    height,
    seaLevel,
  })

  const channelMask = buildIncisedChannelMask({
    incisedCorridorMask,
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
    navigableFlowCutoffScale,
    lakeMask,
    meltContribution,
  })

  const channelWidth = buildChannelWidthField({
    flowAccumulation,
    channelMask,
    width,
    height,
  })

  const riverGraph = buildRiverGraph({
    elevation,
    flowAccumulation,
    flowDirection,
    ocean,
    lakeMask: lakeMask ?? new Uint8Array(width * height),
    width,
    height,
    navigableFlowCutoffScale,
    channelMask,
    coastNavigability,
    seaLevel,
  })

  return {
    flowDirection,
    flowAccumulation,
    ocean,
    channelMask,
    channelWidth,
    coastNavigability,
    riverGraph,
  }
}

/**
 * @param {number} cellCount
 * @param {number} width
 * @param {Int16Array} flowDirection
 * @param {boolean[]} ocean
 * @returns {number[][]}
 */
function buildUpstreamAdjacency(cellCount, width, flowDirection, ocean) {
  /** @type {number[][]} */
  const upstream = Array.from({ length: cellCount }, () => [])
  for (let idx = 0; idx < cellCount; idx += 1) {
    if (ocean[idx]) continue
    const downstream = downstreamIndex(idx, width, flowDirection)
    if (downstream < 0 || ocean[downstream]) continue
    upstream[downstream].push(idx)
  }
  return upstream
}

/**
 * @param {number} startIdx
 * @param {Uint8Array} mask
 * @param {Float32Array} flowAccumulation
 * @param {number[][]} upstream
 * @param {number} minBranchFlow
 */
function traceIncisedUpstream(startIdx, mask, flowAccumulation, upstream, minBranchFlow) {
  /** @type {number[]} */
  const stack = [startIdx]
  mask[startIdx] = 1

  while (stack.length > 0) {
    const idx = stack.pop()
    for (const upIdx of upstream[idx]) {
      if (mask[upIdx]) continue
      if (flowAccumulation[upIdx] < minBranchFlow) continue
      mask[upIdx] = 1
      stack.push(upIdx)
    }
  }
}

/**
 * @param {number} startIdx
 * @param {Uint8Array} mask
 * @param {Int16Array} flowDirection
 * @param {boolean[]} ocean
 * @param {number} width
 */
function markDownstreamOnNetwork(startIdx, mask, flowDirection, ocean, width, height) {
  let current = startIdx
  const cellCount = mask.length
  let guard = 0
  while (guard < cellCount) {
    guard += 1
    const downstream = downstreamIndex(current, width, flowDirection)
    if (downstream < 0) break
    if (ocean[downstream]) break
    if (isRimCell(downstream, width, height)) break
    mask[downstream] = 1
    current = downstream
  }
}
