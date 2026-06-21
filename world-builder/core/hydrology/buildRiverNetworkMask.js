import { riverDisplayFlowCutoffForGrid } from '../types.js'
import { downstreamIndex } from './computeFlowAccumulation.js'

/**
 * Continuous river cells: flow at or above display cutoff and downstream path reaches
 * the sea or an inland lake spill.
 * Used for river-corridor biome rendering (distinct from navigable-haul edges on the graph).
 * @param {Object} params
 * @param {Float32Array} params.flowAccumulation
 * @param {Int16Array} params.flowDirection
 * @param {boolean[]} params.ocean
 * @param {number} params.width
 * @param {number} params.height
 * @param {Uint8Array} [params.lakeMask]
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
  navigableFlowCutoffScale = 1,
}) {
  const cellCount = width * height
  const cutoff = Math.max(
    2,
    Math.round(riverDisplayFlowCutoffForGrid(width) * navigableFlowCutoffScale),
  )
  const mask = new Uint8Array(cellCount)
  /** @type {Int8Array} */
  const flowsToDrainMemo = new Int8Array(cellCount).fill(-1)

  /**
   * @param {number} idx
   * @param {Set<number>} stack
   */
  function flowsToDrain(idx, stack) {
    const cached = flowsToDrainMemo[idx]
    if (cached >= 0) {
      return cached === 1
    }

    if (ocean[idx] || lakeMask?.[idx]) {
      flowsToDrainMemo[idx] = 1
      return true
    }

    if (flowAccumulation[idx] < cutoff) {
      flowsToDrainMemo[idx] = 0
      return false
    }

    if (stack.has(idx)) {
      flowsToDrainMemo[idx] = 0
      return false
    }

    stack.add(idx)
    const downstream = downstreamIndex(idx, width, flowDirection)
    const reachesDrain =
      downstream >= 0 && flowsToDrain(downstream, stack)
    flowsToDrainMemo[idx] = reachesDrain ? 1 : 0
    stack.delete(idx)
    return reachesDrain
  }

  for (let idx = 0; idx < cellCount; idx += 1) {
    if (ocean[idx] || flowAccumulation[idx] < cutoff) continue
    if (flowsToDrain(idx, new Set())) {
      mask[idx] = 1
    }
  }

  return mask
}
