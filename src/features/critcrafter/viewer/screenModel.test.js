import test from 'node:test'
import assert from 'node:assert/strict'
import {
  signed,
  rankLadder,
  costGlyphs,
  costSortKey,
  actionGroupsView,
  gearGroupsView,
  bulkLine,
  damageText,
  spellsView,
} from './screenModel.js'
import { minimalSheet } from '../test/minimalSheet.js'

const entry = (name, cost = null, extra = {}) => ({
  key: name,
  name,
  kind: 'action',
  traits: [],
  cost,
  rules: null,
  aonUrl: null,
  ...extra,
})

test('signed formats bonuses with an explicit sign', () => {
  assert.equal(signed(7), '+7')
  assert.equal(signed(0), '+0')
  assert.equal(signed(-2), '−2')
})

test('rankLadder lists U T E M L with only the current rank marked', () => {
  const ladder = rankLadder('E')
  assert.deepEqual(
    ladder.map((r) => r.rank),
    ['U', 'T', 'E', 'M', 'L'],
  )
  assert.deepEqual(
    ladder.filter((r) => r.current).map((r) => r.rank),
    ['E'],
  )
})

test('costGlyphs maps costs to glyph keys, with ranges, and null for no glyph', () => {
  assert.deepEqual(costGlyphs({ kind: 'actions', min: 1, max: 1 }), ['single'])
  assert.deepEqual(costGlyphs({ kind: 'actions', min: 2, max: 2 }), ['two'])
  assert.deepEqual(costGlyphs({ kind: 'actions', min: 3, max: 3 }), ['three'])
  assert.deepEqual(costGlyphs({ kind: 'actions', min: 1, max: 3 }), ['single', 'to', 'three'])
  assert.deepEqual(costGlyphs({ kind: 'actions', min: 2, max: 3 }), ['two', 'to', 'three'])
  assert.deepEqual(costGlyphs({ kind: 'reaction' }), ['reaction'])
  assert.deepEqual(costGlyphs({ kind: 'free' }), ['free'])
  assert.equal(costGlyphs(null), null)
  assert.equal(costGlyphs({ kind: null }), null)
  assert.equal(costGlyphs({ kind: 'time', label: '10 minutes' }), null)
})

test('costSortKey orders free, 1, 2, 3, reaction, then time and costless', () => {
  const names = [
    entry('time', { kind: 'time', label: '1 minute' }),
    entry('react', { kind: 'reaction' }),
    entry('three', { kind: 'actions', min: 3, max: 3 }),
    entry('none', null),
    entry('one', { kind: 'actions', min: 1, max: 1 }),
    entry('free', { kind: 'free' }),
    entry('two', { kind: 'actions', min: 2, max: 2 }),
  ]
  const sorted = [...names].sort((a, b) => costSortKey(a.cost) - costSortKey(b.cost)).map((e) => e.name)
  assert.deepEqual(sorted.slice(0, 5), ['free', 'one', 'two', 'three', 'react'])
  assert.deepEqual(sorted.slice(5).sort(), ['none', 'time'])
})

test('actionGroupsView keeps sheet group order, sorts by cost, omits empty groups, keeps defaultOpen', () => {
  const view = actionGroupsView({
    groups: [
      { id: 'class', label: 'Class', defaultOpen: true, entries: [entry('B', { kind: 'actions', min: 2, max: 2 }), entry('A', { kind: 'free' })] },
      { id: 'ancestry', label: 'Ancestry', defaultOpen: true, entries: [] },
      { id: 'skill', label: 'Skill actions', defaultOpen: false, entries: [entry('S', { kind: 'reaction' })] },
    ],
  })
  assert.deepEqual(view.map((g) => g.id), ['class', 'skill'])
  assert.deepEqual(view[0].entries.map((e) => e.name), ['A', 'B'])
  assert.equal(view[0].defaultOpen, true)
  assert.equal(view[1].defaultOpen, false)
})

test('actionGroupsView sort is stable for equal costs', () => {
  const view = actionGroupsView({
    groups: [{ id: 'class', label: 'Class', defaultOpen: true, entries: [entry('Z', { kind: 'free' }), entry('A', { kind: 'free' })] }],
  })
  assert.deepEqual(view[0].entries.map((e) => e.name), ['Z', 'A'])
})

