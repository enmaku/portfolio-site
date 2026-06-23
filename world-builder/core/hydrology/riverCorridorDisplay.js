import { D8_OFFSETS } from './computeFlowAccumulation.js'

/** Max half-width in cells for the largest rivers at REFERENCE_GRID_SIZE. */
export const PHYSICAL_RIVER_MAX_HALF_WIDTH = 4

/** Elevation above channel bottom treated as bank lip when measuring cross-section. */
export const RIVER_BANK_LIP_THRESHOLD = 0.012

/** @deprecated Use PHYSICAL_RIVER_MAX_HALF_WIDTH */
export const RIVER_CORRIDOR_MAX_RADIUS = PHYSICAL_RIVER_MAX_HALF_WIDTH

/**
 * @param {number} gridSize
 * @returns {number}
 */
export function physicalRiverMaxHalfWidthForGrid(gridSize) {
  const scale = Math.sqrt(gridSize / 256)
  return Math.min(
    8,
    Math.max(PHYSICAL_RIVER_MAX_HALF_WIDTH, Math.round(PHYSICAL_RIVER_MAX_HALF_WIDTH * scale)),
  )
}

/** @deprecated Use physicalRiverMaxHalfWidthForGrid */
export function riverCorridorMaxRadiusForGrid(gridSize) {
  return physicalRiverMaxHalfWidthForGrid(gridSize)
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
 * Integer step perpendicular to D8 flow (left-hand normal).
 * @param {number} dir
 * @returns {[number, number]}
 */
export function flowPerpendicularStep(dir) {
  const [fx, fy] = D8_OFFSETS[dir]
  return [-fy, fx]
}

/**
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Int16Array} params.flowDirection
 * @param {number} params.idx
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.lipThreshold]
 * @param {number} [params.maxHalfWidth]
 * @returns {number}
 */
export function measurePhysicalRiverHalfWidth({
  elevation,
  flowDirection,
  idx,
  width,
  height,
  lipThreshold = RIVER_BANK_LIP_THRESHOLD,
  maxHalfWidth = PHYSICAL_RIVER_MAX_HALF_WIDTH,
}) {
  const dir = flowDirection[idx]
  if (dir < 0) return 0

  const x = idx % width
  const y = Math.floor(idx / width)
  const channelBottom = elevation[idx]
  const [stepX, stepY] = flowPerpendicularStep(dir)
  if (stepX === 0 && stepY === 0) return 0

  if (!hasMeasurableChannelBanks({
    elevation,
    x,
    y,
    stepX,
    stepY,
    channelBottom,
    lipThreshold,
    width,
    height,
  })) {
    return 0
  }

  const left = measureBankDistance({
    elevation,
    x,
    y,
    stepX,
    stepY,
    channelBottom,
    lipThreshold,
    width,
    height,
    maxHalfWidth,
  })
  const right = measureBankDistance({
    elevation,
    x,
    y,
    stepX: -stepX,
    stepY: -stepY,
    channelBottom,
    lipThreshold,
    width,
    height,
    maxHalfWidth,
  })

  return Math.min(maxHalfWidth, Math.max(left, right))
}

/**
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {number} params.x
 * @param {number} params.y
 * @param {number} params.stepX
 * @param {number} params.stepY
 * @param {number} params.channelBottom
 * @param {number} params.lipThreshold
 * @param {number} params.width
 * @param {number} params.height
 * @returns {boolean}
 */
function hasMeasurableChannelBanks({
  elevation,
  x,
  y,
  stepX,
  stepY,
  channelBottom,
  lipThreshold,
  width,
  height,
}) {
  for (let step = 1; step <= 3; step += 1) {
    for (const sign of [-1, 1]) {
      const nx = x + stepX * step * sign
      const ny = y + stepY * step * sign
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      if (elevation[ny * width + nx] > channelBottom + lipThreshold * 0.5) {
        return true
      }
    }
  }
  return false
}

/**
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {number} params.x
 * @param {number} params.y
 * @param {number} params.stepX
 * @param {number} params.stepY
 * @param {number} params.channelBottom
 * @param {number} params.lipThreshold
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.maxHalfWidth
 * @returns {number}
 */
function measureBankDistance({
  elevation,
  x,
  y,
  stepX,
  stepY,
  channelBottom,
  lipThreshold,
  width,
  height,
  maxHalfWidth,
}) {
  let distance = 0
  for (let step = 1; step <= maxHalfWidth; step += 1) {
    const nx = x + stepX * step
    const ny = y + stepY * step
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) break
    const nIdx = ny * width + nx
    if (elevation[nIdx] > channelBottom + lipThreshold) break
    distance = step
  }
  return distance
}

