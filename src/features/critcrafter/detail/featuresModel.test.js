import test from 'node:test'
import assert from 'node:assert/strict'
import { entryTitle, detailView, featureGroups } from './featuresModel.js'

const feat = (name, level, extra = {}) => ({
  key: `features:${name.toLowerCase()}#1`,
  name,
  kind: 'feat',
  traits: [],
  cost: null,
  level,
  rules: { html: '<p>x</p>', license: 'ORC', remaster: true, source: 'Player Core' },
  aonUrl: null,
  ...extra,
})

test('entryTitle shows option in parentheses and count as x-n', () => {
  assert.equal(entryTitle(feat('Toughness', 1)), 'Toughness')
  assert.equal(entryTitle(feat('Skill Training', 2, { option: 'Intimidation' })), 'Skill Training (Intimidation)')
  assert.equal(entryTitle(feat('Toughness', 1, { count: 2 })), 'Toughness ×2')
  assert.equal(entryTitle(feat('Skill Training', 1, { option: 'Arcana', count: 3 })), 'Skill Training (Arcana) ×3')
})

test('featureGroups keeps group order, orders entries by level (stable), omits empty groups', () => {
  const groups = featureGroups({
    groups: [
      { id: 'class', label: 'Class', defaultOpen: true, entries: [feat('C', 3), feat('A', 1), feat('B', 1), feat('NoLevel', undefined)] },
      { id: 'general', label: 'General', defaultOpen: true, entries: [] },
      { id: 'ancestry', label: 'Ancestry', defaultOpen: true, entries: [feat('D', 1)] },
    ],
  })
  assert.deepEqual(groups.map((g) => g.id), ['class', 'ancestry'])
  assert.deepEqual(groups[0].rows.map((r) => r.title), ['A', 'B', 'C', 'NoLevel'])
  assert.deepEqual(groups[0].rows.map((r) => r.levelLabel), ['1', '1', '3', ''])
})

test('featureGroups tolerates a missing features block', () => {
  assert.deepEqual(featureGroups(undefined), [])
})

test('detailView of a corpus hit carries sanitised html and licence tag, no AoN link', () => {
  const v = detailView(feat('Toughness', 1))
  assert.equal(v.html, '<p>x</p>')
  assert.equal(v.licenseTag, 'ORC')
  assert.equal(v.source, 'Player Core')
  assert.equal(v.aonUrl, null)
})

test('detailView of a miss has no html and offers the AoN link', () => {
  const v = detailView(feat('Homebrew', 1, { rules: null, aonUrl: 'https://2e.aonprd.com/Search.aspx?q=Homebrew' }))
  assert.equal(v.html, null)
  assert.equal(v.licenseTag, null)
  assert.equal(v.aonUrl, 'https://2e.aonprd.com/Search.aspx?q=Homebrew')
})

test('detailView lists defense, range, area and duration when present, in that order, skipping empties', () => {
  const spell = detailView(feat('Fireball', 3, { kind: 'spell', defense: 'basic Reflex', range: '500 feet', area: '20-foot burst', duration: null }))
  assert.deepEqual(spell.facts, [
    { label: 'Defense', value: 'basic Reflex' },
    { label: 'Range', value: '500 feet' },
    { label: 'Area', value: '20-foot burst' },
  ])
  const bow = detailView(feat('Longbow', 0, { kind: 'weapon', range: 100 }))
  assert.deepEqual(bow.facts, [{ label: 'Range', value: '100 feet' }])
  assert.deepEqual(detailView(feat('Toughness', 1)).facts, [])
  const dur = detailView(feat('Haste', 3, { duration: '1 minute' }))
  assert.deepEqual(dur.facts, [{ label: 'Duration', value: '1 minute' }])
})

test('detailView carries item bulk and price for gear, null for other entries', () => {
  const item = detailView(feat('Rope', 0, { bulk: 'L', price: '5 sp' }))
  assert.equal(item.bulk, 'L')
  assert.equal(item.price, '5 sp')
  const plain = detailView(feat('Toughness', 1))
  assert.equal(plain.bulk, null)
  assert.equal(plain.price, null)
})
