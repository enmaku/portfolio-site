'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadBuild, syntheticBuild } = require('../test/builds')
const { createContext } = require('./stat')
const { deriveSkills } = require('./skills')
const { deriveSaves, derivePerception, deriveClassDc } = require('./saves')

const taraan = () => loadBuild('taraan-skyseeker')
const byName = (skills, name) => skills.find((s) => s.name === name)

test('16 core skills come first in alphabetical order, then lores', () => {
  const skills = deriveSkills(taraan(), createContext(taraan()))
  assert.equal(skills.length, 16 + 5)
  assert.deepEqual(skills.slice(0, 3).map((s) => s.name), ['Acrobatics', 'Arcana', 'Athletics'])
  assert.equal(skills[15].name, 'Thievery')
  assert.deepEqual(skills.slice(16).map((s) => s.name), [
    'Architecture Lore', 'Fey Lore', 'Tengu Lore', 'ancient mwangi expanse Lore', 'Magambya Lore',
  ])
  assert.deepEqual(skills.slice(16).map((s) => s.lore), [true, true, true, true, true])
})

test('trained skill: ability + proficiency + level', () => {
  const skills = deriveSkills(taraan(), createContext(taraan()))
  const a = byName(skills, 'Acrobatics')
  assert.equal(a.rank, 'T')
  assert.equal(a.ability, 'dex')
  assert.deepEqual(a.bonus, {
    value: 6,
    breakdown: [
      { label: 'Dexterity', amount: 2, type: 'ability' },
      { label: 'Trained', amount: 2, type: 'proficiency' },
      { label: 'Level', amount: 2, type: 'level' },
    ],
  })
})

test('untrained skill is the ability mod alone, with no level line', () => {
  const stealth = byName(deriveSkills(taraan(), createContext(taraan())), 'Stealth')
  assert.equal(stealth.rank, 'U')
  assert.deepEqual(stealth.bonus, {
    value: 2,
    breakdown: [
      { label: 'Dexterity', amount: 2, type: 'ability' },
      { label: 'Untrained', amount: 0, type: 'proficiency' },
    ],
  })
})

test('mods become typed breakdown lines', () => {
  const b = taraan()
  const ctx = createContext(b)
  const dip = byName(deriveSkills(b, ctx), 'Diplomacy')
  assert.equal(dip.bonus.value, 1 + 2 + 2 + 1)
  assert.deepEqual(dip.bonus.breakdown[3], { label: 'Item Bonus', amount: 1, type: 'item' })
  assert.deepEqual(ctx.warnings, [])
})

test('lore uses Intelligence and its own rank', () => {
  const arch = byName(deriveSkills(taraan(), createContext(taraan())), 'Architecture Lore')
  assert.equal(arch.ability, 'int')
  assert.equal(arch.bonus.value, 4 + 2 + 2)
})

test('a mod for a lore label attaches to that lore', () => {
  const b = syntheticBuild({ lores: [['Cooking', 2]], mods: { Cooking: { 'Circumstance Bonus': 2 } } })
  const ctx = createContext(b)
  const cooking = byName(deriveSkills(b, ctx), 'Cooking Lore')
  assert.equal(cooking.bonus.value, 0 + 2 + 1 + 2)
  assert.deepEqual(ctx.warnings, [])
})

test('unknown mods label and unknown type warn', () => {
  const b = syntheticBuild({ mods: { Juggling: { 'Item Bonus': 1 }, Athletics: { 'Weird Bonus': 3 } } })
  const ctx = createContext(b)
  const ath = byName(deriveSkills(b, ctx), 'Athletics')
  ctx.mods.reportUnused()
  assert.equal(ath.bonus.value, 0)
  assert.deepEqual(ctx.warnings.map((w) => w.code).sort(), ['mods_unknown_label', 'mods_unknown_type'])
})

test('saves: ability + proficiency + level, Taraan', () => {
  const b = taraan()
  const saves = deriveSaves(b, createContext(b))
  assert.deepEqual(saves.map((s) => [s.id, s.name, s.rank, s.bonus.value]), [
    ['fortitude', 'Fortitude', 'E', 0 + 4 + 2],
    ['reflex', 'Reflex', 'T', 2 + 2 + 2],
    ['will', 'Will', 'E', 3 + 4 + 2],
  ])
})

test('saves honour mods (SoT computeSave ignored them)', () => {
  const b = syntheticBuild({ mods: { Will: { 'Status Bonus': 1 } } })
  const will = deriveSaves(b, createContext(b)).find((s) => s.id === 'will')
  assert.deepEqual(will.bonus.breakdown.at(-1), { label: 'Status Bonus', amount: 1, type: 'status' })
  assert.equal(will.bonus.value, 1)
})

test('perception uses Wisdom', () => {
  const b = taraan()
  const p = derivePerception(b, createContext(b))
  assert.equal(p.value, 3 + 2 + 2)
})

test('class DC is 10 + key ability + proficiency + level', () => {
  const b = taraan()
  const dc = deriveClassDc(b, createContext(b))
  assert.equal(dc.value, 10 + 3 + 2 + 2)
  assert.deepEqual(dc.breakdown[0], { label: 'Base', amount: 10, type: 'base' })
})

test('untrained class DC has no level', () => {
  const dc = deriveClassDc(syntheticBuild({ keyability: 'str', abilities: { str: 14 } }), createContext())
  assert.equal(dc.value, 10 + 2)
})
