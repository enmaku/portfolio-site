/** @typedef {import('./mapLayerRefresh.js').MapLayerId} MapLayerId */

/**
 * @param {ArrayBufferView | undefined | null} a
 * @param {ArrayBufferView | undefined | null} b
 * @returns {boolean}
 */
function typedArrayContentChanged(a, b) {
  if (a === b) {
    return false
  }
  if (!a || !b) {
    return Boolean(a) !== Boolean(b)
  }
  if (a.byteLength !== b.byteLength) {
    return true
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return true
    }
  }
  return false
}

/**
 * @param {readonly Record<string, unknown>[] | undefined} a
 * @param {readonly Record<string, unknown>[] | undefined} b
 * @returns {boolean}
 */
function nodeListChanged(a, b) {
  if (a === b) {
    return false
  }
  if (!a?.length && !b?.length) {
    return false
  }
  if (!a || !b || a.length !== b.length) {
    return true
  }
  for (let i = 0; i < a.length; i += 1) {
    const nodeA = a[i]
    const nodeB = b[i]
    const keys = Object.keys(nodeA)
    if (keys.length !== Object.keys(nodeB).length) {
      return true
    }
    for (const key of keys) {
      if (nodeA[key] !== nodeB[key]) {
        return true
      }
    }
  }
  return false
}

/**
 * @param {number[] | undefined} a
 * @param {number[] | undefined} b
 * @returns {boolean}
 */
function numberListChanged(a, b) {
  if (a === b) {
    return false
  }
  if (!a?.length && !b?.length) {
    return false
  }
  if (!a || !b || a.length !== b.length) {
    return true
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return true
    }
  }
  return false
}

/**
 * @param {import('../core/types.js').RiverGraphEdge[] | undefined} a
 * @param {import('../core/types.js').RiverGraphEdge[] | undefined} b
 * @returns {boolean}
 */
function riverEdgeListChanged(a, b) {
  if (a === b) {
    return false
  }
  if (!a?.length && !b?.length) {
    return false
  }
  if (!a || !b || a.length !== b.length) {
    return true
  }
  for (let i = 0; i < a.length; i += 1) {
    const edgeA = a[i]
    const edgeB = b[i]
    if (
      edgeA.fromNodeId !== edgeB.fromNodeId ||
      edgeA.toNodeId !== edgeB.toNodeId ||
      edgeA.navigable !== edgeB.navigable ||
      numberListChanged(edgeA.cellPath, edgeB.cellPath)
    ) {
      return true
    }
  }
  return false
}

/**
 * @param {import('../core/types.js').RiverGraph | undefined} a
 * @param {import('../core/types.js').RiverGraph | undefined} b
 * @returns {boolean}
 */
function riverGraphChanged(a, b) {
  if (a === b) {
    return false
  }
  if (!a || !b) {
    return Boolean(a) !== Boolean(b)
  }
  return nodeListChanged(a.nodes, b.nodes) || riverEdgeListChanged(a.edges, b.edges)
}

/**
 * @param {import('../core/types.js').WorldDocument} previous
 * @param {import('../core/types.js').WorldDocument} next
 * @returns {boolean}
 */
function riverLayerInputsChanged(previous, next) {
  return (
    typedArrayContentChanged(previous.riverNetworkMask, next.riverNetworkMask) ||
    typedArrayContentChanged(previous.riverCorridorMask, next.riverCorridorMask) ||
    typedArrayContentChanged(previous.flowDirection, next.flowDirection) ||
    typedArrayContentChanged(previous.channelWidth, next.channelWidth) ||
    typedArrayContentChanged(previous.fields?.drainage, next.fields?.drainage) ||
    riverGraphChanged(previous.riverGraph, next.riverGraph)
  )
}

/**
 * @param {import('../core/types.js').WorldDocument | null | undefined} previous
 * @param {import('../core/types.js').WorldDocument} next
 * @returns {MapLayerId[] | null} null requests a full layer rebuild
 */
export function diffWorldDocumentMapLayers(previous, next) {
  if (!previous) {
    return null
  }

  if (
    previous.gridWidth !== next.gridWidth ||
    previous.gridHeight !== next.gridHeight
  ) {
    return null
  }

  /** @type {MapLayerId[]} */
  const changedLayers = []

  if (typedArrayContentChanged(previous.displayBiomes, next.displayBiomes)) {
    changedLayers.push('terrain')
  }
  if (typedArrayContentChanged(previous.fields?.elevation, next.fields?.elevation)) {
    changedLayers.push('contours')
  }
  if (typedArrayContentChanged(previous.arableRaster, next.arableRaster)) {
    changedLayers.push('arable')
  }
  if (typedArrayContentChanged(previous.timberRaster, next.timberRaster)) {
    changedLayers.push('timber')
  }
  if (typedArrayContentChanged(previous.metalsRaster, next.metalsRaster)) {
    changedLayers.push('metals')
  }
  if (riverLayerInputsChanged(previous, next)) {
    changedLayers.push('rivers')
  }
  if (typedArrayContentChanged(previous.lakeMask, next.lakeMask)) {
    changedLayers.push('lakes')
  }
  if (nodeListChanged(previous.coastalNodes, next.coastalNodes)) {
    changedLayers.push('coastalNodes')
  }
  if (nodeListChanged(previous.metalNodes, next.metalNodes)) {
    changedLayers.push('metalNodes')
  }
  if (nodeListChanged(previous.saltNodes, next.saltNodes)) {
    changedLayers.push('saltNodes')
  }

  return changedLayers
}
