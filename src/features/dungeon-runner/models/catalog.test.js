import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeModelCatalog } from './catalog.js'

test('normalizeModelCatalog filters invalid entries and keeps unique ids', () => {
  const catalog = normalizeModelCatalog({ models: ['latest', '', 'v1.0.0', 'v1.0.0'] })
  assert.deepEqual(catalog.models, ['latest', 'v1.0.0'])
})
