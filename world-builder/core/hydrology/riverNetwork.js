import { downstreamIndex } from './computeFlowAccumulation.js'

/**
 * @typedef {Object} RiverNetworkFlow
 * @property {Int16Array} direction
 * @property {Float32Array} accumulation
 * @property {Float32Array} [channelWidth]
 */

/**
 * Explicit river-network contract.
 *
 * `simulationCenterline` is the stable simulation hydrology centerline (settled
 * RiverMaskPipeline stage); logistics-facing consumers read it and it is never
 * widened by presentation-only refinements. `centerline` and `corridor` are the
 * presentation/display masks the renderer draws (`centerline` resolves to the
 * presentation stage when legacy meander refine is opted in).
 * @typedef {Object} RiverNetwork
 * @property {number} width
 * @property {number} height
 * @property {Uint8Array} simulationCenterline
 * @property {Uint8Array} centerline
 * @property {Uint8Array} corridor
 * @property {RiverNetworkFlow} flow
 * @property {import('../types.js').RiverGraph} graph
 */

/**
 * @param {Object} params
 * @param {Uint8Array} params.centerline
 * @param {Uint8Array} params.corridor
 * @param {Uint8Array} [params.simulationCenterline] Settled simulation centerline; defaults to `centerline`.
 * @param {Int16Array} params.flowDirection
 * @param {Float32Array} params.flowAccumulation
 * @param {Float32Array} [params.channelWidth]
 * @param {import('../types.js').RiverGraph} params.graph
 * @param {number} params.width
 * @param {number} params.height
 * @returns {RiverNetwork}
 */
export function assembleRiverNetwork({
  centerline,
  corridor,
  simulationCenterline,
  flowDirection,
  flowAccumulation,
  channelWidth,
  graph,
  width,
  height,
}) {
  return {
    width,
    height,
    simulationCenterline: simulationCenterline ?? centerline,
    centerline,
    corridor,
    flow: {
      direction: flowDirection,
      accumulation: flowAccumulation,
      channelWidth,
    },
    graph,
  }
}

/**
 * @param {Object} params
 * @param {Uint8Array} [params.riverNetworkMask]
 * @param {Uint8Array} [params.riverCorridorMask]
 * @param {Uint8Array} [params.simulationRiverMask] Settled simulation centerline; defaults to the display centerline.
 * @param {Int16Array} params.flowDirection
 * @param {Float32Array} params.flowAccumulation
 * @param {Float32Array} [params.channelWidth]
 * @param {import('../types.js').RiverGraph} params.riverGraph
 * @param {number} params.width
 * @param {number} params.height
 * @returns {RiverNetwork | null}
 */
export function assembleRiverNetworkFromFields({
  riverNetworkMask,
  riverCorridorMask,
  simulationRiverMask,
  flowDirection,
  flowAccumulation,
  channelWidth,
  riverGraph,
  width,
  height,
}) {
  if (!flowDirection || !flowAccumulation || !riverGraph) return null

  const centerline =
    riverNetworkMask ?? buildNavigableRiverMask(riverGraph, width, height)

  return assembleRiverNetwork({
    centerline,
    corridor: riverCorridorMask ?? centerline,
    simulationCenterline: simulationRiverMask ?? centerline,
    flowDirection,
    flowAccumulation,
    channelWidth,
    graph: riverGraph,
    width,
    height,
  })
}

/**
 * @param {Object} slice
 * @param {import('../types.js').RiverNetwork} [slice.riverNetwork]
 * @param {import('../types.js').RiverGraph} [slice.riverGraph]
 * @param {Uint8Array} [slice.riverNetworkMask]
 * @param {Uint8Array} [slice.riverCorridorMask]
 * @param {Uint8Array} [slice.simulationRiverMask]
 * @param {Int16Array} [slice.flowDirection]
 * @param {import('../types.js').ScalarFields} slice.fields
 * @param {number} slice.gridWidth
 * @param {number} slice.gridHeight
 * @returns {RiverNetwork | null}
 */
