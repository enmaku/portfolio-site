import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveExpeditionMode, resolveExpeditions } from './expeditionConstants.js'

test('resolveExpeditions migrates legacy sail mode to inland_sail', () => {
  const expeditions = resolveExpeditions([
    {
      id: 'exp-1',
      settlementId: 's1',
      mode: 'sail',
      bearing: 0,
      route: [{ x: 0, y: 0 }],
      progressIndex: 0,
      status: 'active',
    },
  ])
  assert.strictEqual(expeditions[0].mode, 'inland_sail')
})

test('resolveExpeditionMode preserves open_sea and land modes', () => {
  assert.strictEqual(resolveExpeditionMode('open_sea'), 'open_sea')
  assert.strictEqual(resolveExpeditionMode('land'), 'land')
  assert.strictEqual(resolveExpeditionMode('inland_sail'), 'inland_sail')
})
