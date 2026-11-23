'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadBuild, syntheticBuild } = require('../test/builds')
const { deriveMaxHp, deriveSpeed } = require('./hp')
const { deriveAbilities } = require('./abilities')

test('Toughness-only Dwarf Fighter has 80 max HP', () => {
  const hp = deriveMaxHp(loadBuild('dwarf-fighter-toughness'))
  assert.equal(hp.value, 80)
  assert.deepEqual(hp.breakdown, [
    { label: 'Ancestry HP', amount: 10, type: 'base' },
    { label: 'Class HP (10 x level 5)', amount: 50, type: 'base' },
    { label: 'Constitution (+3 x level 5)', amount: 15, type: 'ability' },
    { label: 'Bonus HP per level (1 x level 5)', amount: 5, type: 'untyped' },
  ])
})

test('flat bonushp is added once, not per level: Resiliency Dwarf Fighter has 86', () => {
  const hp = deriveMaxHp(loadBuild('dwarf-fighter-barbarian-resiliency'))
  assert.equal(hp.value, 86)
  assert.deepEqual(hp.breakdown.find((b) => b.label === 'Bonus HP'), { label: 'Bonus HP', amount: 6, type: 'untyped' })
})

test('negative Con modifier lowers HP per level', () => {
  const hp = deriveMaxHp(syntheticBuild({ level: 3, abilities: { con: 8 } }))
  assert.equal(hp.value, 8 + (10 - 1) * 3)
})

test('speed is base plus bonus', () => {
  const s = deriveSpeed(loadBuild('anya'))
  assert.equal(s.value, 30)
  assert.deepEqual(s.breakdown, [
    { label: 'Base speed', amount: 25, type: 'base' },
    { label: 'Speed bonus', amount: 5, type: 'untyped' },
  ])
  assert.deepEqual(deriveSpeed(loadBuild('taraan-skyseeker')).breakdown, [{ label: 'Base speed', amount: 25, type: 'base' }])
})

test('abilities carry score and floor((score-10)/2) mod, no breakdown', () => {
  const a = deriveAbilities(syntheticBuild({ abilities: { str: 18, dex: 9, con: 7, int: 10, wis: 11, cha: 20 } }))
  assert.deepEqual(a, [
    { id: 'str', score: 18, mod: 4 },
    { id: 'dex', score: 9, mod: -1 },
    { id: 'con', score: 7, mod: -2 },
    { id: 'int', score: 10, mod: 0 },
    { id: 'wis', score: 11, mod: 0 },
    { id: 'cha', score: 20, mod: 5 },
  ])
})
