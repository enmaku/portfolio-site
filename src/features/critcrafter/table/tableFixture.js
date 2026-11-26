// Test-side sheet builder for table-state tests: a minimal sheet plus the gear, spells and Con the
// table state reads. Values are small and hand-picked so expectations are checkable by eye.
import { minimalSheet } from '../test/minimalSheet.js'

function stat(value, label = 'Base', type = 'base') {
  return { value, breakdown: [{ label, amount: value, type }] }
}

function entry(key, extra = {}) {
  return { key, name: key, kind: 'equipment', traits: [], cost: null, rules: null, aonUrl: null, qty: 1, bulk: 0, price: null, ...extra }
}

export function tableSheet() {
  const s = minimalSheet()
  s.header.hp = stat(40)
  s.header.unarmoredAc = stat(15, 'Unarmored', 'base')
  s.stats.abilities = [
    { id: 'str', score: 18, mod: 4 },
    { id: 'con', score: 14, mod: 2 },
  ]
  s.gear.weapons = [
    entry('sword', { kind: 'weapon', hands: 1, versatile: 2, attack: stat(9), damage: { dice: '1d8 S', bonus: stat(4) } }),
    entry('dagger', { kind: 'weapon', hands: 1, versatile: null, attack: stat(9), damage: { dice: '1d4 P', bonus: stat(4) } }),
    entry('greatsword', { kind: 'weapon', hands: 2, versatile: null, attack: stat(9), damage: { dice: '1d12 S', bonus: stat(4) } }),
  ]
  s.gear.armor = [
    entry('leather', { kind: 'armor', acTotal: stat(17, 'Leather', 'item'), wornInExport: false }),
    entry('plate', { kind: 'armor', acTotal: stat(21, 'Plate', 'item'), wornInExport: false }),
  ]
  s.gear.shields = [
    entry('tower', { kind: 'shield', acBonus: stat(2), hands: 1, buckler: false, hardness: 5, hp: 20, bt: 10 }),
    entry('buckler', { kind: 'shield', acBonus: stat(1), hands: 1, buckler: true, hardness: 3, hp: 8, bt: 4 }),
  ]
  s.gear.consumables = [
    entry('potion', { kind: 'consumable', qty: 3 }),
    entry('arrows', { kind: 'consumable', qty: 20 }),
  ]
  s.spells = {
    casters: [{ key: 'wiz', name: 'Wizard', tradition: 'arcane', kind: 'prepared', attack: null, dc: null, slots: { 1: 3, 2: 2 }, ranks: [] }],
    focus: { pool: 2, attack: null, dc: null, cantrips: [], spells: [] },
    rituals: [],
  }
  return s
}
