'use strict'
// Shared building blocks for the derived-stat module: Stat construction, ranks, ability mods,
// the warnings collector and the Pathbuilder `mods` index.

const ABILITY_IDS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const ABILITY_NAMES = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
}
const RANK_NAMES = { 0: 'Untrained', 2: 'Trained', 4: 'Expert', 6: 'Master', 8: 'Legendary' }
const RANK_LETTERS = { 0: 'U', 2: 'T', 4: 'E', 6: 'M', 8: 'L' }

function abilityMod(score) {
  return Math.floor((Number(score) - 10) / 2)
}

function abilityModOf(build, id) {
  return abilityMod(build.abilities && build.abilities[id] !== undefined ? build.abilities[id] : 10)
}

function line(label, amount, type) {
  return { label, amount, type }
}

/** Build a Stat from breakdown lines; value is their sum by construction. */
function stat(lines) {
  return { value: lines.reduce((n, l) => n + l.amount, 0), breakdown: lines }
}

/**
 * Pathbuilder's own total wins: when the rebuilt lines disagree, append an
 * "Other (from Pathbuilder)" line carrying the difference and warn.
 */
function statWithTotal(lines, pbTotal, ctx, path) {
  const sum = lines.reduce((n, l) => n + l.amount, 0)
  if (!Number.isInteger(pbTotal) || pbTotal === sum) return stat(lines)
  ctx.warn('breakdown_residual', path, `Rebuilt ${sum}, Pathbuilder says ${pbTotal}`)
  return stat([...lines, line('Other (from Pathbuilder)', pbTotal - sum, 'untyped')])
}

function normaliseRank(n) {
  const v = Number(n)
  return RANK_NAMES[v] !== undefined ? v : 0
}

/** Proficiency (and level when trained or better). Untrained is a 0 line with no level line. */
function proficiencyLines(rankValue, level) {
  const r = normaliseRank(rankValue)
  if (r === 0) return [line('Untrained', 0, 'proficiency')]
  return [line(RANK_NAMES[r], r, 'proficiency'), line('Level', level, 'level')]
}

function abilityLine(build, id) {
  return line(ABILITY_NAMES[id], abilityModOf(build, id), 'ability')
}

/** Per-derivation context: the warnings collector and the mods index (`ctx.mods`). */
function createContext(build) {
  const warnings = []
  const ctx = {
    warnings,
    warn(code, path, detail) {
      warnings.push({ code, path, detail })
    },
  }
  ctx.mods = createModsIndex((build && build.mods) || {}, ctx)
  return ctx
}

const MOD_TYPES = {
  'item bonus': 'item',
  'status bonus': 'status',
  'circumstance bonus': 'circumstance',
  'untyped bonus': 'untyped',
  untyped: 'untyped',
  item: 'item',
  status: 'status',
  circumstance: 'circumstance',
}

/**
 * Index over `build.mods` ({ label: { 'Item Bonus': n } }). `linesFor(label)` returns typed
 * breakdown lines and marks the label as consumed; `reportUnused()` warns for the rest.
 */
function createModsIndex(mods, ctx) {
  const entries = new Map()
  for (const [label, byType] of Object.entries(mods || {})) {
    entries.set(String(label).toLowerCase(), { label, byType: byType || {}, used: false })
  }
  return {
    linesFor(label) {
      const e = entries.get(String(label).toLowerCase())
      if (!e) return []
      e.used = true
      const out = []
      for (const [bonusType, amount] of Object.entries(e.byType)) {
        const type = MOD_TYPES[String(bonusType).toLowerCase()]
        if (!type) {
          ctx.warn('mods_unknown_type', `mods[${e.label}]`, `Unknown bonus type "${bonusType}"`)
          continue
        }
        if (Number.isInteger(amount) && amount !== 0) out.push(line(`${bonusType}`, amount, type))
      }
      return out
    },
    reportUnused() {
      for (const e of entries.values()) {
        if (!e.used) ctx.warn('mods_unknown_label', `mods[${e.label}]`, `No stat matches the label "${e.label}"`)
      }
    },
  }
}

module.exports = {
  ABILITY_IDS,
  ABILITY_NAMES,
  RANK_NAMES,
  RANK_LETTERS,
  abilityMod,
  abilityModOf,
  abilityLine,
  line,
  stat,
  statWithTotal,
  normaliseRank,
  proficiencyLines,
  createContext,
  createModsIndex,
}
