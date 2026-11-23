'use strict'
const { ABILITY_IDS, ABILITY_NAMES, abilityLine, line, normaliseRank, proficiencyLines, stat } = require('./stat')
const { normaliseName } = require('./skills')

const OTHER_SPELLS = /^other spells/i
const ARCHETYPE = /^archetype\b/i

const slotKey = (casterKey, rank) => `slots:${casterKey}:${rank}`

function kindOf(c) {
  if (ARCHETYPE.test(c.name || '')) return 'archetype'
  if (c.innate) return 'innate'
  return c.spellcastingType === 'spontaneous' ? 'spontaneous' : 'prepared'
}

function countNames(names) {
  const counts = new Map()
  for (const n of names) counts.set(n, (counts.get(n) || 0) + 1)
  return counts
}

/** Union of `spells` and `prepared` per rank (prepared is not a subset); count is the larger of the two. */
function rankNames(caster) {
  const byRank = new Map()
  const add = (groups) => {
    const perRank = new Map()
    for (const g of groups || []) {
      const rank = Number(g.spellLevel)
      perRank.set(rank, [...(perRank.get(rank) || []), ...(g.list || [])])
    }
    for (const [rank, names] of perRank) {
      const merged = byRank.get(rank) || new Map()
      for (const [name, n] of countNames(names)) merged.set(name, Math.max(merged.get(name) || 0, n))
      byRank.set(rank, merged)
    }
  }
  add(caster.spells)
  add(caster.prepared)
  return byRank
}

function spellStats(build, abilityBonusLines, rank, itemBonus) {
  const level = Number(build.level) || 1
  const mod = [...abilityBonusLines, ...proficiencyLines(rank, level)]
  if (itemBonus) mod.push(line('Item bonus', itemBonus, 'item'))
  return {
    attack: stat(mod),
    dc: stat([line('Base', 10, 'base'), ...mod]),
  }
}

/** One entry per spellCasters row. Real, archetype and innate casters get attack and DC; Other Spells gets null. */
function deriveCasters(build, ctx) {
  const seen = new Map()
  return (build.spellCasters || []).map((c, i) => {
    const base = `caster:${normaliseName(c.name)}`
    const n = (seen.get(base) || 0) + 1
    seen.set(base, n)
    const key = `${base}#${n}`
    const abilityId = ABILITY_IDS.includes(c.ability) ? c.ability : 'cha'
    let attack = null
    let dc = null
    if (OTHER_SPELLS.test(c.name || '')) {
      ctx.warn('other_spells_no_dc', `spells.casters[${i}]`, `"${c.name}" has no reliable proficiency, so no spell attack or DC`)
    } else {
      ;({ attack, dc } = spellStats(build, [abilityLine(build, abilityId)], normaliseRank(c.proficiency)))
    }
    const slots = {}
    ;(c.perDay || []).forEach((n2, rank) => {
      if (rank >= 1 && n2 > 0) slots[rank] = n2
    })
    const ranks = [...rankNames(c)]
      .sort((a, b) => a[0] - b[0])
      .map(([rank, names]) => ({
        rank,
        slotKey: rank >= 1 ? slotKey(key, rank) : null,
        names: [...names].map(([name, count]) => ({ name, count })),
      }))
    return { key, name: c.name, tradition: c.magicTradition || null, kind: kindOf(c), attack, dc, slots, ranks }
  })
}

/**
 * Focus pool plus one attack and DC from the highest-bonus tradition entry; the others are
 * listed in a warning. Returns null when the character has no focus entries and no pool.
 */
function deriveFocus(build, ctx) {
  const entries = []
  for (const [tradition, byAbility] of Object.entries(build.focus || {})) {
    for (const [abil, e] of Object.entries(byAbility || {})) entries.push({ tradition, abil, e: e || {} })
  }
  const pool = Number(build.focusPoints) || 0
  if (entries.length === 0 && pool === 0) return null
  const level = Number(build.level) || 1
  const bonusOf = ({ e }) =>
    (Number(e.abilityBonus) || 0) + normaliseRank(e.proficiency) + (normaliseRank(e.proficiency) > 0 ? level : 0) + (Number(e.itemBonus) || 0)
  let best = null
  for (const entry of entries) if (!best || bonusOf(entry) > bonusOf(best)) best = entry
  let attack = null
  let dc = null
  if (best) {
    const abilityName = ABILITY_NAMES[best.abil] || best.abil
    ;({ attack, dc } = spellStats(
      build,
      [line(abilityName, Number(best.e.abilityBonus) || 0, 'ability')],
      normaliseRank(best.e.proficiency),
      Number(best.e.itemBonus) || 0,
    ))
  }
  if (entries.length > 1) {
    const others = entries.filter((x) => x !== best).map((x) => `${x.tradition}/${x.abil} (+${bonusOf(x)})`)
    ctx.warn('focus_multiple_traditions', 'spells.focus', `Using ${best.tradition}/${best.abil}; also: ${others.join(', ')}`)
  }
  const uniq = (xs) => [...new Set(xs)]
  return {
    pool,
    attack,
    dc,
    cantrips: uniq(entries.flatMap((x) => x.e.focusCantrips || [])),
    spells: uniq(entries.flatMap((x) => x.e.focusSpells || [])),
  }
}

module.exports = { deriveCasters, deriveFocus, slotKey }
