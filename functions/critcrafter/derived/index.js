'use strict'
// Derived-stat module for the critcrafterSheet function. Pure CommonJS, no I/O.
//
//   deriveStats(build, { corpus }) -> {
//     abilities, saves, perception, classDc, skills, hp, speed, unarmoredAc,
//     bulk, weapons, armor, shields, casters, focus, warnings
//   }
//
// `build` is the `.build` of a Pathbuilder export. `corpus` is optional lookups the caller supplies
// from the rules corpus: bulk(name) -> number | 'L' | null, armor(name) -> { acBonus, dexCap } | null,
// shield(name) -> { acBonus } | null. Every number is a Stat { value, breakdown } whose breakdown sums
// to its value; anything swallowed lands in `warnings` ({ code, path, detail }).
const { createContext } = require('./stat')
const { deriveAbilities } = require('./abilities')
const { deriveSkills } = require('./skills')
const { deriveSaves, derivePerception, deriveClassDc } = require('./saves')
const { deriveCasters, deriveFocus } = require('./spells')
const { deriveWeapons, deriveArmor, deriveBulk } = require('./gear')
const { deriveMaxHp, deriveSpeed } = require('./hp')

function deriveStats(build, { corpus = {} } = {}) {
  const ctx = createContext(build)
  const { unarmoredAc, armor, shields } = deriveArmor(build, ctx, corpus)
  const result = {
    abilities: deriveAbilities(build),
    saves: deriveSaves(build, ctx),
    perception: derivePerception(build, ctx),
    classDc: deriveClassDc(build, ctx),
    skills: deriveSkills(build, ctx),
    hp: deriveMaxHp(build),
    speed: deriveSpeed(build),
    unarmoredAc,
    bulk: deriveBulk(build, ctx, corpus),
    weapons: deriveWeapons(build, ctx),
    armor,
    shields,
    casters: deriveCasters(build, ctx),
    focus: deriveFocus(build, ctx),
  }
  ctx.mods.reportUnused()
  result.warnings = ctx.warnings
  return result
}

module.exports = {
  deriveStats,
  deriveAbilities,
  deriveSkills,
  deriveSaves,
  derivePerception,
  deriveClassDc,
  deriveCasters,
  deriveFocus,
  deriveWeapons,
  deriveArmor,
  deriveBulk,
  deriveMaxHp,
  deriveSpeed,
}