test('gearGroupsView orders groups, counts quantity-less rows, and omits empty groups', () => {
  const gear = minimalSheet().gear
  gear.weapons = [{ ...entry('Sword'), qty: 1 }]
  gear.armor = [{ ...entry('Mail'), qty: 1 }]
  gear.consumables = [{ ...entry('Potion'), qty: 3 }]
  const view = gearGroupsView(gear)
  assert.deepEqual(view.map((g) => g.id), ['weapons', 'armor', 'consumables'])
  assert.deepEqual(view.map((g) => g.label), ['Weapons', 'Armor', 'Consumables'])
  assert.deepEqual(view.map((g) => g.count), [1, 1, 1])
})

test('gearGroupsView puts Shields between Weapons and Armor', () => {
  const gear = minimalSheet().gear
  gear.weapons = [{ ...entry('Sword'), qty: 1 }]
  gear.shields = [{ ...entry('Shield'), qty: 1 }]
  gear.armor = [{ ...entry('Mail'), qty: 1 }]
  gear.gear = [{ ...entry('Rope'), qty: 1 }]
  assert.deepEqual(gearGroupsView(gear).map((g) => g.id), ['weapons', 'shields', 'armor', 'gear'])
})

test('bulkLine reads "Bulk n / limit" against the encumbered threshold', () => {
  assert.equal(bulkLine({ value: 6, encumberedAt: 9, max: 14 }), 'Bulk 6 / 9')
  assert.equal(bulkLine({ value: 0, encumberedAt: 9, max: 14 }), 'Bulk 0 / 9')
})

test('damageText shows dice with the signed bonus, omitting a zero bonus', () => {
  assert.equal(damageText({ damage: { dice: '1d8', bonus: { value: 4 } } }), '1d8+4')
  assert.equal(damageText({ damage: { dice: '1d6', bonus: { value: 0 } } }), '1d6')
  assert.equal(damageText({ damage: { dice: '1d6', bonus: { value: -1 } } }), '1d6−1')
})

test('spellsView: casters by rank (cantrips first), one focus section, rituals last, empties omitted', () => {
  const sheet = minimalSheet()
  const sp = (n, rank) => ({ ...entry(n, { kind: 'actions', min: 2, max: 2 }), kind: 'spell', rank })
  sheet.spells = {
    casters: [
      {
        key: 'c1', name: 'Wizard', tradition: 'arcane', kind: 'prepared', attack: { value: 7, breakdown: [] }, dc: { value: 17, breakdown: [] }, slots: { 1: 3 },
        ranks: [
          { rank: 1, entries: [sp('Fireball', 1)] },
          { rank: 0, entries: [sp('Shield', 0)] },
          { rank: 2, entries: [] },
        ],
      },
      { key: 'c2', name: 'Empty', tradition: null, kind: 'innate', attack: null, dc: null, slots: {}, ranks: [{ rank: 1, entries: [] }] },
    ],
    focus: { pool: 1, attack: null, dc: null, cantrips: [sp('Light', 0)], spells: [sp('Hex', 1)] },
    rituals: [sp('Ritual', 4)],
  }
  const v = spellsView(sheet.spells)
  assert.deepEqual(v.casters.map((c) => c.name), ['Wizard'])
  assert.deepEqual(v.casters[0].ranks.map((r) => r.label), ['Cantrips', 'Rank 1'])
  assert.deepEqual(v.casters[0].ranks.map((r) => r.slots), [null, 3])
  assert.deepEqual(v.focus.entries.map((e) => e.name), ['Light', 'Hex'])
  assert.equal(v.focus.pool, 1)
  assert.deepEqual(v.rituals.map((e) => e.name), ['Ritual'])
})

test('spellsView omits focus when it has no entries and rituals when none', () => {
  const v = spellsView({ casters: [], focus: { pool: 0, attack: null, dc: null, cantrips: [], spells: [] }, rituals: [] })
  assert.equal(v.focus, null)
  assert.deepEqual(v.rituals, [])
  assert.deepEqual(v.casters, [])
})
