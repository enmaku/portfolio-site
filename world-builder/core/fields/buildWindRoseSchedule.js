import { derivePrevailingWindFromSeed } from '../derivePrevailingWindFromSeed.js'
import { createSeededRandom } from '../noise/seededRandom.js'
import { normalizeWindDegrees } from './prevailingWindField.js'

/** Locked wind-rose sample count used to resolve scatter lobe count (not an author knob). */
export const WIND_ROSE_SAMPLE_COUNT = 20

/** Locked mix: prevailing / secondary maximum / seed scatter. */
export const WIND_ROSE_MIX = Object.freeze({
  prevailing: 0.35,
  secondary: 0.2,
  scatter: 0.45,
})

/**
 * @param {ReadonlyArray<{ kind: string, weight: number }>} slots
 * @param {number} sampleCount
 * @returns {number[]}
 */
function allocateCounts(slots, sampleCount) {
  const totalWeight = slots.reduce((sum, slot) => sum + slot.weight, 0)
  const ideal = slots.map((slot) => (slot.weight / totalWeight) * sampleCount)
  const floors = ideal.map((value) => Math.floor(value))
  let remaining = sampleCount - floors.reduce((sum, value) => sum + value, 0)
  const fracOrder = ideal
    .map((value, index) => ({ index, frac: value - floors[index] }))
    .sort((a, b) => b.frac - a.frac)
  const counts = floors.slice()
  for (let i = 0; i < remaining; i += 1) {
    counts[fracOrder[i].index] += 1
  }
  return counts
}

/**
 * @typedef {'prevailing'|'secondary'|'scatter'} WindRoseLobeKind
 * @typedef {{ kind: WindRoseLobeKind, bearing: number, weight: number }} WindRoseLobe
 */

/**
 * Build moisture-transport lobes for one landmass generation.
 *
 * Prevailing and secondary are single weighted lobes. Scatter expands into
 * distinct bearings whose weights sum to the scatter mix share. Scatter rotates
 * with the prevailing frame relative to the seed-derived baseline.
 *
 * @param {Object} params
 * @param {number} params.geographySeed
 * @param {number} params.prevailingWindDegrees
 * @param {number} params.secondaryMaximumDegrees
 * @returns {{ lobes: WindRoseLobe[] }}
 */
export function buildWindRoseSchedule({
  geographySeed,
  prevailingWindDegrees,
  secondaryMaximumDegrees,
}) {
  const sampleCount = WIND_ROSE_SAMPLE_COUNT
  const slots = [
    { kind: 'prevailing', weight: WIND_ROSE_MIX.prevailing },
    { kind: 'secondary', weight: WIND_ROSE_MIX.secondary },
    { kind: 'scatter', weight: WIND_ROSE_MIX.scatter },
  ]
  const counts = allocateCounts(slots, sampleCount)
  const scatterCount = counts[2]
  const scheduleSeed = (geographySeed | 0) ^ (sampleCount * 101)
  const rand = createSeededRandom(scheduleSeed)

  const framePrevailing = derivePrevailingWindFromSeed(geographySeed)
  const frameDelta = normalizeWindDegrees(prevailingWindDegrees) - framePrevailing
  const prevailing = normalizeWindDegrees(prevailingWindDegrees)
  const secondary = normalizeWindDegrees(secondaryMaximumDegrees)

  /** @type {WindRoseLobe[]} */
  const lobes = [
    { kind: 'prevailing', bearing: prevailing, weight: WIND_ROSE_MIX.prevailing },
    { kind: 'secondary', bearing: secondary, weight: WIND_ROSE_MIX.secondary },
  ]

  const scatterWeight = WIND_ROSE_MIX.scatter / scatterCount
  for (let n = 0; n < scatterCount; n += 1) {
    const base = normalizeWindDegrees(rand() * 360)
    lobes.push({
      kind: 'scatter',
      bearing: normalizeWindDegrees(base + frameDelta),
      weight: scatterWeight,
    })
  }

  return { lobes }
}
