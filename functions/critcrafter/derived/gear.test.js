'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadBuild, syntheticBuild } = require('../test/builds')
const { createContext } = require('./stat')
const { deriveWeapons, deriveArmor, deriveBulk } = require('./gear')

test('weapon attack is rebuilt: ability + proficiency + level', () => {
  const b = loadBuild('cy-an-copperbottom')
  const [dagger] = deriveWeapons(b, createContext(b))
  assert.equal(dagger.name, 'Dagger')
  assert.deepEqual(dagger.attack, {
    value: 6,
    breakdown: [
      { label: 'Strength', amount: 3, type: 'ability' },
      { label: 'Trained', amount: 2, type: 'proficiency' },
      { label: 'Level', amount: 1, type: 'level' },
    ],
  })
  assert.equal(dagger.damage.dice, '1d4 P')
  assert.deepEqual(dagger.damage.bonus, { value: 3, breakdown: [{ label: 'Pathbuilder damage bonus', amount: 3, type: 'untyped' }] })
})

test('potency counts as an item line and a finesse-style Dex attack is recognised', () => {
  const b = loadBuild('taraan-skyseeker')
  const ctx = createContext(b)
  const weapons = deriveWeapons(b, ctx)
  const wordreaper = weapons.find((w) => w.name === 'Wordreaper')
  assert.equal(wordreaper.attack.value, 7)
  assert.deepEqual(wordreaper.attack.breakdown.map((l) => [l.label, l.amount]), [
    ['Dexterity', 2], ['Trained', 2], ['Level', 2], ['Potency rune', 1],
  ])
  assert.deepEqual(ctx.warnings, [])
})

test('specificProficiencies raise a weapon above its category', () => {
  const b = loadBuild('taraan-skyseeker')
  const pick = deriveWeapons(b, createContext(b)).find((w) => w.name === 'Pick')
  assert.equal(pick.attack.value, 4)
  assert.equal(pick.attack.breakdown.find((l) => l.type === 'proficiency').label, 'Trained')
})

test('striking runes change the dice count', () => {
  const b = syntheticBuild({
    weapons: [{ name: 'Axe', qty: 1, prof: 'martial', die: 'd8', pot: 2, str: 'greaterStriking', damageType: 'S', attack: 2, damageBonus: 0 }],
  })
  const [w] = deriveWeapons(b, createContext(b))
  assert.equal(w.damage.dice, '3d8 S')
})

test('a Pathbuilder attack that the rebuild cannot explain wins, with a residual line and a warning', () => {
  const b = syntheticBuild({
    weapons: [{ name: 'Odd', qty: 1, prof: 'simple', die: 'd4', pot: 0, str: '', damageType: 'B', attack: 9, damageBonus: 0 }],
  })
  const ctx = createContext(b)
  const [w] = deriveWeapons(b, ctx)
  assert.equal(w.attack.value, 9)
  assert.deepEqual(w.attack.breakdown.at(-1), { label: 'Other (from Pathbuilder)', amount: 9, type: 'untyped' })
  assert.deepEqual(ctx.warnings.map((x) => x.code), ['breakdown_residual'])
})

test('worn armor AC uses Pathbuilder components and matches acTotal', () => {
  const b = loadBuild('taraan-skyseeker')
  const ctx = createContext(b)
  const { armor } = deriveArmor(b, ctx)
  assert.equal(armor.length, 1)
  assert.equal(armor[0].name, 'Kilted Breastplate')
  assert.equal(armor[0].wornInExport, true)
  assert.deepEqual(armor[0].acTotal, {
    value: 18,
    breakdown: [
      { label: 'Base', amount: 10, type: 'base' },
      { label: 'Dexterity', amount: 2, type: 'ability' },
      { label: 'Trained', amount: 2, type: 'proficiency' },
      { label: 'Level', amount: 2, type: 'level' },
      { label: 'Item bonus', amount: 2, type: 'item' },
    ],
  })
})

test('shieldBonus string becomes its own number', () => {
  const b = loadBuild('taraan-skyseeker')
  const { shields } = deriveArmor(b, createContext(b))
  assert.equal(shields.length, 1)
  assert.equal(shields[0].name, "Caster's Targe")
  assert.deepEqual(shields[0].acBonus, { value: 1, breakdown: [{ label: 'Shield bonus', amount: 1, type: 'circumstance' }] })
})

test('unarmored AC with no armor worn comes from the Pathbuilder components', () => {
  const b = loadBuild('dwarf-fighter-toughness')
  const { unarmoredAc, armor, shields } = deriveArmor(b, createContext(b))
  assert.equal(unarmoredAc.value, 18)
  assert.deepEqual([armor, shields], [[], []])
})

test('unarmored AC while armored is rebuilt from the unarmored rank and Dex', () => {
  const b = loadBuild('taraan-skyseeker')
  const { unarmoredAc } = deriveArmor(b, createContext(b))
  assert.equal(unarmoredAc.value, 10 + 2 + 2 + 2)
})

