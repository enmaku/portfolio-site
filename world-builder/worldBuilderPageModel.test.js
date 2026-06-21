import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createGenerationStepStatuses,
  generationProgressValue,
  normalizeGeographySeed,
} from './worldBuilderPageModel.js'

test('normalizeGeographySeed converts signed 32-bit values to unsigned', () => {
  assert.strictEqual(normalizeGeographySeed(-1), 4294967295)
  assert.strictEqual(normalizeGeographySeed(12345), 12345)
})

test('generationProgressValue scales by completed steps', () => {
  assert.strictEqual(generationProgressValue(0, 6), 17)
  assert.strictEqual(generationProgressValue(5, 6), 100)
})

test('createGenerationStepStatuses marks active and completed steps', () => {
  const steps = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ]
  const statuses = createGenerationStepStatuses(steps, 1, 0)
  assert.deepStrictEqual(
    statuses.map((row) => row.status),
    ['complete', 'active', 'pending'],
  )
})
