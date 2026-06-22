import { isRimCell } from '../fields/applyClosedIslandRim.js'
import {
  coastalMouthMergeRadiusForGrid,
  deltaFlowCutoffForGrid,
  riverDisplayFlowCutoffForGrid,
  scaleForGridSize,
} from '../types.js'
import { downstreamIndex } from './computeFlowAccumulation.js'

/**
 * River corridor mask traced from major outlets upstream, with tributaries merging at
 * junctions and delta fans at large mouths. Suppresses parallel coastal fingers that
 * never combine in flow accumulation.
 * @param {Object} params
 * @param {Float32Array} params.flowAccumulation
 * @param {Int16Array} params.flowDirection
 * @param {boolean[]} params.ocean
 * @param {number} params.width
 * @param {number} params.height
 * @param {Uint8Array} [params.lakeMask]
 * @param {Float32Array} [params.meltContribution]
 * @param {number} [params.navigableFlowCutoffScale]
 * @returns {Uint8Array}
 */
export function buildRiverNetworkMask({
  flowAccumulation,
  flowDirection,
  ocean,
  width,
  height,
  lakeMask,
  meltContribution,
  navigableFlowCutoffScale = 1,
}) {
  const cellCount = width * height
  const tributaryCutoff = Math.max(
    2,
    Math.round(riverDisplayFlowCutoffForGrid(width) * navigableFlowCutoffScale),
  )
  const deltaCutoff = Math.max(
    2,
    Math.round(deltaFlowCutoffForGrid(width) * navigableFlowCutoffScale),
  )
  const mergeRadius = coastalMouthMergeRadiusForGrid(width)
  const lakeOutletCutoff = Math.max(2, Math.round(tributaryCutoff * 0.5))

  const upstream = buildUpstreamAdjacency(cellCount, width, flowDirection, ocean)
  const mask = new Uint8Array(cellCount)

  /** @type {number[]} */
  const oceanMouthCandidates = []
  /** @type {number[]} */
  const lakeOutlets = []

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (ocean[idx]) continue
    const downstream = downstreamIndex(idx, width, flowDirection)
    if (downstream < 0) continue

    if (ocean[downstream]) {
      if (flowAccumulation[idx] >= tributaryCutoff) {
        oceanMouthCandidates.push(idx)
      }
      continue
    }

    if (lakeMask?.[downstream] && flowAccumulation[idx] >= lakeOutletCutoff) {
      lakeOutlets.push(idx)
    }
  }

  const majorMouths = selectCoastalMouths(
    oceanMouthCandidates,
    flowAccumulation,
    flowDirection,
    ocean,
    width,
    height,
    mergeRadius,
    tributaryCutoff,
  )

  for (const outletIdx of majorMouths) {
    traceRiverUpstream(outletIdx, mask, flowAccumulation, upstream, tributaryCutoff)
    if (flowAccumulation[outletIdx] >= deltaCutoff) {
      addDeltaDistributaries(
        outletIdx,
        mask,
        flowAccumulation,
        upstream,
        flowDirection,
        ocean,
        width,
        height,
      )
    }
  }

  for (const outletIdx of lakeOutlets) {
    traceRiverUpstream(outletIdx, mask, flowAccumulation, upstream, tributaryCutoff)
    mask[outletIdx] = 1
    const downstream = downstreamIndex(outletIdx, width, flowDirection)
    if (downstream >= 0 && lakeMask?.[downstream]) {
      mask[downstream] = 1
    }
  }

  if (meltContribution) {
    const meltHeadwaterCutoff = Math.max(2, Math.round(tributaryCutoff * 0.5))
    traceMeltSourcedCorridors({
      meltContribution,
      mask,
      flowAccumulation,
      upstream,
      flowDirection,
      ocean,
      width,
      minBranchFlow: meltHeadwaterCutoff,
    })
  }

  return mask
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
 * @param {number[]} candidates
 * @param {Float32Array} flowAccumulation
 * @param {Int16Array} flowDirection
 * @param {boolean[]} ocean
 * @param {number} width
 * @param {number} height
 * @param {number} mergeRadius
 * @param {number} mouthCutoff
 * @returns {number[]}
 */
