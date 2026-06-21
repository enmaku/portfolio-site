import { riverDisplayFlowCutoffForGrid } from '../types.js'
import { downstreamIndex } from './computeFlowAccumulation.js'

/**
 * Continuous river cells: flow at or above display cutoff and downstream path reaches the sea.
 * Used for river-corridor biome rendering (distinct from navigable-haul edges on the graph).
 * @param {Object} params
 * @param {Float32Array} params.flowAccumulation
 * @param {Int16Array} params.flowDirection
 * @param {boolean[]} params.ocean
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.navigableFlowCutoffScale]
 * @returns {Uint8Array}
 */
export function buildRiverNetworkMask({
  flowAccumulation,
  flowDirection,
  ocean,
  width,
  height,
  navigableFlowCutoffScale = 1,
}) {
  const cellCount = width * height
  const cutoff = Math.max(
    2,
    Math.round(riverDisplayFlowCutoffForGrid(width) * navigableFlowCutoffScale),
  )
  const mask = new Uint8Array(cellCount)
  /** @type {Int8Array} */
  const flowsToOceanMemo = new Int8Array(cellCount).fill(-1)

  /**
   * @param {number} idx
   * @param {Set<number>} stack
   */
  function flowsToOcean(idx, stack) {
    const cached = flowsToOceanMemo[idx]
    if (cached >= 0) {
      return cached === 1
    }

    if (ocean[idx]) {
      flowsToOceanMemo[idx] = 1
      return true
    }

    if (flowAccumulation[idx] < cutoff) {
      flowsToOceanMemo[idx] = 0
      return false
    }

    if (stack.has(idx)) {
      flowsToOceanMemo[idx] = 0
      return false
    }

    stack.add(idx)
    const downstream = downstreamIndex(idx, width, flowDirection)
    const reachesSea =
      downstream >= 0 && flowsToOcean(downstream, stack)
    flowsToOceanMemo[idx] = reachesSea ? 1 : 0
    stack.delete(idx)
    return reachesSea
  }

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (ocean[idx] || flowAccumulation[idx] < cutoff) continue
    if (flowsToOcean(idx, new Set())) {
      mask[idx] = 1
    }
  }

  return mask
}
