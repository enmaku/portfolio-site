import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeModelCatalog } from './catalog.js'

test('normalizeModelCatalog filters invalid entries and keeps unique ids', () => {
  const catalog = normalizeModelCatalog({ models: ['latest', '', 'v1.0.0', 'v1.0.0'] })
  assert.deepEqual(catalog.models, ['latest', 'v1.0.0'])
  assert.deepEqual(catalog.publishedAtByModelId, {})
})

test('normalizeModelCatalog extracts publishedAt from object entries', () => {
  const catalog = normalizeModelCatalog({
    models: [
      { id: 'latest', publishedAt: '2026-05-25T19:14:01.000Z' },
      { id: 'v0.2.04', publishedAt: '2026-05-25T19:14:01.000Z' },
      { id: 'v0.2.01', publishedAt: '2026-05-20T05:04:06.000Z' },
    ],
  })
  assert.deepEqual(catalog.models, ['latest', 'v0.2.04', 'v0.2.01'])
  assert.deepEqual(catalog.publishedAtByModelId, {
    latest: '2026-05-25T19:14:01.000Z',
    'v0.2.04': '2026-05-25T19:14:01.000Z',
    'v0.2.01': '2026-05-20T05:04:06.000Z',
  })
})
