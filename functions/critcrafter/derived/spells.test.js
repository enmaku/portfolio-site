'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadBuild, syntheticBuild } = require('../test/builds')
const { createContext } = require('./stat')
const { deriveCasters, deriveFocus } = require('./spells')

test('real and archetype casters get attack and DC from ability + proficiency + level', () => {
  const b = loadBuild('lithrei-woeborn')
  const ctx = createContext(b)
  const casters = deriveCasters(b, ctx)
  assert.deepEqual(casters.map((c) => [c.key, c.kind, c.tradition]), [
    ['caster:oracle#1', 'spontaneous', 'divine'],
    ['caster:other-spells-staves-etc#1', 'prepared', 'arcane'],
    ['caster:archetype-oracle#1', 'archetype', 'divine'],
  ])
  const oracle = casters[0]
  assert.equal(oracle.attack.value, 3 + 2 + 2)
  assert.deepEqual(oracle.attack.breakdown, [
    { label: 'Charisma', amount: 3, type: 'ability' },
    { label: 'Trained', amount: 2, type: 'proficiency' },
    { label: 'Level', amount: 2, type: 'level' },
  ])
  assert.equal(oracle.dc.value, 10 + 3 + 2 + 2)
  assert.deepEqual(oracle.dc.breakdown[0], { label: 'Base', amount: 10, type: 'base' })
  assert.equal(casters[2].attack.value, 7)
})

test('Other Spells (Staves etc) gets null attack and DC plus a warning', () => {
  const b = loadBuild('lithrei-woeborn')
  const ctx = createContext(b)
  const other = deriveCasters(b, ctx)[1]
  assert.equal(other.attack, null)
  assert.equal(other.dc, null)
  assert.deepEqual(ctx.warnings.map((w) => w.code), ['other_spells_no_dc'])
})

test('innate ancestry caster typed prepared is classified innate and still gets stats', () => {
  const b = loadBuild('yggostrus')
  const casters = deriveCasters(b, createContext(b))
  assert.deepEqual(casters.map((c) => c.kind), ['spontaneous', 'innate'])
  assert.equal(casters[1].attack.value, 4 + 2 + 1)
})

test('slots list spell names per rank, union of spells and prepared, and key slots:<caster>:<rank>', () => {
  const b = syntheticBuild({
    level: 17,
    abilities: { int: 20 },
    spellCasters: [
      {
        name: 'Wizard', magicTradition: 'arcane', spellcastingType: 'prepared', ability: 'int',
        proficiency: 6, focusPoints: 0, innate: false,
        perDay: [5, 4, 4, 4, 4, 4, 3, 3, 2, 1, 0],
        spells: [
          { spellLevel: 0, list: ['Shield', 'Shield', 'Daze'] },
          { spellLevel: 8, list: ['Maze'] },
          { spellLevel: 9, list: ['Wish'] },
        ],
        prepared: [{ spellLevel: 9, list: ['Wish', 'Overwhelming Presence'] }],
        blendedSpells: [],
      },
    ],
  })
  const [w] = deriveCasters(b, createContext(b))
  assert.equal(w.attack.value, 5 + 6 + 17)
  assert.deepEqual(w.slots, { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 3, 7: 3, 8: 2, 9: 1 })
  const rank = (n) => w.ranks.find((r) => r.rank === n)
  assert.deepEqual(rank(9), { rank: 9, slotKey: 'slots:caster:wizard#1:9', names: [{ name: 'Wish', count: 1 }, { name: 'Overwhelming Presence', count: 1 }] })
  assert.deepEqual(rank(8).names, [{ name: 'Maze', count: 1 }])
  assert.deepEqual(rank(0), { rank: 0, slotKey: null, names: [{ name: 'Shield', count: 2 }, { name: 'Daze', count: 1 }] })
  assert.equal(rank(1), undefined)
})

test('no casters gives an empty list', () => {
  assert.deepEqual(deriveCasters(loadBuild('dwarf-fighter-toughness'), createContext()), [])
})

test('focus: pool, attack and DC from the tradition entry', () => {
  const b = loadBuild('taraan-skyseeker')
  const ctx = createContext(b)
  const f = deriveFocus(b, ctx)
  assert.equal(f.pool, 2)
  assert.equal(f.attack.value, 4 + 2 + 2)
  assert.equal(f.dc.value, 10 + 4 + 2 + 2)
  assert.deepEqual(f.cantrips, ['Discern Secrets'])
  assert.deepEqual(f.spells, ['Phase Familiar', 'Elemental Betrayal'])
  assert.deepEqual(ctx.warnings, [])
})

test('focus with several traditions uses the highest bonus and warns listing the others', () => {
  const b = syntheticBuild({
    level: 3,
    focusPoints: 1,
    focus: {
      arcane: { int: { abilityBonus: 1, proficiency: 2, itemBonus: 0, focusCantrips: [], focusSpells: ['A'] } },
      divine: { wis: { abilityBonus: 3, proficiency: 2, itemBonus: 1, focusCantrips: [], focusSpells: ['B'] } },
    },
  })
  const ctx = createContext(b)
  const f = deriveFocus(b, ctx)
  assert.equal(f.attack.value, 3 + 2 + 3 + 1)
  assert.deepEqual(f.attack.breakdown.map((l) => l.type), ['ability', 'proficiency', 'level', 'item'])
  assert.deepEqual(f.spells, ['A', 'B'])
  assert.equal(ctx.warnings.length, 1)
  assert.equal(ctx.warnings[0].code, 'focus_multiple_traditions')
  assert.match(ctx.warnings[0].detail, /arcane/)
})

test('no focus entries and no pool gives null', () => {
  assert.equal(deriveFocus(loadBuild('dwarf-fighter-toughness'), createContext()), null)
})