/**
 * @param {number} drainage
 * @param {number} [maxRadius]
 * @returns {number}
 * @deprecated Infographic radius; prefer measurePhysicalRiverHalfWidth.
 */
export function riverCorridorRadiusForDrainage(drainage, maxRadius = PHYSICAL_RIVER_MAX_HALF_WIDTH) {
  if (drainage <= 0) return 0
  const scaled = Math.sqrt(drainage) * (maxRadius + 0.5)
  return Math.min(maxRadius, Math.max(1, Math.floor(scaled)))
}

/**
 * @param {number} channelWidth
 * @param {number} maxChannelWidth
 * @param {number} [maxRadius]
 * @returns {number}
 * @deprecated Infographic radius; prefer measurePhysicalRiverHalfWidth.
 */
export function riverCorridorRadiusForChannelWidth(
  channelWidth,
  maxChannelWidth,
  maxRadius = PHYSICAL_RIVER_MAX_HALF_WIDTH,
) {
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
 * @deprecated Infographic radius; prefer measurePhysicalRiverHalfWidth.
 */
export function resolveRiverCorridorRenderRadius({
  drainage = 0,
  channelWidth = 0,
  maxChannelWidth = 0,
  maxRadius = PHYSICAL_RIVER_MAX_HALF_WIDTH,
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
 * @returns {{ maxChannelWidth: number, maxHalfWidth: number, drainage: Float32Array | undefined, flowDirection: Int16Array | undefined } | null}
 */
export function buildRiverCorridorRenderState(worldDocument) {
  const { riverNetworkMask, channelWidth, fields, gridWidth, flowDirection } = worldDocument
  if (!riverNetworkMask) return null
  const maxChannelWidth = channelWidth
    ? computeRiverNetworkMaxChannelWidth(channelWidth, riverNetworkMask)
    : 0
  const drainage = fields?.drainage
  if (maxChannelWidth <= 0 && !drainage && !flowDirection) return null
  return {
    maxChannelWidth,
    maxHalfWidth: physicalRiverMaxHalfWidthForGrid(
      gridWidth ?? Math.round(Math.sqrt(riverNetworkMask.length)),
    ),
    drainage,
    flowDirection,
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
 * Paint a solid river cross-section: centerline plus a disk sized to physical half-width.
 * Disks overlap downstream to avoid axis-aligned gaps between centerline cells.
 * @param {Uint8Array} out
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @param {number} halfWidth
 */
function stampPhysicalCrossSection(out, width, height, x, y, halfWidth) {
  if (halfWidth <= 0) {
    out[y * width + x] = 1
    return
  }
  stampDisk(out, width, height, x, y, halfWidth)
}

/**
 * Paint river corridors at physical cross-section width from incised topography.
 * @param {Uint8Array} riverNetworkMask
 * @param {number} width
 * @param {number} height
 * @param {Object} options
 * @param {Float32Array} options.elevation
 * @param {Int16Array} options.flowDirection
 * @param {boolean[]} [options.ocean]
 * @param {Uint8Array} [options.lakeMask]
 * @returns {Uint8Array}
 */
export function buildPhysicalRiverCorridorMask(riverNetworkMask, width, height, options) {
  const { elevation, flowDirection, ocean, lakeMask } = options
  const maxHalfWidth = physicalRiverMaxHalfWidthForGrid(width)
  const out = new Uint8Array(riverNetworkMask.length)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (!riverNetworkMask[idx]) continue

      let halfWidth = measurePhysicalRiverHalfWidth({
        elevation,
        flowDirection,
        idx,
        width,
        height,
        maxHalfWidth,
      })
      halfWidth = capRiverCorridorRadiusAtWaterEdge(
        halfWidth,
        x,
        y,
        width,
        height,
        ocean,
        lakeMask,
      )

      const dir = flowDirection[idx]
      if (dir < 0) {
        out[idx] = 1
        continue
      }

      stampPhysicalCrossSection(out, width, height, x, y, halfWidth)
    }
  }

  return out
}

/**
 * @deprecated Use buildPhysicalRiverCorridorMask.
 */
export function buildFlowWeightedRiverCorridorMask(
  riverNetworkMask,
  drainage,
  width,
  height,
  options = {},
) {
  if (options.elevation && options.flowDirection) {
    return buildPhysicalRiverCorridorMask(riverNetworkMask, width, height, {
      elevation: options.elevation,
      flowDirection: options.flowDirection,
      ocean: options.ocean,
      lakeMask: options.lakeMask,
    })
  }

  const maxRadius = physicalRiverMaxHalfWidthForGrid(width)
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
      stampPhysicalCrossSection(out, width, height, x, y, radius)
    }
  }
  return out
}
