import assert from 'node:assert/strict'
import test from 'node:test'
import {
  catalogHasResettableNames,
  compactNameMap,
  mergeProtectedSettlementNames,
  resolveSettlementNameGenerationMode,
} from './settlementNameCatalog.js'

test('resolveSettlementNameGenerationMode is empty when no current ids are named', () => {
  const plan = resolveSettlementNameGenerationMode({
    expectedSettlementIds: ['s1', 's2'],
    expectedFactionIds: ['f1'],
    catalog: {
      settlements: { gone: 'Oldtown' },
      factions: {},
      regionName: '   ',
    },
  })
  assert.equal(plan.mode, 'empty')
  assert.deepEqual(plan.provided, { settlements: {}, factions: {}, regionName: '' })
  assert.deepEqual(plan.missingSettlementIds, ['s1', 's2'])
  assert.deepEqual(plan.missingFactionIds, ['f1'])
  assert.equal(plan.missingRegionName, true)
})

test('resolveSettlementNameGenerationMode is partial when some current names are set', () => {
  const plan = resolveSettlementNameGenerationMode({
    expectedSettlementIds: ['s1', 's2'],
    expectedFactionIds: ['f1'],
    catalog: {
      settlements: { s1: 'Valen' },
      factions: {},
      regionName: '',
    },
  })
  assert.equal(plan.mode, 'partial')
  assert.deepEqual(plan.provided.settlements, { s1: 'Valen' })
  assert.deepEqual(plan.missingSettlementIds, ['s2'])
  assert.equal(plan.missingRegionName, true)
})

test('resolveSettlementNameGenerationMode is complete when every current id and the realm are named', () => {
  const plan = resolveSettlementNameGenerationMode({
    expectedSettlementIds: ['s1'],
    expectedFactionIds: ['f1'],
    catalog: {
      settlements: { s1: 'Valen', leftover: 'Ignore me' },
      factions: { f1: 'House Karn' },
      regionName: 'The Reach',
    },
  })
  assert.equal(plan.mode, 'complete')
  assert.deepEqual(plan.provided.settlements, { s1: 'Valen' })
  assert.deepEqual(plan.missingSettlementIds, [])
  assert.deepEqual(plan.missingFactionIds, [])
  assert.equal(plan.missingRegionName, false)
})

test('mergeProtectedSettlementNames never overwrites provided names', () => {
  const merged = mergeProtectedSettlementNames({
    provided: {
      settlements: { s1: 'Valen' },
      factions: { f1: 'House Karn' },
      regionName: 'The Reach',
    },
    generated: {
      settlements: { s1: 'Overwrite', s2: 'Rynn' },
      factions: { f1: 'Nope', f2: 'League' },
      regionName: 'Otherland',
    },
    expectedSettlementIds: ['s1', 's2'],
    expectedFactionIds: ['f1', 'f2'],
  })
  assert.deepEqual(merged, {
    settlements: { s1: 'Valen', s2: 'Rynn' },
    factions: { f1: 'House Karn', f2: 'League' },
    regionName: 'The Reach',
  })
})

test('mergeProtectedSettlementNames drops stale generated and provided ids when expected lists are given', () => {
  const merged = mergeProtectedSettlementNames({
    provided: { settlements: { old: 'Ghost' }, factions: {}, regionName: '' },
    generated: { settlements: { extra: 'Nope', s1: 'Valen' }, factions: {}, regionName: '' },
    expectedSettlementIds: ['s1'],
    expectedFactionIds: [],
  })
  assert.deepEqual(merged.settlements, { s1: 'Valen' })
  assert.equal(merged.regionName, '')
})

test('compactNameMap trims and drops blanks', () => {
  assert.deepEqual(compactNameMap({ a: '  Valen  ', b: '   ', c: '' }), { a: 'Valen' })
})

test('catalogHasResettableNames is true for writeup-only leftovers', () => {
  assert.equal(catalogHasResettableNames({}, 'A synopsis'), true)
  assert.equal(catalogHasResettableNames({}, '  '), false)
})
