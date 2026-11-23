'use strict'
const {
  RANK_NAMES,
  abilityModOf,
  abilityLine,
  line,
  normaliseRank,
  proficiencyLines,
  stat,
  statWithTotal,
} = require('./stat')

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const STRIKING_DICE = { '': 1, striking: 2, greaterStriking: 3, majorStriking: 4 }
const SPECIFIC_RANKS = [['trained', 2], ['expert', 4], ['master', 6], ['legendary', 8]]

function weaponRank(build, w) {
  let rank = normaliseRank((build.proficiencies || {})[w.prof])
  const sp = build.specificProficiencies || {}
  const names = [w.name, w.display].filter(Boolean).map((n) => String(n).toLowerCase())
  for (const [bucket, value] of SPECIFIC_RANKS) {
    if ((sp[bucket] || []).some((n) => names.includes(String(n).toLowerCase())) && value > rank) rank = value
  }
  return rank
}

/**
 * Each weapon's attack (rebuilt: ability + proficiency + level + potency) and damage (dice string plus
 * one untyped Pathbuilder damage bonus). Pathbuilder's attack wins; the ability that explains it best
 * (Str or Dex, Str on a tie) is used, and any remainder becomes an "Other (from Pathbuilder)" line.
 */
function deriveWeapons(build, ctx) {
  const level = Number(build.level) || 1
  return (build.weapons || []).map((w, index) => {
    const rank = weaponRank(build, w)
    const tail = [...proficiencyLines(rank, level)]
    if (num(w.pot) !== 0) tail.push(line('Potency rune', num(w.pot), 'item'))
    const tailSum = tail.reduce((n, l) => n + l.amount, 0)
    const target = Number.isInteger(w.attack) ? w.attack : null
    const candidates = ['str', 'dex']
    let ability = 'str'
    if (target !== null) {
      ability = candidates.reduce((best, id) =>
        Math.abs(target - tailSum - abilityModOf(build, id)) < Math.abs(target - tailSum - abilityModOf(build, best)) ? id : best,
      )
    }
    const lines = [abilityLine(build, ability), ...tail]
    const attack = statWithTotal(lines, target, ctx, `gear.weapons[${index}].attack`)
    const dieCount = STRIKING_DICE[w.str] || 1
    const dice = `${dieCount}${w.die || 'd4'} ${w.damageType || ''}`.trim()
    const bonus = num(w.damageBonus)
    return {
      index,
      name: w.name,
      qty: num(w.qty) || 1,
      attack,
      damage: { dice, bonus: stat([line('Pathbuilder damage bonus', bonus, 'untyped')]) },
    }
  })
}

function armorLinesFromComponents(build, ac, armorProf) {
  const level = Number(build.level) || 1
  const prof = num(ac.acProfBonus)
  const rank = normaliseRank((build.proficiencies || {})[armorProf])
  const lines = [line('Base', 10, 'base'), line('Dexterity', num(ac.acAbilityBonus), 'ability')]
  if (prof === 0) lines.push(line('Untrained', 0, 'proficiency'))
  else if (rank > 0 && prof - level === rank) lines.push(line(RANK_NAMES[rank], rank, 'proficiency'), line('Level', level, 'level'))
  else lines.push(line('Proficiency (Pathbuilder)', prof, 'proficiency'))
  if (num(ac.acItemBonus) !== 0) lines.push(line('Item bonus', num(ac.acItemBonus), 'item'))
  return lines
}

/**
 * unarmoredAc, one AC Stat per body armor, and the shield bonus Stat per shield. The export only carries
 * AC components for what is worn; other armor needs `corpus.armor(name) -> { acBonus, dexCap }` (else
 * acTotal is null and a warning is raised) and other shields `corpus.shield(name) -> { acBonus }`.
 * `mods.AC` lines are added on top of the Pathbuilder components.
 */
