import assert from 'node:assert/strict'
import test from 'node:test'
import { generateDerivedGeography } from '../generateDerivedGeography.js'
import {
  DEFAULT_WORLD_GENERATION_OPTIONS,
  PRE_PRIORS_ELEVATION_OPTIONS,
} from '../worldGenerationOptions.js'
import {
  countRiverValidationPasses,
  ELEVATION_PRIOR_VALIDATION_SEED_BATCH,
} from './elevationPriorPassRates.js'

const validationGrid = {
  width: 64,
  height: 64,
  prevailingWindDegrees: 90,
}

test('countRiverValidationPasses returns tallies for each seed in batch', () => {
  const result = countRiverValidationPasses(
    ELEVATION_PRIOR_VALIDATION_SEED_BATCH,
    validationGrid,
    DEFAULT_WORLD_GENERATION_OPTIONS,
  )

  assert.strictEqual(result.seedCount, ELEVATION_PRIOR_VALIDATION_SEED_BATCH.length)
  assert.strictEqual(typeof result.navigableRiverPassCount, 'number')
  assert.strictEqual(typeof result.coastMouthPassCount, 'number')
  assert.strictEqual(typeof result.compositePassScore, 'number')
})

test('elevation priors keep navigable river pass rate high on default seed batch', () => {
  const baseline = countRiverValidationPasses(
    ELEVATION_PRIOR_VALIDATION_SEED_BATCH,
    validationGrid,
    PRE_PRIORS_ELEVATION_OPTIONS,
  )
  const withPriors = countRiverValidationPasses(
    ELEVATION_PRIOR_VALIDATION_SEED_BATCH,
    validationGrid,
    DEFAULT_WORLD_GENERATION_OPTIONS,
  )

  assert.ok(withPriors.navigableRiverPassCount >= baseline.navigableRiverPassCount * 0.8)
  assert.ok(withPriors.navigableRiverPassCount >= 40)
})

test('seed 40 gains coast mouth with elevation priors on validation grid', () => {
  const baseline = countRiverValidationPasses([40], validationGrid, PRE_PRIORS_ELEVATION_OPTIONS)
  const withPriors = countRiverValidationPasses([40], validationGrid, DEFAULT_WORLD_GENERATION_OPTIONS)

  assert.strictEqual(baseline.coastMouthPassCount, 0)
  assert.strictEqual(withPriors.coastMouthPassCount, 1)
})

test('advisory validation mode never rejects default seed batch candidates', () => {
  for (const geographySeed of ELEVATION_PRIOR_VALIDATION_SEED_BATCH.slice(0, 5)) {
    const doc = generateDerivedGeography({
      ...validationGrid,
      geographySeed,
      options: DEFAULT_WORLD_GENERATION_OPTIONS,
    })
    assert.strictEqual(doc.generationReport?.rejectionSamplingEnforced, false)
    assert.strictEqual(doc.generationReport?.shouldReject, false)
  }
})
