import { D8_OFFSETS, downstreamIndex } from './computeFlowAccumulation.js'

/** Max half-width in cells for the largest rivers at REFERENCE_GRID_SIZE. */
export const PHYSICAL_RIVER_MAX_HALF_WIDTH = 4

/** Elevation above channel bottom treated as bank lip when measuring cross-section. */
export const RIVER_BANK_LIP_THRESHOLD = 0.012

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
 */
function infographicCorridorRadiusForDrainage(drainage, maxRadius = PHYSICAL_RIVER_MAX_HALF_WIDTH) {
  if (drainage <= 0) return 0
  const scaled = Math.sqrt(drainage) * (maxRadius + 0.5)
  return Math.min(maxRadius, Math.max(1, Math.floor(scaled)))
}

/**
 * @param {number} channelWidth
 * @param {number} maxChannelWidth
 * @param {number} [maxRadius]
 * @returns {number}
 */
function infographicCorridorRadiusForChannelWidth(
  channelWidth,
  maxChannelWidth,
  maxRadius = PHYSICAL_RIVER_MAX_HALF_WIDTH,
) {
  if (channelWidth <= 0 || maxChannelWidth <= 0) return 0
  return infographicCorridorRadiusForDrainage(channelWidth / maxChannelWidth, maxRadius)
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
 * @param {Int16Array} [flowDirection]
 * @param {number} [idx]
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
  flowDirection,
  idx,
) {
  if (radius <= 0 || (!ocean && !lakeMask)) return radius
  if (isRiverCorridorAdjacentToWater(x, y, width, height, ocean, lakeMask)) {
    return 0
  }
  if (flowDirection && idx !== undefined) {
    const downstream = downstreamIndex(idx, width, flowDirection)
    if (downstream >= 0 && (ocean?.[downstream] || lakeMask?.[downstream])) {
      return 0
    }
  }
  return radius
}

/**
 * @typedef {{ x: number, y: number }} RiverPoint
 */

/**
 * @param {Object} params
 * @param {number} params.x
 * @param {number} params.y
 * @param {number} params.cx
 * @param {number} params.cy
 * @param {number} params.stepX
 * @param {number} params.stepY
 * @param {number} params.halfWidth
 * @param {number} params.flowStepX
 * @param {number} params.flowStepY
 * @returns {boolean}
 */
export function isPixelInRiverCorridorCrossSection({
  x,
  y,
  cx,
  cy,
  stepX,
  stepY,
  halfWidth,
  flowStepX,
  flowStepY,
}) {
  const dx = x - cx
  const dy = y - cy
  if (dx === 0 && dy === 0) return true
  if (halfWidth <= 0) return false

  const perpDist = Math.abs(dx * stepX + dy * stepY)
  if (perpDist > halfWidth) return false

  const alongDist = Math.abs(dx * flowStepX + dy * flowStepY)
  return alongDist <= 1
}

/**
 * @param {Uint8Array} riverNetworkMask
 * @param {Int16Array} halfWidths
 * @param {Int16Array} flowDirection
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number} maxHalfWidth
 * @returns {boolean}
 */
export function isPixelInRiverCorridor(
  riverNetworkMask,
  halfWidths,
  flowDirection,
  x,
  y,
  width,
  height,
  maxHalfWidth,
) {
  const y0 = Math.max(0, y - maxHalfWidth)
  const y1 = Math.min(height - 1, y + maxHalfWidth)
  const x0 = Math.max(0, x - maxHalfWidth)
  const x1 = Math.min(width - 1, x + maxHalfWidth)

  for (let cy = y0; cy <= y1; cy += 1) {
    for (let cx = x0; cx <= x1; cx += 1) {
      const cIdx = cy * width + cx
      if (!riverNetworkMask[cIdx]) continue

      const halfWidth = halfWidths[cIdx]
      const dir = flowDirection[cIdx]
      if (dir < 0) {
        if (cx === x && cy === y) return true
        continue
      }

      const [stepX, stepY] = flowPerpendicularStep(dir)
      const [flowStepX, flowStepY] = D8_OFFSETS[dir]
      if (
        isPixelInRiverCorridorCrossSection({
          x,
          y,
          cx,
          cy,
          stepX,
          stepY,
          halfWidth,
          flowStepX,
          flowStepY,
        })
      ) {
        return true
      }
    }
  }

  return false
}

/**
 * @param {Uint8Array} riverNetworkMask
 * @param {number} width
 * @param {number} height
 * @param {Object} options
 * @param {Float32Array} options.elevation
 * @param {Int16Array} options.flowDirection
 * @param {Float32Array} [options.channelWidth]
 * @param {boolean[]} [options.ocean]
 * @param {Uint8Array} [options.lakeMask]
 * @param {(progress: number) => void} [options.onProgress]
 * @returns {Uint8Array}
 */
export function buildPhysicalRiverCorridorMask(riverNetworkMask, width, height, options) {
  const {
    elevation,
    flowDirection,
    channelWidth,
    ocean,
    lakeMask,
    onProgress,
  } = options
  const mask = new Uint8Array(riverNetworkMask.length)
  const maxHalfWidth = physicalRiverMaxHalfWidthForGrid(width)
  const maxChannelWidth = channelWidth
    ? computeRiverNetworkMaxChannelWidth(channelWidth, riverNetworkMask)
    : 0
  const halfWidths = new Int16Array(riverNetworkMask.length)

  for (let idx = 0; idx < riverNetworkMask.length; idx += 1) {
    if (!riverNetworkMask[idx]) continue

    const x = idx % width
    const y = Math.floor(idx / width)
    let halfWidth = measurePhysicalRiverHalfWidth({
      elevation,
      flowDirection,
      idx,
      width,
      height,
      maxHalfWidth,
    })

    if (halfWidth <= 0 && channelWidth && maxChannelWidth > 0 && channelWidth[idx] > 0) {
      halfWidth = infographicCorridorRadiusForChannelWidth(
        channelWidth[idx],
        maxChannelWidth,
        maxHalfWidth,
      )
    }

    halfWidths[idx] = capRiverCorridorRadiusAtWaterEdge(
      halfWidth,
      x,
      y,
      width,
      height,
      ocean,
      lakeMask,
      flowDirection,
      idx,
    )
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (ocean?.[idx] || lakeMask?.[idx]) continue
      if (
        isPixelInRiverCorridor(
          riverNetworkMask,
          halfWidths,
          flowDirection,
          x,
          y,
          width,
          height,
          maxHalfWidth,
        )
      ) {
        mask[idx] = 1
      }
    }
    onProgress?.((y + 1) / height)
  }

  return mask
}

/** Minimum occupied cells in a 3×3 window to keep a corridor cell after one smooth pass. */
export const RIVER_CORRIDOR_MASK_SMOOTH_MAJORITY = 5

/**
 * Round jagged single-cell protrusions and indentations on a river corridor mask.
 * @param {Uint8Array} mask
 * @param {number} width
 * @param {number} height
 * @param {number} [passes]
 * @returns {Uint8Array}
 */
export function smoothRiverCorridorMaskForDisplay(mask, width, height, passes = 1) {
  let current = mask
  let scratch = new Uint8Array(mask.length)

  for (let pass = 0; pass < passes; pass += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let occupied = 0
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            if (current[ny * width + nx]) occupied += 1
          }
        }
        scratch[y * width + x] = occupied >= RIVER_CORRIDOR_MASK_SMOOTH_MAJORITY ? 1 : 0
      }
    }
    const next = scratch
    scratch = current
    current = next
  }

  return current
}

