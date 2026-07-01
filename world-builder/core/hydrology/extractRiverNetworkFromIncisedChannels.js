import { isRimCell } from '../fields/applyClosedIslandRim.js'
import { riverDisplayFlowCutoffForGrid } from '../types.js'
import { downstreamIndex } from './computeFlowAccumulation.js'
import {
  FLOW_RECOMPUTE_REASONS,
  FLOW_RECOMPUTE_STAGES,
  recomputeFullFlow,
} from './flowField.js'
import { buildRiverGraph } from './buildRiverGraph.js'
import { buildUpstreamAdjacency, traceRiverUpstream } from './riverNetwork.js'

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
  const tributaryCutoff = Math.max(
    2,
    Math.round(riverDisplayFlowCutoffForGrid(width) * navigableFlowCutoffScale),
  )

  const upstream = buildUpstreamAdjacency({
    cellCount,
    width,
    flowDirection,
    ocean,
  })
  const incisedMask = new Uint8Array(cellCount)
  const seeds = selectIncisedChannelSeeds({
    incisedCorridorMask,
    flowDirection,
    ocean,
    lakeMask,
    width,
    height,
  })

  for (const seedIdx of seeds) {
    incisedMask[seedIdx] = 1
    traceRiverUpstream(seedIdx, incisedMask, flowAccumulation, upstream, tributaryCutoff)
    markDownstreamOnNetwork(seedIdx, incisedMask, flowDirection, ocean, width, height)
  }

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (incisedCorridorMask[idx]) incisedMask[idx] = 1
  }

  traceMeltHeadwaterSupplement({
    mask: incisedMask,
    meltContribution,
    flowAccumulation,
    upstream,
    ocean,
    tributaryCutoff,
  })

  return incisedMask
}

/**
 * @param {Object} params
 * @param {Uint8Array} params.incisedCorridorMask
 * @param {Int16Array} params.flowDirection
 * @param {boolean[]} params.ocean
 * @param {Uint8Array} [params.lakeMask]
 * @param {number} params.width
 * @param {number} params.height
 * @returns {number[]}
 */
export function selectIncisedChannelSeeds({
  incisedCorridorMask,
  flowDirection,
  ocean,
  lakeMask,
  width,
  height,
}) {
  /** @type {number[]} */
  const seeds = []
  for (let idx = 0; idx < incisedCorridorMask.length; idx += 1) {
    if (!incisedCorridorMask[idx] || ocean[idx] || lakeMask?.[idx]) continue
    const downstream = downstreamIndex(idx, width, flowDirection)
    if (downstream < 0) continue
    if (ocean[downstream]) {
      if (!isRimCell(downstream, width, height)) seeds.push(idx)
      continue
    }
    if (lakeMask?.[downstream]) seeds.push(idx)
  }
  return seeds
}

/**
 * @param {Object} params
 * @param {Uint8Array} params.mask
 * @param {Float32Array | undefined} params.meltContribution
 * @param {Float32Array} params.flowAccumulation
 * @param {number[][]} params.upstream
 * @param {boolean[]} params.ocean
 * @param {number} params.tributaryCutoff
 */
function traceMeltHeadwaterSupplement({
  mask,
  meltContribution,
  flowAccumulation,
  upstream,
  ocean,
  tributaryCutoff,
}) {
  if (!meltContribution) return

  for (let idx = 0; idx < meltContribution.length; idx += 1) {
    if (meltContribution[idx] <= 0 || ocean[idx] || mask[idx]) continue
    mask[idx] = 1
    traceRiverUpstream(idx, mask, flowAccumulation, upstream, tributaryCutoff)
  }
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
 * @param {import('./flowField.js').FlowFieldSession} [params.flowFieldSession]
 * @returns {{
 *   flowDirection: Int16Array,
 *   flowAccumulation: Float32Array,
 *   ocean: boolean[],
 *   channelMask: Uint8Array,
 *   channelWidth: Float32Array,
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
  flowFieldSession,
}) {
  const flowParams = {
    reason: FLOW_RECOMPUTE_REASONS.hydrologyExtract,
    stage: FLOW_RECOMPUTE_STAGES.hydrologyExtract,
    elevation,
    width,
    height,
    seaLevel,
    rainfall,
    meltContribution,
    cellRunoff,
    soilDrainage,
    soilDrainageScale,
  }
  const { flowDirection, flowAccumulation, ocean } = flowFieldSession
    ? flowFieldSession.recomputeFullFlow(flowParams)
    : recomputeFullFlow(flowParams)

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
    flowAccumulation,
    flowDirection,
    ocean,
    lakeMask: lakeMask ?? new Uint8Array(width * height),
    width,
    height,
    navigableFlowCutoffScale,
    channelMask,
  })

  return {
    flowDirection,
    flowAccumulation,
    ocean,
    channelMask,
    channelWidth,
    riverGraph,
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
