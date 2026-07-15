import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canShufflePlayerOrder,
  createPlayerOrderShuffle,
} from './playerOrderShuffle.js'
import { createTestSession, testPlayer } from './test/fixtures.js'

test('canShufflePlayerOrder accepts only fresh round-one games with multiple players', () => {
  const fresh = createTestSession({
    players: [testPlayer('a'), testPlayer('b')],
    playerOrderByRound: { '1': ['a', 'b'] },
  })

  assert.equal(canShufflePlayerOrder(fresh), true)
  assert.equal(canShufflePlayerOrder({ ...fresh, round: 2 }), false)
  assert.equal(canShufflePlayerOrder({ ...fresh, totalGameStartedAt: 1 }), false)
  assert.equal(canShufflePlayerOrder({ ...fresh, activePlayerId: 'a' }), false)
  assert.equal(
    canShufflePlayerOrder({
      ...fresh,
      players: [testPlayer('a', { bankedMs: 1 }), testPlayer('b')],
    }),
    false,
  )
  assert.equal(
    canShufflePlayerOrder({
      ...fresh,
      players: [testPlayer('a', { bankedMsByRound: { '1': 1 } }), testPlayer('b')],
    }),
    false,
  )
  assert.equal(canShufflePlayerOrder({ ...fresh, players: [testPlayer('a')] }), false)
})

test('createPlayerOrderShuffle is deterministic and settles on a permutation', () => {
  const ids = ['a', 'b', 'c', 'd']
  const first = createPlayerOrderShuffle(ids, 123456)
  const second = createPlayerOrderShuffle(ids, 123456)

  assert.deepEqual(first, second)
  assert.deepEqual(ids, ['a', 'b', 'c', 'd'])
  assert.deepEqual([...first.targetOrder].sort(), [...ids].sort())
  assert.deepEqual(first.orders.at(-1), first.targetOrder)
  assert.ok(first.orders.length >= 18)
  for (const order of first.orders) {
    assert.deepEqual([...order].sort(), [...ids].sort())
  }
})

test('different seeds can settle on different orders', () => {
  const ids = ['a', 'b', 'c', 'd', 'e']
  const first = createPlayerOrderShuffle(ids, 1)
  const second = createPlayerOrderShuffle(ids, 2)

  assert.notDeepEqual(first.targetOrder, second.targetOrder)
})
