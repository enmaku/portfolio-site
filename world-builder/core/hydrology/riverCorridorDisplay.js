/** Base corridor half-width in cells for the widest rivers at REFERENCE_GRID_SIZE. */
export const RIVER_CORRIDOR_MAX_RADIUS = 2

/**
 * @param {number} gridSize
 * @returns {number}
 */
export function riverCorridorMaxRadiusForGrid(gridSize) {
  const scale = Math.sqrt(gridSize / 256)
  return Math.min(8, Math.max(RIVER_CORRIDOR_MAX_RADIUS, Math.round(RIVER_CORRIDOR_MAX_RADIUS * scale)))
}

/**
 * Corridor half-width in cells from normalized drainage (flow / max flow on the map).
 * @param {number} drainage
 * @param {number} [maxRadius]
 * @returns {number}
 */
export function riverCorridorRadiusForDrainage(drainage, maxRadius = RIVER_CORRIDOR_MAX_RADIUS) {
  if (drainage <= 0) return 0
  const scaled = Math.sqrt(drainage) * (maxRadius + 0.5)
  return Math.min(maxRadius, Math.max(1, Math.floor(scaled)))
}

/**
 * @param {Float32Array} channelWidth
 * @param {Uint8Array} riverNetworkMask
 * @returns {number}
 */
export function computeRiverNetworkMaxChannelWidth(channelWidth, riverNetworkMask) {
  let maxChannelWidth = 0
  for (let idx = 0; idx < channelWidth.length; idx += 1) {
    if (!riverNetworkMask[idx]) continue
    if (channelWidth[idx] > maxChannelWidth) {
      maxChannelWidth = channelWidth[idx]
    }
  }
  return maxChannelWidth
}

/**
 * Corridor half-width in cells from extracted channel width (sqrt flow accumulation).
 * @param {number} channelWidth
 * @param {number} maxChannelWidth
 * @param {number} [maxRadius]
 * @returns {number}
 */
export function riverCorridorRadiusForChannelWidth(channelWidth, maxChannelWidth, maxRadius = RIVER_CORRIDOR_MAX_RADIUS) {
  if (channelWidth <= 0 || maxChannelWidth <= 0) return 0
  return riverCorridorRadiusForDrainage(channelWidth / maxChannelWidth, maxRadius)
}

/**
 * @param {Object} params
 * @param {number} [params.drainage]
 * @param {number} [params.channelWidth]
 * @param {number} [params.maxChannelWidth]
 * @param {number} [params.maxRadius]
 * @returns {number}
 */
export function resolveRiverCorridorRenderRadius({
  drainage = 0,
  channelWidth = 0,
  maxChannelWidth = 0,
  maxRadius = RIVER_CORRIDOR_MAX_RADIUS,
}) {
  if (channelWidth > 0 && maxChannelWidth > 0) {
    return riverCorridorRadiusForChannelWidth(channelWidth, maxChannelWidth, maxRadius)
  }
  return riverCorridorRadiusForDrainage(drainage, maxRadius)
}

/**
 * @param {Object} params
 * @param {number} [params.drainage]
 * @param {number} [params.channelWidth]
 * @param {number} [params.maxChannelWidth]
 * @returns {number}
 */
export function resolveRiverCorridorNormalizedFlow({
  drainage = 0,
  channelWidth = 0,
  maxChannelWidth = 0,
}) {
  if (channelWidth > 0 && maxChannelWidth > 0) {
    return channelWidth / maxChannelWidth
  }
  return drainage
}

/**
 * @param {import('../types.js').WorldDocument} worldDocument
 * @returns {{ maxChannelWidth: number, maxRadius: number, drainage: Float32Array | undefined } | null}
 */
export function buildRiverCorridorRenderState(worldDocument) {
  const { riverNetworkMask, channelWidth, fields, gridWidth } = worldDocument
  if (!riverNetworkMask) return null
  const maxChannelWidth = channelWidth
    ? computeRiverNetworkMaxChannelWidth(channelWidth, riverNetworkMask)
    : 0
  const drainage = fields?.drainage
  if (maxChannelWidth <= 0 && !drainage) return null
  return {
    maxChannelWidth,
    maxRadius: riverCorridorMaxRadiusForGrid(gridWidth ?? Math.round(Math.sqrt(riverNetworkMask.length))),
    drainage,
  }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {boolean[] | undefined} ocean
 * @param {Uint8Array | undefined} lakeMask
 * @returns {boolean}
 */
export function isRiverCorridorAdjacentToWater(x, y, width, height, ocean, lakeMask) {
  const neighbors = [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ]
  for (const [nx, ny] of neighbors) {
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
    const nIdx = ny * width + nx
    if (ocean?.[nIdx]) return true
    if (lakeMask?.[nIdx]) return true
  }
  return false
}

/**
 * @param {number} radius
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {boolean[] | undefined} ocean
 * @param {Uint8Array | undefined} lakeMask
 * @returns {number}
 */
export function capRiverCorridorRadiusAtWaterEdge(
  radius,
  x,
  y,
  width,
  height,
  ocean,
  lakeMask,
) {
  if (radius <= 0 || (!ocean && !lakeMask)) return radius
  if (isRiverCorridorAdjacentToWater(x, y, width, height, ocean, lakeMask)) {
    return 0
  }
  return radius
}

/**
 * @param {Uint8Array} out
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 */
function stampDisk(out, width, height, x, y, radius) {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > radius * radius) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      out[ny * width + nx] = 1
    }
  }
}

/**
 * Expand the traced river centerline so width grows with downstream flow.
 * @param {Uint8Array} riverNetworkMask
 * @param {Float32Array} drainage
 * @param {number} width
 * @param {number} height
 * @param {Object} [options]
 * @param {Float32Array} [options.channelWidth]
 * @param {number} [options.maxChannelWidth]
 * @param {boolean[]} [options.ocean]
 * @param {Uint8Array} [options.lakeMask]
 * @returns {Uint8Array}
 */
export function buildFlowWeightedRiverCorridorMask(
  riverNetworkMask,
  drainage,
  width,
  height,
  options = {},
) {
  const maxRadius = riverCorridorMaxRadiusForGrid(width)
  const maxChannelWidth = options.maxChannelWidth
    ?? (options.channelWidth
      ? computeRiverNetworkMaxChannelWidth(options.channelWidth, riverNetworkMask)
      : 0)
  const { ocean, lakeMask } = options
  const out = new Uint8Array(riverNetworkMask.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (!riverNetworkMask[idx]) continue
      const baseRadius = resolveRiverCorridorRenderRadius({
        drainage: drainage[idx],
        channelWidth: options.channelWidth?.[idx] ?? 0,
        maxChannelWidth,
        maxRadius,
      })
      const radius = capRiverCorridorRadiusAtWaterEdge(
        baseRadius,
        x,
        y,
        width,
        height,
        ocean,
        lakeMask,
      )
      if (radius <= 0) {
        out[idx] = 1
        continue
      }
      stampDisk(out, width, height, x, y, radius)
    }
  }
  return out
}
