import { formatAmount } from './breakdownModel.js'

/**
 * Tappable-stat row: `{ label, stat, signed }`. `signed` is true for bonuses (saves, attacks,
 * Perception) and false for flat numbers (AC, DCs, Speed, HP). Feed it to `openBreakdown`.
 */

/** Stats screen sections: Saves, Abilities, DC & attack. */
export function statsScreenView(sheet) {
  const { saves, abilities, classDc } = sheet.stats
  const dc = [{ label: 'Class DC', stat: classDc, signed: false }]
  const add = (name, c) => {
    if (c.attack) dc.push({ label: `${name} spell attack`, stat: c.attack, signed: true })
    if (c.dc) dc.push({ label: `${name} spell DC`, stat: c.dc, signed: false })
  }
  for (const c of sheet.spells?.casters ?? []) add(c.name, c)
  if (sheet.spells?.focus) add('Focus', sheet.spells.focus)
  return {
    saves: saves.map((s) => ({ id: s.id, label: s.name, rank: s.rank, stat: s.bonus, signed: true })),
    abilities: abilities.map((a) => ({
      id: a.id,
      label: a.id.toUpperCase(),
      score: a.score,
      mod: formatAmount(a.mod),
    })),
    dc,
  }
}

/** Topper numbers that open a breakdown. HP: only the max half. */
export function topperTargets(sheet) {
  const h = sheet.header
  return {
    ac: { label: 'AC', stat: h.unarmoredAc, signed: false },
    perception: { label: 'Perception', stat: h.perception, signed: true },
    speed: { label: 'Speed', stat: h.speed, signed: false },
    hp: { label: 'HP max', stat: h.hp, signed: false },
  }
}
