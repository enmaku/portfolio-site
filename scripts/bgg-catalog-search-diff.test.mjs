import assert from 'node:assert/strict'
import test from 'node:test'
import {
  catalogDocsEqual,
  diffCatalogDocMaps,
} from './lib/bggCatalogSearchDiff.mjs'

test('catalogDocsEqual ignores object identity', () => {
  const a = {
    bggId: '1',
    name: 'A',
    yearPublished: 2000,
    rank: 1,
    bayesAverage: 1,
    average: 1,
    usersRated: 1,
    searchPrefixes: ['aa'],
  }
  assert.equal(catalogDocsEqual(a, { ...a, searchPrefixes: ['aa'] }), true)
  assert.equal(catalogDocsEqual(a, { ...a, rank: 2 }), false)
})

test('diffCatalogDocMaps detects add change delete', () => {
  const prev = new Map([
    [
      '1',
      {
        bggId: '1',
        name: 'Keep',
        yearPublished: 2000,
        rank: 1,
        bayesAverage: 8,
        average: 8,
        usersRated: 10,
        searchPrefixes: ['ke', 'kee', 'keep'],
      },
    ],
    [
      '2',
      {
        bggId: '2',
        name: 'Old',
        yearPublished: 2001,
        rank: 2,
        bayesAverage: 7,
        average: 7,
        usersRated: 5,
        searchPrefixes: ['ol', 'old'],
      },
    ],
    [
      '3',
      {
        bggId: '3',
        name: 'Gone',
        yearPublished: 2002,
        rank: 3,
        bayesAverage: 6,
        average: 6,
        usersRated: 4,
        searchPrefixes: ['go', 'gon', 'gone'],
      },
    ],
  ])
  const next = new Map([
    [
      '1',
      {
        bggId: '1',
        name: 'Keep',
        yearPublished: 2000,
        rank: 1,
        bayesAverage: 8,
        average: 8,
        usersRated: 10,
        searchPrefixes: ['ke', 'kee', 'keep'],
      },
    ],
    [
      '2',
      {
        bggId: '2',
        name: 'Old',
        yearPublished: 2001,
        rank: 9,
        bayesAverage: 7,
        average: 7,
        usersRated: 5,
        searchPrefixes: ['ol', 'old'],
      },
    ],
    [
      '4',
      {
        bggId: '4',
        name: 'New',
        yearPublished: 2024,
        rank: 4,
        bayesAverage: 8,
        average: 8,
        usersRated: 1,
        searchPrefixes: ['ne', 'new'],
      },
    ],
  ])

  const diff = diffCatalogDocMaps(prev, next)
  assert.deepEqual(
    diff.added.map((d) => d.bggId),
    ['4'],
  )
  assert.deepEqual(
    diff.changed.map((d) => d.bggId),
    ['2'],
  )
  assert.deepEqual(diff.deleted, ['3'])
  assert.deepEqual(diff.summary, {
    previousCount: 3,
    nextCount: 3,
    added: 1,
    changed: 1,
    deleted: 1,
  })
})