export function assembleRiverNetworkFromValidationSlice(slice) {
  if (slice.riverNetwork) return slice.riverNetwork
  const { riverGraph, fields, gridWidth, gridHeight } = slice
  if (!riverGraph || !fields?.drainage) return null

  const cellCount = gridWidth * gridHeight
  const flowDirection = slice.flowDirection ?? new Int16Array(cellCount).fill(-1)

  return assembleRiverNetworkFromFields({
    riverNetworkMask: slice.riverNetworkMask,
    riverCorridorMask: slice.riverCorridorMask,
    simulationRiverMask: slice.simulationRiverMask,
    flowDirection,
    flowAccumulation: fields.drainage,
    channelWidth: slice.channelWidth ?? undefined,
    riverGraph,
    width: gridWidth,
    height: gridHeight,
  })
}

/**
 * @param {import('../types.js').WorldDocument} worldDocument
 * @returns {RiverNetwork | null}
 */
export function readRiverNetworkFromWorldDocument(worldDocument) {
  const {
    simulationRiverMask,
    riverNetworkMask,
    riverCorridorMask,
    channelWidth,
    flowDirection,
    riverGraph,
    gridWidth,
    gridHeight,
    fields,
  } = worldDocument
  if (!riverNetworkMask || !flowDirection || !riverGraph) return null

  const width = gridWidth ?? Math.round(Math.sqrt(riverNetworkMask.length))
  const height = gridHeight ?? riverNetworkMask.length / width
  const accumulation = fields?.drainage
  if (!accumulation) return null

  return assembleRiverNetworkFromFields({
    riverNetworkMask,
    riverCorridorMask,
    simulationRiverMask,
    flowDirection,
    flowAccumulation: accumulation,
    channelWidth: channelWidth ?? undefined,
    riverGraph,
    width,
    height,
  })
}

/**
 * @param {Uint8Array | undefined} mask
 */
export function countMarkedCells(mask) {
  if (!mask) return 0
  let count = 0
  for (let idx = 0; idx < mask.length; idx += 1) {
    if (mask[idx]) count += 1
  }
  return count
}

/**
 * @param {Object} params
 * @param {number} params.cellCount
 * @param {number} params.width
 * @param {Int16Array} params.flowDirection
 * @param {boolean[]} params.ocean
 * @param {Uint8Array} [params.channelMask]
 * @returns {number[][]}
 */
export function buildUpstreamAdjacency({
  cellCount,
  width,
  flowDirection,
  ocean,
  channelMask,
}) {
  /** @type {number[][]} */
  const upstream = Array.from({ length: cellCount }, () => [])
  for (let idx = 0; idx < cellCount; idx += 1) {
    if (ocean[idx]) continue
    if (channelMask && !channelMask[idx]) continue
    const downstream = downstreamIndex(idx, width, flowDirection)
    if (downstream < 0 || ocean[downstream]) continue
    if (channelMask && !channelMask[downstream]) continue
    upstream[downstream].push(idx)
  }
  return upstream
}

/**
 * @param {number[]} candidates
 * @param {Float32Array} flowAccumulation
 * @param {number} width
 * @param {number} mergeRadius
 * @param {number} mouthCutoff
 * @returns {number[]}
 */
export function selectCoastalMouths(
  candidates,
  flowAccumulation,
  width,
  mergeRadius,
  mouthCutoff,
) {
  const qualifying = candidates.filter((idx) => flowAccumulation[idx] >= mouthCutoff)
  qualifying.sort((left, right) => flowAccumulation[right] - flowAccumulation[left])

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
export function traceRiverUpstream(startIdx, mask, flowAccumulation, upstream, minBranchFlow) {
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
 * @param {number} idx
 * @param {Uint8Array} centerline
 * @param {Int16Array} flowDirection
 * @param {number} width
 * @param {number} height
 * @returns {number}
 */
export function countUpstreamOnCenterline(idx, centerline, flowDirection, width, height) {
  let count = 0
  const x = idx % width
  const y = Math.floor(idx / width)

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const neighborIdx = ny * width + nx
      if (!centerline[neighborIdx]) continue
      if (downstreamIndex(neighborIdx, width, flowDirection) === idx) count += 1
    }
  }

  return count
}

