import test from 'node:test'
import assert from 'node:assert/strict'
import { breakdownView } from './breakdownModel.js'

const fort = {
  value: 5,
  breakdown: [
    { label: 'Constitution', amount: 2, type: 'ability' },
    { label: 'Trained', amount: 2, type: 'proficiency' },
    { label: 'Level', amount: 1, type: 'level' },
  ],
}

test('breakdownView lists rows in sheet order with signed amounts and type chips', () => {
  const v = breakdownView('Fortitude', fort)
  assert.equal(v.title, 'Fortitude')
  assert.equal(v.total, '+5')
  assert.deepEqual(
    v.rows.map((r) => [r.label, r.amount, r.chip]),
    [
      ['Constitution', '+2', 'ability'],
      ['Trained', '+2', 'proficiency'],
      ['Level', '+1', 'level'],
    ],
  )
})

test('negative amounts use a true minus sign', () => {
  const v = breakdownView('Speed', {
    value: 20,
    breakdown: [
      { label: 'Base', amount: 25, type: 'base' },
      { label: 'Armor', amount: -5, type: 'untyped' },
    ],
  })
  assert.equal(v.rows[1].amount, '−5')
})

test('flat totals (AC, DC, Speed) are unsigned; bonuses are signed', () => {
  const ac = breakdownView(
    'AC',
    {
      value: 18,
      breakdown: [
        { label: 'Base', amount: 10, type: 'base' },
        { label: 'Dex', amount: 8, type: 'ability' },
      ],
    },
    { signed: false },
  )
  assert.equal(ac.total, '18')
  assert.deepEqual(ac.rows.map((r) => r.amount), ['10', '8'])
})

test('Other (from Pathbuilder) and Untrained are plain rows without a chip', () => {
  const v = breakdownView('Stealth', {
    value: 0,
    breakdown: [
      { label: 'Untrained', amount: 0, type: 'proficiency' },
      { label: 'Other (from Pathbuilder)', amount: 0, type: 'untyped' },
    ],
  })
  assert.deepEqual(
    v.rows.map((r) => [r.amount, r.chip, r.plain]),
    [
      ['+0', null, true],
      ['+0', null, true],
    ],
  )
})

test('linked actions pass through for the sheet to list', () => {
  const grapple = { key: 'actions:grapple#1', name: 'Grapple' }
  assert.deepEqual(breakdownView('Athletics', { ...fort, actions: [grapple] }).actions, [grapple])
  assert.deepEqual(breakdownView('Fortitude', fort).actions, [])
})
