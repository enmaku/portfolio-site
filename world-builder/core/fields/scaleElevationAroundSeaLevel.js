/**
 * Stretch or compress elevation relative to sea level (pivot unchanged).
 * @param {Float32Array} elevation
 * @param {number} seaLevel
 * @param {number} scale
 */
export function scaleElevationAroundSeaLevel(elevation, seaLevel, scale) {
  if (scale === 1) return

  for (let i = 0; i < elevation.length; i += 1) {
    const scaled = seaLevel + (elevation[i] - seaLevel) * scale
    elevation[i] = scaled < 0 ? 0 : scaled > 1 ? 1 : scaled
  }
}