function selectCoastalMouths(
  candidates,
  flowAccumulation,
  flowDirection,
  ocean,
  width,
  height,
  mergeRadius,
  mouthCutoff,
) {
  const qualifying = candidates.filter((idx) => flowAccumulation[idx] >= mouthCutoff)
  qualifying.sort((a, b) => {
    const aDownstream = downstreamIndex(a, width, flowDirection)
    const bDownstream = downstreamIndex(b, width, flowDirection)
    const aRim = aDownstream >= 0 && ocean[aDownstream] && isRimCell(aDownstream, width, height)
      ? 0.12
      : 1
    const bRim = bDownstream >= 0 && ocean[bDownstream] && isRimCell(bDownstream, width, height)
      ? 0.12
      : 1
    return flowAccumulation[b] * bRim - flowAccumulation[a] * aRim
  })

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
 * @param {number} startIdx
 * @param {Uint8Array} mask
 * @param {Float32Array} flowAccumulation
 * @param {number[][]} upstream
 * @param {number} minBranchFlow
 */
function traceRiverUpstream(startIdx, mask, flowAccumulation, upstream, minBranchFlow) {
  /** @type {number[]} */
  const stack = [startIdx]
  mask[startIdx] = 1

  while (stack.length > 0) {
    const idx = stack.pop()
    for (const upIdx of upstream[idx]) {
      if (mask[upIdx]) continue
      if (flowAccumulation[upIdx] >= minBranchFlow) {
        mask[upIdx] = 1
        stack.push(upIdx)
      }
    }
  }
}

/**
 * @param {number} mouthIdx
 * @param {Uint8Array} mask
 * @param {Float32Array} flowAccumulation
 * @param {number[][]} upstream
 * @param {Int16Array} flowDirection
 * @param {boolean[]} ocean
 * @param {number} width
 * @param {number} height
 */
function addDeltaDistributaries(
  mouthIdx,
  mask,
  flowAccumulation,
  upstream,
  flowDirection,
  ocean,
  width,
  height,
) {
  const upstreamCells = upstream[mouthIdx]
  if (upstreamCells.length === 0) return

  let mainUpIdx = upstreamCells[0]
  for (const upIdx of upstreamCells) {
    if (flowAccumulation[upIdx] > flowAccumulation[mainUpIdx]) {
      mainUpIdx = upIdx
    }
  }

  const mx = mouthIdx % width
  const my = Math.floor(mouthIdx / width)
  const ux = mainUpIdx % width
  const uy = Math.floor(mainUpIdx / width)
  let tdx = mx - ux
  let tdy = my - uy
  const tLen = Math.hypot(tdx, tdy) || 1
  tdx /= tLen
  tdy /= tLen

  const mouthFlow = flowAccumulation[mouthIdx]
  const fanReach = Math.min(
    Math.round(scaleForGridSize(20, width)),
    Math.max(4, Math.round(Math.sqrt(mouthFlow) * 0.08)),
  )

  const tangents = [
    [-tdy, tdx],
    [tdy, -tdx],
  ]

  for (const [pdx, pdy] of tangents) {
    for (let step = 0; step <= fanReach; step += 1) {
      const cx = Math.round(mx + pdx * step)
      const cy = Math.round(my + pdy * step)
      if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue

      const coastIdx = cy * width + cx
      if (ocean[coastIdx]) continue

      markDownstreamToOcean(
        coastIdx,
        mask,
        flowDirection,
        ocean,
        width,
        Math.min(step + 2, fanReach),
      )
    }
  }
}

/**
 * @param {number} startIdx
 * @param {Uint8Array} mask
 * @param {Int16Array} flowDirection
 * @param {boolean[]} ocean
 * @param {number} width
 * @param {number} maxSteps
 */
function markDownstreamToOcean(startIdx, mask, flowDirection, ocean, width, maxSteps) {
  let current = startIdx
  for (let step = 0; step <= maxSteps; step += 1) {
    if (ocean[current]) break
    mask[current] = 1
    const downstream = downstreamIndex(current, width, flowDirection)
    if (downstream < 0) break
    current = downstream
  }
}

/**
 * @param {Object} params
 * @param {Float32Array} params.meltContribution
 * @param {Uint8Array} params.mask
 * @param {Float32Array} params.flowAccumulation
 * @param {number[][]} params.upstream
 * @param {Int16Array} params.flowDirection
 * @param {boolean[]} params.ocean
 * @param {number} params.width
 * @param {number} params.minBranchFlow
 */
function traceMeltSourcedCorridors({
  meltContribution,
  mask,
  flowAccumulation,
  upstream,
  flowDirection,
  ocean,
  width,
  minBranchFlow,
}) {
  const maxDownstreamSteps = Math.max(16, Math.round(scaleForGridSize(48, width)))
  for (let idx = 0; idx < meltContribution.length; idx += 1) {
    if (meltContribution[idx] <= 0 || ocean[idx]) continue
    mask[idx] = 1
    traceRiverUpstream(idx, mask, flowAccumulation, upstream, minBranchFlow)
    markDownstreamToOcean(idx, mask, flowDirection, ocean, width, maxDownstreamSteps)
  }
}