test('AC mods become typed lines on top of the Pathbuilder components', () => {
  const b = syntheticBuild({ mods: { AC: { 'Circumstance Bonus': 1 } } })
  const ctx = createContext(b)
  const { unarmoredAc } = deriveArmor(b, ctx)
  assert.equal(unarmoredAc.value, 11)
  assert.deepEqual(ctx.warnings, [])
})

test('armor not worn needs the corpus; without it acTotal is null and a warning is raised', () => {
  const b = syntheticBuild({
    abilities: { dex: 16 },
    armor: [{ name: 'Chain Mail', qty: 1, prof: 'medium', pot: 1, res: '', worn: false, runes: [] }],
    proficiencies: { medium: 2 },
  })
  const ctx = createContext(b)
  assert.equal(deriveArmor(b, ctx).armor[0].acTotal, null)
  assert.deepEqual(ctx.warnings.map((w) => w.code), ['armor_ac_unknown'])
  const ctx2 = createContext(b)
  const { armor } = deriveArmor(b, ctx2, { armor: (n) => (n === 'Chain Mail' ? { acBonus: 4, dexCap: 1 } : null) })
  assert.deepEqual(armor[0].acTotal, {
    value: 10 + 1 + 2 + 1 + 4 + 1,
    breakdown: [
      { label: 'Base', amount: 10, type: 'base' },
      { label: 'Dexterity (cap +1)', amount: 1, type: 'ability' },
      { label: 'Trained', amount: 2, type: 'proficiency' },
      { label: 'Level', amount: 1, type: 'level' },
      { label: 'Item bonus', amount: 4, type: 'item' },
      { label: 'Potency rune', amount: 1, type: 'item' },
    ],
  })
  assert.deepEqual(ctx2.warnings, [])
})

test('raised shield: an unworn shield takes its bonus from the corpus', () => {
  const b = syntheticBuild({ armor: [{ name: 'Steel Shield', qty: 1, prof: 'shield', pot: 0, worn: false }] })
  const { shields } = deriveArmor(b, createContext(), { shield: () => ({ acBonus: 2 }) })
  assert.equal(shields[0].acBonus.value, 2)
})

test('bulk: integer items, light items pooled, coins, unknown items counted 0 and labelled', () => {
  const b = syntheticBuild({
    abilities: { str: 14 },
    equipment: [['Tent', 1, 'Invested'], ['Rope', 12, 'Invested'], ['Mystery', 3, 'Invested']],
    weapons: [{ name: 'Longsword', qty: 1, prof: 'martial', die: 'd8', pot: 0, str: '', damageType: 'S', attack: 0, damageBonus: 0 }],
    money: { cp: 0, sp: 0, gp: 2500, pp: 0 },
  })
  const table = { Tent: 2, Rope: 0.1, Longsword: 1 }
  const bulk = deriveBulk(b, createContext(), { bulk: (n) => (n in table ? table[n] : null) })
  assert.equal(bulk.value, 2 + 1 + 1 + 2)
  assert.equal(bulk.encumberedAt, 7)
  assert.equal(bulk.max, 12)
  assert.deepEqual(bulk.breakdown.map((l) => l.label), [
    'Tent', 'Longsword', 'Light items (12 L)', 'Coins (2500)', 'Unknown bulk, counted 0: Mystery',
  ])
  assert.deepEqual(bulk.breakdown.find((l) => l.label.startsWith('Unknown')).amount, 0)
})

test('bulk without a corpus lookup counts everything as unknown', () => {
  const b = loadBuild('taraan-skyseeker')
  const bulk = deriveBulk(b, createContext())
  assert.equal(bulk.max, 10)
  assert.equal(bulk.encumberedAt, 5)
  assert.equal(bulk.breakdown.filter((l) => l.label.startsWith('Unknown')).length, 1)
})

// mods.AC versus Pathbuilder's precomputed acTotal: no fixture carries an AC mod, so both readings are
// covered and the two must never double count (SPEC "Derived stats").
const withAcMod = (acTotal) => {
  const b = loadBuild('anya') // components sum to 14, worn Explorer's Clothing
  return { ...b, mods: { AC: { 'Item Bonus': 1 } }, acTotal: { ...b.acTotal, acTotal } }
}

test('mods.AC already inside Pathbuilder acTotal is counted once, with no residual line', () => {
  const b = withAcMod(15)
  const ctx = createContext(b)
  const { unarmoredAc, armor } = deriveArmor(b, ctx)
  for (const s of [unarmoredAc, armor[0].acTotal]) {
    assert.equal(s.value, 15)
    assert.equal(s.breakdown.filter((l) => l.amount === 1 && l.type === 'item').length, 1)
    assert.equal(s.breakdown.some((l) => /Other/.test(l.label)), false)
  }
  assert.deepEqual(ctx.warnings.filter((w) => w.code === 'breakdown_residual'), [])
})

test('mods.AC outside Pathbuilder acTotal is added on top', () => {
  const b = withAcMod(14)
  const { unarmoredAc, armor } = deriveArmor(b, createContext(b))
  assert.equal(unarmoredAc.value, 15)
  assert.equal(armor[0].acTotal.value, 15)
})
