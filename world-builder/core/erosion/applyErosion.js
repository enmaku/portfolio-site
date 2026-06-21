import { deriveFieldSeed, createSeededRandom } from '../noise/seededRandom.js'
import { EROSION_SNAPSHOT_INTERVAL } from '../types.js'
import { resolveWorldGenerationOptions } from '../worldGenerationOptions.js'

const D8_OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
]

const D8_DIST = [1.414, 1, 1.414, 1, 1, 1.414, 1, 1.414]

/**
 * Deterministic erosion that carves channels toward the sea and wears headwater peaks.
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {Partial<import('../types.js').WorldGenerationOptions>} [params.options]
 * @returns {{ elevation: Float32Array, snapshots: Float32Array[], stepCount: number }}
 */
export function applyErosion({
  elevation,
  width,
  height,
  geographySeed,
  options,
}) {
  const resolved = resolveWorldGenerationOptions(options)
  const stepCount = resolved.erosionStepCount
  const seaLevel = resolved.seaLevel
  const out = new Float32Array(elevation)
  const snapshots = []
  const random = createSeededRandom(deriveFieldSeed(geographySeed, 'erosion'))
  const channelWear = resolved.erosionChannelWear
  const peakWear = resolved.erosionPeakWear
  const peakThreshold = 0.72

  for (let step = 0; step < stepCount; step += 1) {
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const idx = y * width + x
        const elev = out[idx]
        if (elev < seaLevel) continue

        let steepestDrop = 0
        let steepestIdx = -1

        for (let d = 0; d < D8_OFFSETS.length; d += 1) {
          const nx = x + D8_OFFSETS[d][0]
          const ny = y + D8_OFFSETS[d][1]
          const nIdx = ny * width + nx
          const drop = (elev - out[nIdx]) / D8_DIST[d]
          if (drop > steepestDrop) {
            steepestDrop = drop
            steepestIdx = nIdx
          }
        }

        if (steepestDrop <= 0) continue

        const tieBreak = random() * 0.0005
        const wear = channelWear * steepestDrop + tieBreak
        out[idx] = Math.max(seaLevel, out[idx] - wear)
        if (steepestIdx >= 0) {
          out[steepestIdx] = Math.max(seaLevel, out[steepestIdx] - wear * 0.35)
        }

        if (elev >= peakThreshold && isLocalHigh(out, width, height, x, y)) {
          out[idx] = Math.max(seaLevel, out[idx] - peakWear)
        }
      }
    }

    const isSnapshotStep =
      (step + 1) % EROSION_SNAPSHOT_INTERVAL === 0 || step === stepCount - 1
    if (isSnapshotStep) {
      snapshots.push(new Float32Array(out))
    }
  }

  return { elevation: out, snapshots, stepCount }
}

/**
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 */
function isLocalHigh(elevation, width, height, x, y) {
  const idx = y * width + x
  const center = elevation[idx]
  for (let d = 0; d < D8_OFFSETS.length; d += 1) {
    const nx = x + D8_OFFSETS[d][0]
    const ny = y + D8_OFFSETS[d][1]
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
    if (elevation[ny * width + nx] > center) return false
  }
  return true
}
