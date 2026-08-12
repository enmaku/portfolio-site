/** Research prototype — largest-remainder weighted wind schedule + seeded shuffle.
 * Product should port this into world-builder/core (see issue PRD / ADR 0024).
 * Locked experiment mix: 35% prevailing / 20% secondary / 45% random, N=20.
 * Schedule seed: geographySeed ^ (yearCount * 101)
 */
import { mulberry32, normalizeDegrees } from './seededRandom.js'

function buildWeightedSchedule(slots, yearCount, seed) {
  const totalW = slots.reduce((s, x) => s + x.weight, 0)
  const ideal = slots.map((s) => (s.weight / totalW) * yearCount)
  const floors = ideal.map((x) => Math.floor(x))
  let rem = yearCount - floors.reduce((a, b) => a + b, 0)
  const fracOrder = ideal
    .map((x, i) => ({ i, frac: x - floors[i] }))
    .sort((a, b) => b.frac - a.frac)
  const counts = floors.slice()
  for (let k = 0; k < rem; k += 1) counts[fracOrder[k].i] += 1

  const winds = []
  const plan = []
  const rand = mulberry32(seed)
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i]
    for (let n = 0; n < counts[i]; n += 1) {
      if (slot.kind === 'fixed') {
        winds.push(slot.bearing)
        plan.push(slot.label)
      } else {
        const deg = normalizeDegrees(rand() * 360)
        winds.push(deg)
        plan.push('random')
      }
    }
  }

  // Fisher–Yates shuffle keeping winds/plan paired
  for (let i = winds.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[winds[i], winds[j]] = [winds[j], winds[i]]
    ;[plan[i], plan[j]] = [plan[j], plan[i]]
  }

  const realized = {}
  for (const p of plan) realized[p] = (realized[p] ?? 0) + 1
  return { winds, plan, counts: realized, targets: counts.map((c, i) => ({ label: slots[i].label, n: c })) }
}

export { buildWeightedSchedule }
