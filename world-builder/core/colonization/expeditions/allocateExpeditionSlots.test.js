import assert from 'node:assert/strict'
import test from 'node:test'
import { allocateExpeditionSlots } from './allocateExpeditionSlots.js'

test('allocateExpeditionSlots never exceeds pool size', () => {
  const senders = [
    { settlementId: 'a', population: 100, pool: 'land', maritimeRole: 'none' },
    { settlementId: 'b', population: 50, pool: 'land', maritimeRole: 'none' },
    { settlementId: 'c', population: 200, pool: 'land', maritimeRole: 'none' },
  ]
  const assignments = allocateExpeditionSlots({
    landSlots: 2,
    maritimeSlots: 0,
    senders,
    geographySeed: 42,
    epoch: 3,
  })
  assert.strictEqual(assignments.length, 2)
  assert.ok(assignments.every((entry) => entry.pool === 'land'))
})

test('allocateExpeditionSlots favors higher population in seeded lottery', () => {
  const senders = [
    { settlementId: 'small', population: 10, pool: 'land', maritimeRole: 'none' },
    { settlementId: 'large', population: 1000, pool: 'land', maritimeRole: 'none' },
  ]
  const assignments = allocateExpeditionSlots({
    landSlots: 1,
    maritimeSlots: 0,
    senders,
    geographySeed: 99,
    epoch: 1,
  })
  assert.strictEqual(assignments[0].settlementId, 'large')
})

test('allocateExpeditionSlots assigns maritime slots to port senders', () => {
  const senders = [
    {
      settlementId: 'port-1',
      population: 80,
      pool: 'maritime',
      maritimeRole: 'port',
    },
  ]
  const assignments = allocateExpeditionSlots({
    landSlots: 0,
    maritimeSlots: 1,
    senders,
    geographySeed: 7,
    epoch: 2,
  })
  assert.strictEqual(assignments.length, 1)
  assert.strictEqual(assignments[0].pool, 'maritime')
  assert.strictEqual(assignments[0].maritimeRole, 'port')
})
