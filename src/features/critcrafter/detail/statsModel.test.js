import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { minimalSheet } from '../test/minimalSheet.js'
import { statsScreenView, topperTargets } from './statsModel.js'
import { breakdownView } from './breakdownModel.js'

const st = (value, label = 'Base', type = 'base') => ({ value, breakdown: [{ label, amount: value, type }] })

function richSheet() {
  const s = minimalSheet()
  s.stats.abilities = [
    { id: 'str', score: 18, mod: 4 },
    { id: 'cha', score: 8, mod: -1 },
  ]
  s.spells = {
    casters: [
      { key: 'c1', name: 'Oracle', tradition: 'divine', kind: 'spontaneous', attack: st(7), dc: st(17), slots: {}, ranks: [] },
      { key: 'c2', name: 'Staves', tradition: null, kind: 'innate', attack: null, dc: null, slots: {}, ranks: [] },
    ],
    focus: { pool: 1, attack: st(7), dc: st(17), cantrips: [], spells: [] },
    rituals: [],
  }
  return s
}

test('statsScreenView lists saves with rank and a signed tappable stat', () => {
  const v = statsScreenView(minimalSheet())
  assert.deepEqual(v.saves.map((r) => [r.label, r.rank, r.stat.value, r.signed]), [['Fortitude', 'T', 5, true]])
})

test('abilities are number-only (score and signed mod, no breakdown)', () => {
  const v = statsScreenView(richSheet())
  assert.deepEqual(v.abilities.map((a) => [a.label, a.score, a.mod]), [
    ['STR', 18, '+4'],
    ['CHA', 8, '−1'],
  ])
})

test('DC & attack: class DC, then focus attack and DC, then each caster attack and DC, skipping nulls', () => {
  const v = statsScreenView(richSheet())
  assert.deepEqual(
    v.dc.map((r) => [r.label, r.signed]),
    [
      ['Class DC', false],
      ['Focus spell attack', true],
      ['Focus spell DC', false],
      ['Oracle spell attack', true],
      ['Oracle spell DC', false],
    ],
  )
})

test('topperTargets exposes AC, Perception, Speed and HP max as tappable stats', () => {
  const t = topperTargets(minimalSheet())
  assert.deepEqual(
    [t.ac, t.perception, t.speed, t.hp].map((x) => [x.label, x.stat.value, x.signed]),
    [
      ['AC', 10, false],
      ['Perception', 5, true],
      ['Speed', 25, false],
      ['HP max', 18, false],
    ],
  )
})

test('every tappable stat in the fixtures opens a breakdown whose rows sum to the total', () => {
  const dir = new URL('../fixtures/', import.meta.url)
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sheet.json'))) {
    const sheet = JSON.parse(readFileSync(new URL(f, dir), 'utf8'))
    const v = statsScreenView(sheet)
    const t = topperTargets(sheet)
    const targets = [...v.saves, ...v.dc, t.ac, t.perception, t.speed, t.hp]
    for (const x of targets) {
      const view = breakdownView(x.label, x.stat, { signed: x.signed })
      const sum = x.stat.breakdown.reduce((n, b) => n + b.amount, 0)
      assert.equal(sum, x.stat.value, `${f} ${x.label}`)
      assert.equal(view.rows.length, x.stat.breakdown.length)
    }
  }
})

test('DC & attack: a caster whose attack and DC are identical to an earlier caster is listed once', () => {
  const s = richSheet()
  s.spells.casters.push({ key: 'c3', name: 'Archetype Oracle', tradition: 'divine', kind: 'archetype', attack: st(7), dc: st(17), slots: {}, ranks: [] })
  const labels = statsScreenView(s).dc.map((r) => r.label)
  assert.deepEqual(labels.filter((l) => /Oracle/.test(l)), ['Oracle spell attack', 'Oracle spell DC'])
})

test('DC & attack: casters with different numbers are both listed', () => {
  const s = richSheet()
  s.spells.casters.push({ key: 'c3', name: 'Archetype Oracle', tradition: 'divine', kind: 'archetype', attack: st(5), dc: st(15), slots: {}, ranks: [] })
  const labels = statsScreenView(s).dc.map((r) => r.label)
  assert.ok(labels.includes('Archetype Oracle spell attack'))
  assert.ok(labels.includes('Archetype Oracle spell DC'))
})