/**
 * @param {number} idx
 * @param {Uint8Array} centerline
 * @param {Int16Array} flowDirection
 * @param {number} width
 * @param {number} height
 * @returns {boolean}
 */
export function isRiverHeadwaterOnCenterline(idx, centerline, flowDirection, width, height) {
  return countUpstreamOnCenterline(idx, centerline, flowDirection, width, height) === 0
}

/**
 * @param {number} idx
 * @param {Uint8Array} centerline
 * @param {Int16Array} flowDirection
 * @param {number} width
 * @param {number} height
 * @returns {boolean}
 */
export function isRiverJunctionOnCenterline(idx, centerline, flowDirection, width, height) {
  return countUpstreamOnCenterline(idx, centerline, flowDirection, width, height) >= 2
}

/**
 * @param {number} startIdx
 * @param {Uint8Array} centerline
 * @param {Int16Array} flowDirection
 * @param {number} width
 * @param {number} height
 * @returns {number[]}
 */
export function traceDownstreamChain(startIdx, centerline, flowDirection, width, height) {
  /** @type {number[]} */
  const path = []
  let current = startIdx

  while (current >= 0 && centerline[current]) {
    path.push(current)
    const downstream = downstreamIndex(current, width, flowDirection)
    if (downstream < 0 || !centerline[downstream]) break
    if (isRiverJunctionOnCenterline(downstream, centerline, flowDirection, width, height)) break
    current = downstream
  }

  return path
}

/**
 * @param {Uint8Array} centerline
 * @param {Int16Array} flowDirection
 * @param {number} width
 * @param {number} height
 * @returns {number[][]}
 */
/**
 * @param {number} downstreamIdx
 * @param {boolean[]} ocean
 */
export function isRiverMouthDrainageCell(downstreamIdx, ocean) {
  return downstreamIdx >= 0 && ocean[downstreamIdx]
}

/**
 * @param {number} idx
 * @param {number} width
 * @param {number} height
 * @param {Int16Array} flowDirection
 * @param {boolean[]} ocean
 */
export function countUpstreamDrainageNeighbors(idx, width, height, flowDirection, ocean) {
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
 * @param {number} idx
 * @param {number} width
 * @param {number} height
 * @param {Int16Array} flowDirection
 * @param {boolean[]} ocean
 */
export function isRiverHeadwaterOnDrainageField(idx, width, height, flowDirection, ocean) {
  return !ocean[idx] && countUpstreamDrainageNeighbors(idx, width, height, flowDirection, ocean) === 0
}

/**
 * @param {number} idx
 * @param {number} width
 * @param {number} height
 * @param {Int16Array} flowDirection
 * @param {boolean[]} ocean
 */
export function isRiverJunctionOnDrainageField(idx, width, height, flowDirection, ocean) {
  return countUpstreamDrainageNeighbors(idx, width, height, flowDirection, ocean) >= 2
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

export function traceRiverChainSegments(centerline, flowDirection, width, height) {
  /** @type {number[][]} */
  const segments = []

  for (let idx = 0; idx < centerline.length; idx += 1) {
    if (!centerline[idx]) continue
    if (!isRiverHeadwaterOnCenterline(idx, centerline, flowDirection, width, height)) continue
    const path = traceDownstreamChain(idx, centerline, flowDirection, width, height)
    if (path.length > 0) segments.push(path)
  }

  for (let idx = 0; idx < centerline.length; idx += 1) {
    if (!centerline[idx]) continue
    if (!isRiverJunctionOnCenterline(idx, centerline, flowDirection, width, height)) continue
    const path = traceDownstreamChain(idx, centerline, flowDirection, width, height)
    if (path.length > 0) segments.push(path)
  }

  return segments
}

