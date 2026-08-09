/** Lake overlay fill RGB (matches prior vector overlay color 0x3a8fd9). */
const LAKE_OVERLAY_RED = 0x3a
const LAKE_OVERLAY_GREEN = 0x8f
const LAKE_OVERLAY_BLUE = 0xd9
/** Alpha 0.25 encoded for RGBA raster output. */
const LAKE_OVERLAY_ALPHA = 64

/**
 * @param {Uint8Array | undefined} lakeMask
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {Uint8ClampedArray | null}
 */
export function buildLakeOverlayRgba(lakeMask, gridWidth, gridHeight) {
  if (!lakeMask?.length) {
    return null
  }

  const rgba = new Uint8ClampedArray(gridWidth * gridHeight * 4)
  let hasLake = false

  for (let i = 0; i < lakeMask.length; i += 1) {
    if (!lakeMask[i]) continue
    hasLake = true
    const offset = i * 4
    rgba[offset] = LAKE_OVERLAY_RED
    rgba[offset + 1] = LAKE_OVERLAY_GREEN
    rgba[offset + 2] = LAKE_OVERLAY_BLUE
    rgba[offset + 3] = LAKE_OVERLAY_ALPHA
  }

  return hasLake ? rgba : null
}

/**
 * @param {Uint8Array | undefined} lakeMask
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @returns {HTMLCanvasElement | null}
 */
export function buildLakeOverlayCanvas(lakeMask, gridWidth, gridHeight) {
  const rgba = buildLakeOverlayRgba(lakeMask, gridWidth, gridHeight)
  if (!rgba) {
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.width = gridWidth
  canvas.height = gridHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context for lake overlay')
  }
  ctx.putImageData(new ImageData(rgba, gridWidth, gridHeight), 0, 0)
  return canvas
}
