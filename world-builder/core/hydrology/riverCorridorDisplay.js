/** Maximum half-width in cells for the widest rivers on the grid. */
export const RIVER_CORRIDOR_MAX_RADIUS = 2

/**
 * Corridor half-width in cells from normalized drainage (flow / max flow on the map).
 * @param {number} drainage
 * @returns {number}
 */
export function riverCorridorRadiusForDrainage(drainage) {
  if (drainage <= 0) return 0
  return Math.min(
    RIVER_CORRIDOR_MAX_RADIUS,
    Math.floor(Math.sqrt(drainage) * (RIVER_CORRIDOR_MAX_RADIUS + 0.5)),
  )
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
 * @returns {Uint8Array}
 */
export function buildFlowWeightedRiverCorridorMask(
  riverNetworkMask,
  drainage,
  width,
  height,
) {
  const out = new Uint8Array(riverNetworkMask.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      if (!riverNetworkMask[idx]) continue
      const radius = riverCorridorRadiusForDrainage(drainage[idx])
      stampDisk(out, width, height, x, y, radius)
    }
  }
  return out
}
