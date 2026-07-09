import assert from 'node:assert/strict'
import test from 'node:test'
import { allocateExpeditionSlots } from './allocateExpeditionSlots.js'

function inlandSender(settlementId, population) {
  return {
    settlementId,
    population,
    maritimeRole: 'none',
    canDispatchLand: true,
    canDispatchMaritime: false,
  }
}

function portSender(settlementId, population) {
  return {
    settlementId,
    population,
    maritimeRole: 'port',
    canDispatchLand: true,
    canDispatchMaritime: true,
  }
}

test('allocateExpeditionSlots never exceeds eligible sender count', () => {
  const senders = [
    inlandSender('a', 100),
    inlandSender('b', 50),
    inlandSender('c', 200),
  ]
  const assignments = allocateExpeditionSlots({
    landSlots: 2,
    maritimeSlots: 0,
    senders,
    geographySeed: 42,
    epoch: 3,
  })
  assert.strictEqual(assignments.length, 3)
})

test('allocateExpeditionSlots favors higher population in seeded lottery', () => {
  const senders = [inlandSender('small', 10), inlandSender('large', 1000)]
  const assignments = allocateExpeditionSlots({
    landSlots: 1,
    maritimeSlots: 0,
    senders,
    geographySeed: 99,
    epoch: 1,
  })
  assert.strictEqual(assignments[0].settlementId, 'large')
})

test('allocateExpeditionSlots reserves a slot for each eligible port', () => {
  const senders = [
    portSender('port', 20),
    inlandSender('inland', 1000),
  ]
  const assignments = allocateExpeditionSlots({
    landSlots: 1,
    maritimeSlots: 0,
    senders,
    geographySeed: 42,
    epoch: 4,
  })
  assert.ok(assignments.some((entry) => entry.settlementId === 'port'))
})

test('allocateExpeditionSlots can fill reserved port slots and population lottery together', () => {
  const senders = [portSender('port', 80), inlandSender('inland', 120)]
  const assignments = allocateExpeditionSlots({
    landSlots: 1,
    maritimeSlots: 1,
    senders,
    geographySeed: 42,
    epoch: 4,
  })
  assert.strictEqual(assignments.length, 2)
  assert.ok(assignments.some((entry) => entry.settlementId === 'port'))
  assert.ok(assignments.some((entry) => entry.settlementId === 'inland'))
})

test('allocateExpeditionSlots can assign multiple slots to one sender when capacity allows', () => {
  const senders = [inlandSender('only', 100)]
  const assignments = allocateExpeditionSlots({
    landSlots: 4,
    maritimeSlots: 0,
    senders,
    geographySeed: 42,
    epoch: 2,
    remainingDispatchCapacity: new Map([['only', 3]]),
  })
  assert.strictEqual(assignments.length, 3)
  assert.ok(assignments.every((entry) => entry.settlementId === 'only'))
})
