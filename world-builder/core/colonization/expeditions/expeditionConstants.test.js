import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeMaxActiveExpeditionsPerSettlement,
  countActiveExpeditionsForSettlement,
  resolveExpeditionMode,
  resolveExpeditions,
} from './expeditionConstants.js'

test('computeMaxActiveExpeditionsPerSettlement scales down with settlement count and floors at 1', () => {
  assert.strictEqual(computeMaxActiveExpeditionsPerSettlement(1), 20)
  assert.strictEqual(computeMaxActiveExpeditionsPerSettlement(2), 10)
  assert.strictEqual(computeMaxActiveExpeditionsPerSettlement(10), 2)
  assert.strictEqual(computeMaxActiveExpeditionsPerSettlement(20), 1)
  assert.strictEqual(computeMaxActiveExpeditionsPerSettlement(21), 1)
})

test('countActiveExpeditionsForSettlement counts concurrent active treks', () => {
  const slice = {
    expeditions: [
      { id: 'a', settlementId: 's1', status: 'active' },
      { id: 'b', settlementId: 's1', status: 'active' },
      { id: 'c', settlementId: 's2', status: 'active' },
      { id: 'd', settlementId: 's1', status: 'completed' },
    ],
  }
  assert.strictEqual(countActiveExpeditionsForSettlement(slice, 's1'), 2)
  assert.strictEqual(countActiveExpeditionsForSettlement(slice, 's2'), 1)
  assert.strictEqual(countActiveExpeditionsForSettlement(slice, 'missing'), 0)
})

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
