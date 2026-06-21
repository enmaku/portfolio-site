/**
 * Reduce rainfall leeward of upwind high terrain (simple rain shadow).
 * @param {Object} params
 * @param {Float32Array} params.rainfall
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.prevailingWindDegrees meteorological bearing (0 = north, 90 = east)
 * @param {number} [params.rainShadowStrength]
 * @returns {Float32Array}
 */
export function applyRainShadow({
  rainfall,
  elevation,
  width,
  height,
  prevailingWindDegrees,
  rainShadowStrength = 1,
}) {
  const out = new Float32Array(rainfall)
  const radians = (prevailingWindDegrees * Math.PI) / 180
  const upwindX = Math.sin(radians)
  const upwindY = -Math.cos(radians)
  const sampleSteps = 6
  const stepSize = Math.max(1, Math.round(width / 256))

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x
      const cellElevation = elevation[idx]
      let maxUpwindElevation = cellElevation

      for (let step = 1; step <= sampleSteps; step += 1) {
        const sampleX = Math.round(x + upwindX * step * stepSize)
        const sampleY = Math.round(y + upwindY * step * stepSize)
        if (sampleX < 0 || sampleY < 0 || sampleX >= width || sampleY >= height) {
          continue
        }
        const sampleIdx = sampleY * width + sampleX
        if (elevation[sampleIdx] > maxUpwindElevation) {
          maxUpwindElevation = elevation[sampleIdx]
        }
      }

      const uplift = maxUpwindElevation - cellElevation
      if (uplift > 0.08) {
        const shadowStrength = Math.min(1, uplift * 2.2)
        out[idx] = rainfall[idx] * (1 - shadowStrength * 0.75 * rainShadowStrength)
      }
    }
  }

  return out
}
