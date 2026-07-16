import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_MINERAL_OCCURRENCE_WEIGHTS,
  MINERAL_KINDS,
  pickMineralKind,
  resolveMineralOccurrenceWeights,
} from './mineralOccurrence.js'

test('default weights preserve inverse 100:10:1 copper/silver/gold with diamond disabled', () => {
  assert.strictEqual(DEFAULT_MINERAL_OCCURRENCE_WEIGHTS.copper, 100)
  assert.strictEqual(DEFAULT_MINERAL_OCCURRENCE_WEIGHTS.silver, 10)
  assert.strictEqual(DEFAULT_MINERAL_OCCURRENCE_WEIGHTS.gold, 1)
  assert.strictEqual(DEFAULT_MINERAL_OCCURRENCE_WEIGHTS.diamond, 0)
})

test('resolveMineralOccurrenceWeights fills defaults and rejects invalid overrides', () => {
  assert.deepStrictEqual(
    resolveMineralOccurrenceWeights(null),
    { ...DEFAULT_MINERAL_OCCURRENCE_WEIGHTS },
  )
  const resolved = resolveMineralOccurrenceWeights({ diamond: 5, gold: -3, silver: Number.NaN })
  assert.strictEqual(resolved.diamond, 5)
  assert.strictEqual(resolved.gold, DEFAULT_MINERAL_OCCURRENCE_WEIGHTS.gold)
  assert.strictEqual(resolved.silver, DEFAULT_MINERAL_OCCURRENCE_WEIGHTS.silver)
})

test('pickMineralKind never returns a zero-weight kind', () => {
  const weights = { copper: 1, silver: 0, gold: 0, diamond: 0 }
  for (let i = 0; i <= 20; i += 1) {
    assert.strictEqual(pickMineralKind(i / 20, weights), 'copper')
  }
})

test('pickMineralKind falls back to copper when all weights are zero', () => {
  assert.strictEqual(
    pickMineralKind(0.5, { copper: 0, silver: 0, gold: 0, diamond: 0 }),
    'copper',
  )
})

test('pickMineralKind approximates relative weights over a uniform sweep', () => {
  const weights = { copper: 100, silver: 10, gold: 1, diamond: 0 }
  const counts = { copper: 0, silver: 0, gold: 0, diamond: 0 }
  const samples = 1000
  for (let i = 0; i < samples; i += 1) {
    counts[pickMineralKind(i / samples, weights)] += 1
  }
  assert.strictEqual(counts.diamond, 0)
  assert.ok(counts.copper > counts.silver)
  assert.ok(counts.silver > counts.gold)
  for (const kind of MINERAL_KINDS) {
    assert.ok(counts[kind] >= 0)
  }
})
