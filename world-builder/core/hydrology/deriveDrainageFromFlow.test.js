import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveDrainageFromFlow } from './deriveDrainageFromFlow.js'

test('deriveDrainageFromFlow normalizes to 0-1 range', () => {
  const flow = new Float32Array([0, 5, 10, 20])
  const drainage = deriveDrainageFromFlow(flow)

  assert.strictEqual(drainage[0], 0)
  assert.strictEqual(drainage[3], 1)
  assert.ok(drainage[1] > 0 && drainage[1] < 1)
})

test('deriveDrainageFromFlow returns zeros for empty flow', () => {
  const flow = new Float32Array(4)
  const drainage = deriveDrainageFromFlow(flow)
  assert.deepStrictEqual(Array.from(drainage), [0, 0, 0, 0])
})