function deriveArmor(build, ctx, corpus = {}) {
  const level = Number(build.level) || 1
  const ac = build.acTotal || {}
  const list = (build.armor || []).map((a, index) => ({ a, index }))
  const bodies = list.filter(({ a }) => a.prof !== 'shield')
  const worn = bodies.find(({ a }) => a.worn)
  const finish = (lines, path) => {
    const total = statWithTotal(lines, null, ctx, path)
    const mods = ctx.mods.linesFor('AC')
    return mods.length ? stat([...total.breakdown, ...mods]) : total
  }

  let unarmoredLines
  if (!worn || worn.a.prof === 'unarmored') {
    const lines = armorLinesFromComponents(build, ac, 'unarmored')
    const sum = lines.reduce((n, l) => n + l.amount, 0)
    if (Number.isInteger(ac.acTotal) && ac.acTotal !== sum) {
      ctx.warn('breakdown_residual', 'header.unarmoredAc', `Rebuilt ${sum}, Pathbuilder says ${ac.acTotal}`)
      lines.push(line('Other (from Pathbuilder)', ac.acTotal - sum, 'untyped'))
    }
    unarmoredLines = lines
  } else {
    unarmoredLines = [line('Base', 10, 'base'), abilityLine(build, 'dex'), ...proficiencyLines((build.proficiencies || {}).unarmored, level)]
  }
  const unarmoredAc = finish(unarmoredLines, 'header.unarmoredAc')

  const armor = bodies.map(({ a, index }) => {
    let acTotal = null
    if (worn && worn.index === index) {
      const lines = armorLinesFromComponents(build, ac, a.prof)
      const sum = lines.reduce((n, l) => n + l.amount, 0)
      if (Number.isInteger(ac.acTotal) && ac.acTotal !== sum) {
        ctx.warn('breakdown_residual', `gear.armor[${index}].acTotal`, `Rebuilt ${sum}, Pathbuilder says ${ac.acTotal}`)
        lines.push(line('Other (from Pathbuilder)', ac.acTotal - sum, 'untyped'))
      }
      acTotal = finish(lines, `gear.armor[${index}].acTotal`)
    } else {
      const info = corpus.armor ? corpus.armor(a.name) : null
      if (info) {
        const dex = abilityModOf(build, 'dex')
        const capped = info.dexCap === null || info.dexCap === undefined ? dex : Math.min(dex, info.dexCap)
        const lines = [
          line('Base', 10, 'base'),
          line(info.dexCap === null || info.dexCap === undefined ? 'Dexterity' : `Dexterity (cap +${info.dexCap})`, capped, 'ability'),
          ...proficiencyLines((build.proficiencies || {})[a.prof], level),
          line('Item bonus', num(info.acBonus), 'item'),
        ]
        if (num(a.pot) !== 0) lines.push(line('Potency rune', num(a.pot), 'item'))
        acTotal = finish(lines, `gear.armor[${index}].acTotal`)
      } else {
        ctx.warn('armor_ac_unknown', `gear.armor[${index}].acTotal`, `No AC data for "${a.name}" (not worn, no corpus entry)`)
      }
    }
    return { index, name: a.name, qty: num(a.qty) || 1, wornInExport: Boolean(a.worn), acTotal }
  })

  const shields = list
    .filter(({ a }) => a.prof === 'shield')
    .map(({ a, index }) => {
      let amount = null
      const pb = a.worn && ac.shieldBonus !== null && ac.shieldBonus !== undefined && ac.shieldBonus !== '' ? Number(ac.shieldBonus) : NaN
      if (Number.isFinite(pb)) amount = pb
      else {
        const info = corpus.shield ? corpus.shield(a.name) : null
        if (info && Number.isFinite(Number(info.acBonus))) amount = Number(info.acBonus)
        else ctx.warn('shield_bonus_unknown', `gear.shields[${index}].acBonus`, `No shield bonus for "${a.name}"`)
      }
      return {
        index,
        name: a.name,
        qty: num(a.qty) || 1,
        wornInExport: Boolean(a.worn),
        acBonus: amount === null ? null : stat([line('Shield bonus', amount, 'circumstance')]),
      }
    })

  return { unarmoredAc, armor, shields }
}

/**
 * Total Bulk of listed items (qty applied, containers ignored, equip state ignored, 1000 coins = 1 Bulk)
 * plus limits. `corpus.bulk(name)` returns a number, 'L' (light) or null; unknown items count 0 and
 * show up as one labelled line. Values below 1 pool into one "Light items" line (10 L = 1 Bulk).
 */
function deriveBulk(build, ctx, corpus = {}) {
  const items = [
    ...(build.equipment || []).map((e) => ({ name: e[0], qty: num(e[1]) || 1 })),
    ...(build.weapons || []).map((w) => ({ name: w.name, qty: num(w.qty) || 1 })),
    ...(build.armor || []).map((a) => ({ name: a.name, qty: num(a.qty) || 1 })),
  ]
  const lines = []
  let lightTenths = 0
  const unknown = []
  for (const { name, qty } of items) {
    const raw = corpus.bulk ? corpus.bulk(name) : null
    const tenths = raw === 'L' ? 1 : Number.isFinite(Number(raw)) && raw !== null && raw !== '' ? Math.round(Number(raw) * 10) : null
    if (tenths === null) {
      if (!unknown.includes(name)) unknown.push(name)
    } else if (tenths % 10 === 0) {
      if (tenths > 0) lines.push(line(qty > 1 ? `${name} x${qty}` : name, (tenths / 10) * qty, 'base'))
    } else {
      lightTenths += tenths * qty
    }
  }
  if (lightTenths > 0) lines.push(line(`Light items (${lightTenths} L)`, Math.floor(lightTenths / 10), 'base'))
  const m = build.money || {}
  const coins = num(m.cp) + num(m.sp) + num(m.gp) + num(m.pp)
  if (coins >= 1000) lines.push(line(`Coins (${coins})`, Math.floor(coins / 1000), 'base'))
  if (unknown.length) lines.push(line(`Unknown bulk, counted 0: ${unknown.join(', ')}`, 0, 'base'))
  const result = stat(lines)
  if (unknown.length) ctx.warn('bulk_unknown', 'gear.bulk', `${unknown.length} item(s) without corpus Bulk`)
  const str = abilityModOf(build, 'str')
  return { ...result, encumberedAt: 5 + str, max: 10 + str }
}

module.exports = { deriveWeapons, deriveArmor, deriveBulk }
