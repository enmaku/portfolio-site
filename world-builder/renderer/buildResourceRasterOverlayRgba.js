/** Spacing between diagonal hatch lines in screen pixels (coarser = more visible gaps). */
export const RESOURCE_RASTER_HATCH_SPACING = 6

/** Width of each diagonal hatch line within {@link RESOURCE_RASTER_HATCH_SPACING}. */
export const RESOURCE_RASTER_HATCH_LINE_WIDTH = 2

let resourceRasterOverlayRgbaBuildCount = 0

/** @returns {number} */
export function getResourceRasterOverlayRgbaBuildCount() {
  return resourceRasterOverlayRgbaBuildCount
}

export function resetResourceRasterOverlayRgbaBuildCount() {
  resourceRasterOverlayRgbaBuildCount = 0
}

/**
 * @param {number} value
 * @param {number} spacing
 */
function positiveMod(value, spacing) {
  return ((value % spacing) + spacing) % spacing
}

/**
 * Crosshatch mask: two diagonal line families with transparent gaps between bands.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} [spacing]
 * @param {number} [lineWidth]
 * @returns {0 | 1}
 */
export function resourceRasterHatchFactor(
  x,
  y,
  spacing = RESOURCE_RASTER_HATCH_SPACING,
  lineWidth = RESOURCE_RASTER_HATCH_LINE_WIDTH,
) {
  const onForwardDiagonal = positiveMod(x + y, spacing) < lineWidth
  const onBackwardDiagonal = positiveMod(x - y, spacing) < lineWidth
  return onForwardDiagonal || onBackwardDiagonal ? 1 : 0
}

/**
 * @param {Object} params
 * @param {Float32Array} params.raster
 * @param {number} params.width
 * @param {number} params.height
 * @param {import('./resourceRasterOverlayStyles.js').ResourceRasterOverlayStyle} params.style
 * @param {number} [params.minimumProductivity]
 * @returns {boolean}
 */
export function hasDrawableResourceRasterOverlayPixels({
  raster,
  width,
  height,
  style,
  minimumProductivity = 0,
}) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const productivity = raster[y * width + x]
      if (productivity <= 0 || productivity < minimumProductivity) continue

      const hatchFactor = style.hatch ? resourceRasterHatchFactor(x, y) : 1
      const alpha = productivity * style.maxAlpha * hatchFactor
      if (alpha > 0) {
        return true
      }
    }
  }
  return false
}

/**
 * @param {Uint8ClampedArray} rgba
 * @param {number} width
 * @param {number} height
 * @returns {HTMLCanvasElement}
 */
export function resourceRasterOverlayCanvasFromRgba(rgba, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context for resource raster overlay')
  }
  ctx.putImageData(new ImageData(rgba, width, height), 0, 0)
  return canvas
}

/**
 * @param {Object} params
 * @param {Float32Array} params.raster
 * @param {number} params.width
 * @param {number} params.height
 * @param {import('./resourceRasterOverlayStyles.js').ResourceRasterOverlayStyle} params.style
 * @param {number} [params.minimumProductivity] cells below this productivity are omitted
 * @returns {Uint8ClampedArray | null}
 */
export function buildResourceRasterOverlayRgba({
  raster,
  width,
  height,
  style,
  minimumProductivity = 0,
}) {
  resourceRasterOverlayRgbaBuildCount += 1
  const rgba = new Uint8ClampedArray(width * height * 4)
  const [red, green, blue] = style.rgb
  let hasPositive = false

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      const productivity = raster[index]
      if (productivity <= 0 || productivity < minimumProductivity) continue

      const hatchFactor = style.hatch ? resourceRasterHatchFactor(x, y) : 1
      const alpha = productivity * style.maxAlpha * hatchFactor
      if (alpha <= 0) continue

      hasPositive = true
      const offset = index * 4
      rgba[offset] = red
      rgba[offset + 1] = green
      rgba[offset + 2] = blue
      rgba[offset + 3] = Math.round(Math.min(1, alpha) * 255)
    }
  }

  return hasPositive ? rgba : null
}

/**
 * @param {Object} params
 * @param {Float32Array} params.raster
 * @param {number} params.width
 * @param {number} params.height
 * @param {import('./resourceRasterOverlayStyles.js').ResourceRasterOverlayStyle} params.style
 * @param {number} [params.minimumProductivity]
 * @returns {HTMLCanvasElement | null}
 */
export function buildResourceRasterOverlayCanvas({
  raster,
  width,
  height,
  style,
  minimumProductivity = 0,
}) {
  const rgba = buildResourceRasterOverlayRgba({
    raster,
    width,
    height,
    style,
    minimumProductivity,
  })
  if (!rgba) {
    return null
  }

  return resourceRasterOverlayCanvasFromRgba(rgba, width, height)
}
