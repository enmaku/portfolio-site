import { derivePrevailingWindFromSeed } from '../derivePrevailingWindFromSeed.js'
import { createSeededRandom } from '../noise/seededRandom.js'
import { normalizeWindDegrees } from './prevailingWindField.js'

/** Locked wind-rose sample count (not an author knob). */
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
 * Build moisture-transport bearings for one landmass generation.
 *
 * Scatter rotates with the prevailing frame relative to the seed-derived
 * baseline. Fixed lobes use the absolute prevailing / secondary bearings.
 *
 * @param {Object} params
 * @param {number} params.geographySeed
 * @param {number} params.prevailingWindDegrees
 * @param {number} params.secondaryMaximumDegrees
 * @returns {{ bearings: number[], kinds: ('prevailing'|'secondary'|'scatter')[] }}
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
  const scheduleSeed = (geographySeed | 0) ^ (sampleCount * 101)
  const rand = createSeededRandom(scheduleSeed)

  /** @type {number[]} */
  const bearings = []
  /** @type {('prevailing'|'secondary'|'scatter')[]} */
  const kinds = []

  const framePrevailing = derivePrevailingWindFromSeed(geographySeed)
  const frameDelta = normalizeWindDegrees(prevailingWindDegrees) - framePrevailing
  const prevailing = normalizeWindDegrees(prevailingWindDegrees)
  const secondary = normalizeWindDegrees(secondaryMaximumDegrees)

  for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
    const kind = /** @type {'prevailing'|'secondary'|'scatter'} */ (slots[slotIndex].kind)
    for (let n = 0; n < counts[slotIndex]; n += 1) {
      kinds.push(kind)
      if (kind === 'prevailing') {
        bearings.push(prevailing)
      } else if (kind === 'secondary') {
        bearings.push(secondary)
      } else {
        const base = normalizeWindDegrees(rand() * 360)
        bearings.push(normalizeWindDegrees(base + frameDelta))
      }
    }
  }

  for (let i = bearings.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[bearings[i], bearings[j]] = [bearings[j], bearings[i]]
    ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
  }

  return { bearings, kinds }
}
