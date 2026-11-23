'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadBuild, syntheticBuild, EXPORT_NAMES } = require('../test/builds')
const { findSumInvariantViolations } = require('../test/schemaHelpers')
const { deriveStats } = require('./index')

for (const name of EXPORT_NAMES) {
  test(`${name}: every Stat keeps the sum invariant`, () => {
    const d = deriveStats(loadBuild(name))
    assert.deepEqual(findSumInvariantViolations(d), [])
  })
}

// Literals hand-checked against the export fields (ability mods, ranks, level), not recomputed here.
const GOLDENS = {
  'dwarf-fighter-toughness': { hp: 80, speed: 20, perception: 10, classDc: 21, saves: [12, 10, 10], ac: 18, casters: [], focus: null },
  'dwarf-fighter-barbarian-resiliency': { hp: 86, speed: 20, perception: 10, classDc: 21, saves: [12, 10, 10], ac: 18, casters: [], focus: null },
  anya: { hp: 32, speed: 30, perception: 6, classDc: 17, saves: [8, 5, 8], ac: 14, casters: [[7, 17]], focus: [1, 7, 17] },
  'cy-an-copperbottom': { hp: 16, speed: 25, perception: 3, classDc: 15, saves: [7, 4, 5], ac: 14, casters: [[5, 15]], focus: null },
  'lithrei-woeborn': { hp: 26, speed: 25, perception: 9, classDc: 17, saves: [5, 6, 9], ac: 14, casters: [[7, 17], [null, null], [7, 17]], focus: [2, 7, 17] },
  'solanum-calabash': { hp: 18, speed: 25, perception: 4, classDc: 17, saves: [7, 4, 6], ac: 14, casters: [[4, 14]], focus: [1, 4, 14] },
  'taraan-skyseeker': { hp: 22, speed: 25, perception: 7, classDc: 17, saves: [6, 6, 9], ac: 16, casters: [[7, 17], [7, 17], [8, 18], [null, null]], focus: [2, 8, 18] },
  yggostrus: { hp: 19, speed: 20, perception: 5, classDc: 17, saves: [6, 5, 7], ac: 15, casters: [[7, 17], [7, 17]], focus: [1, 7, 17] },
}

for (const [name, expected] of Object.entries(GOLDENS)) {
  test(`${name}: golden headline numbers`, () => {
    const d = deriveStats(loadBuild(name))
    assert.deepEqual(
      {
        hp: d.hp.value,
        speed: d.speed.value,
        perception: d.perception.value,
        classDc: d.classDc.value,
        saves: d.saves.map((s) => s.bonus.value),
        ac: d.unarmoredAc.value,
        casters: d.casters.map((c) => [c.attack && c.attack.value, c.dc && c.dc.value]),
        focus: d.focus && [d.focus.pool, d.focus.attack.value, d.focus.dc.value],
      },
      expected,
    )
  })
}

test('worn armor AC and weapon attack equal the totals Pathbuilder precomputed, with no residual warnings', () => {
  for (const name of EXPORT_NAMES) {
    const b = loadBuild(name)
    const d = deriveStats(b)
    assert.deepEqual(d.warnings.filter((w) => w.code === 'breakdown_residual'), [], name)
    b.weapons.forEach((w, i) => assert.equal(d.weapons[i].attack.value, w.attack, `${name} ${w.name}`))
    const worn = b.armor.findIndex((a) => a.worn && a.prof !== 'shield')
    if (worn >= 0) assert.equal(d.armor.find((a) => a.index === worn).acTotal.value, b.acTotal.acTotal, name)
  }
})

test('output has the shape the sheet assembler needs', () => {
  const d = deriveStats(loadBuild('taraan-skyseeker'), { corpus: { bulk: () => 1 } })
  assert.deepEqual(Object.keys(d).sort(), [
    'abilities', 'armor', 'bulk', 'casters', 'classDc', 'focus', 'hp', 'perception',
    'saves', 'shields', 'skills', 'speed', 'unarmoredAc', 'warnings', 'weapons',
  ])
  assert.ok(d.bulk.value > 0)
})

test('unused mods labels surface as warnings', () => {
  const d = deriveStats(syntheticBuild({ mods: { Juggling: { 'Item Bonus': 1 } } }))
  assert.deepEqual(d.warnings.map((w) => w.code), ['mods_unknown_label'])
})

test('untrained build: every skill is the ability mod alone', () => {
  const d = deriveStats(syntheticBuild({ abilities: { cha: 14 } }))
  const dip = d.skills.find((s) => s.name === 'Diplomacy')
  assert.equal(dip.bonus.value, 2)
  assert.equal(dip.rank, 'U')
})

test('dual class: key ability and both class lines do not break derivation', () => {
  const d = deriveStats(syntheticBuild({ class: 'Cleric', dualClass: 'Witch', keyability: 'wis', abilities: { wis: 16 } }))
  assert.equal(d.classDc.value, 10 + 3)
})

test('nonzero HP bonuses on a synthetic build', () => {
  const d = deriveStats(syntheticBuild({ level: 4, attributes: { bonushp: 3, bonushpPerLevel: 2 } }))
  assert.equal(d.hp.value, 8 + 10 * 4 + 3 + 2 * 4)
})
