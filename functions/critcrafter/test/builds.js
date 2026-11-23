'use strict'
// Test builds: the committed Pathbuilder exports, and a minimal synthetic build factory.
const fs = require('node:fs')
const path = require('node:path')

const exportsDir = path.join(__dirname, '../../../docs/critcrafter/fixtures/pathbuilder-exports')

function loadBuild(name) {
  return JSON.parse(fs.readFileSync(path.join(exportsDir, `${name}.json`), 'utf8')).build
}

const EXPORT_NAMES = [
  'anya',
  'cy-an-copperbottom',
  'dwarf-fighter-barbarian-resiliency',
  'dwarf-fighter-toughness',
  'lithrei-woeborn',
  'solanum-calabash',
  'taraan-skyseeker',
  'yggostrus',
]

/** A level-1, all-untrained, all-10s build. Override any top-level key (shallow, except where noted). */
function syntheticBuild(overrides = {}) {
  const base = {
    name: 'Synthetic',
    class: 'Fighter',
    dualClass: null,
    level: 1,
    ancestry: 'Human',
    heritage: 'Versatile Human',
    background: 'Scholar',
    deity: 'Not set',
    size: 2,
    sizeName: 'Medium',
    keyability: 'str',
    languages: [],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    attributes: { ancestryhp: 8, classhp: 10, bonushp: 0, bonushpPerLevel: 0, speed: 25, speedBonus: 0 },
    proficiencies: {
      classDC: 0, perception: 0, fortitude: 0, reflex: 0, will: 0,
      heavy: 0, medium: 0, light: 0, unarmored: 0, advanced: 0, martial: 0, simple: 0, unarmed: 0,
      castingArcane: 0, castingDivine: 0, castingOccult: 0, castingPrimal: 0,
      acrobatics: 0, arcana: 0, athletics: 0, crafting: 0, deception: 0, diplomacy: 0,
      intimidation: 0, medicine: 0, nature: 0, occultism: 0, performance: 0, religion: 0,
      society: 0, stealth: 0, survival: 0, thievery: 0, piloting: 0, computers: 0,
    },
    mods: {},
    lores: [],
    feats: [],
    specials: [],
    equipment: [],
    specificProficiencies: { trained: [], expert: [], master: [], legendary: [] },
    weapons: [],
    money: { cp: 0, sp: 0, gp: 0, pp: 0 },
    armor: [],
    spellCasters: [],
    focusPoints: 0,
    focus: {},
    acTotal: { acProfBonus: 0, acAbilityBonus: 0, acItemBonus: 0, acTotal: 10, shieldBonus: null },
    pets: [],
    familiars: [],
  }
  const out = { ...base, ...overrides }
  if (overrides.abilities) out.abilities = { ...base.abilities, ...overrides.abilities }
  if (overrides.attributes) out.attributes = { ...base.attributes, ...overrides.attributes }
  if (overrides.proficiencies) out.proficiencies = { ...base.proficiencies, ...overrides.proficiencies }
  return out
}

module.exports = { loadBuild, syntheticBuild, EXPORT_NAMES }
