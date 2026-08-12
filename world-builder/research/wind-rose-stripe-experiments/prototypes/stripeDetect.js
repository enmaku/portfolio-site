import { SEA_LEVEL } from '/Users/enmaku/code/portfolio-site/world-builder/core/biomeIds.js'
import { prevailingWindUpwindVector } from '/Users/enmaku/code/portfolio-site/world-builder/core/fields/prevailingWindField.js'

/**
 * Detect long wind-aligned rainfall cliffs (cross-wind gradient stays high along downwind).
 * This matches the UI stripe failure better than biome class alone (glacier/hills mask wet/dry).
 */
export function detectWindAlignedStripes({
  rainfall,
  elevation,
  width,
  height,
  prevailingWindDegrees,
  seaLevel = SEA_LEVEL,
  minRunLength = 40,
  sampleStep = 8,
  crossOffset = 3,
  gradThreshold = 0.35,
  holdThreshold = 0.25,
}) {
  const { upwindX, upwindY } = prevailingWindUpwindVector(prevailingWindDegrees)
  const dx = -upwindX
  const dy = -upwindY
  const perpX = -dy
  const perpY = dx

  const runs = []

  for (let y0 = 16; y0 < height - 16; y0 += sampleStep) {
    for (let x0 = 16; x0 < width - 16; x0 += sampleStep) {
      const i0 = y0 * width + x0
      if (elevation[i0] < seaLevel) continue

      const lx = Math.round(x0 + perpX * crossOffset)
      const ly = Math.round(y0 + perpY * crossOffset)
      const rx = Math.round(x0 - perpX * crossOffset)
      const ry = Math.round(y0 - perpY * crossOffset)
      if (lx < 0 || ly < 0 || lx >= width || ly >= height) continue
      if (rx < 0 || ry < 0 || rx >= width || ry >= height) continue
      if (elevation[ly * width + lx] < seaLevel || elevation[ry * width + rx] < seaLevel) continue

      const g0 = Math.abs(rainfall[ly * width + lx] - rainfall[ry * width + rx])
      if (g0 < gradThreshold) continue

      let run = 1
      let x = x0
      let y = y0
      for (let s = 1; s < width; s += 1) {
        x += dx
        y += dy
        const ix = Math.round(x)
        const iy = Math.round(y)
        if (ix < 0 || iy < 0 || ix >= width || iy >= height) break
        if (elevation[iy * width + ix] < seaLevel) break
        const ilx = Math.round(ix + perpX * crossOffset)
        const ily = Math.round(iy + perpY * crossOffset)
        const irx = Math.round(ix - perpX * crossOffset)
        const iry = Math.round(iy - perpY * crossOffset)
        if (ilx < 0 || ily < 0 || ilx >= width || ily >= height) break
        if (irx < 0 || iry < 0 || irx >= width || iry >= height) break
        if (elevation[ily * width + ilx] < seaLevel || elevation[iry * width + irx] < seaLevel) break
        const g = Math.abs(rainfall[ily * width + ilx] - rainfall[iry * width + irx])
        if (g < holdThreshold) break
        run += 1
      }

      if (run >= minRunLength) {
        runs.push({ x0, y0, length: run, grad: g0 })
      }
    }
  }

  const seen = new Set()
  const deduped = []
  for (const r of runs.sort((a, b) => b.length - a.length)) {
    const key = `${Math.floor(r.x0 / 16)},${Math.floor(r.y0 / 16)}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(r)
  }

  const maxRun = deduped.reduce((m, r) => Math.max(m, r.length), 0)
  return {
    windDegrees: prevailingWindDegrees,
    downwind: { dx, dy },
    longCliffCount: deduped.length,
    maxCliffRun: maxRun,
    topCliffs: deduped.slice(0, 16),
    reproducesHardWindEdges: maxRun >= minRunLength && deduped.length >= 3,
    // alias for older report fields
    reproducesThinWetStripes: deduped.some((r) => r.length >= minRunLength * 1.5),
    maxEdgeRun: maxRun,
    maxThinWetRun: 0,
    longEdgeCount: deduped.length,
    thinWetStripeCount: 0,
    topEdges: deduped.slice(0, 12),
    topThinWet: [],
  }
}

export function paintStripeOverlay(rgba, width, height, detection) {
  const out = new Uint8ClampedArray(rgba)
  const { dx, dy } = detection.downwind
  for (const r of detection.topCliffs ?? detection.topEdges ?? []) {
    let x = r.x0
    let y = r.y0
    for (let s = 0; s < r.length; s += 1) {
      const ix = Math.round(x)
      const iy = Math.round(y)
      if (ix >= 0 && iy >= 0 && ix < width && iy < height) {
        const o = (iy * width + ix) * 4
        out[o] = 255
        out[o + 1] = 0
        out[o + 2] = 255
        out[o + 3] = 255
      }
      x += dx
      y += dy
    }
  }
  return out
}
