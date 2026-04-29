import assert from 'node:assert/strict'
import test from 'node:test'
import { pickDefaultModelId, sortModelIdsForDisplay, validateSelectedModels } from './discovery.js'

test('latest alias is authoritative default when present', () => {
  assert.equal(pickDefaultModelId(['v1.0.0', 'latest', 'v2.0.0']), 'latest')
})

test('falls back to highest semantic version when latest absent', () => {
  assert.equal(pickDefaultModelId(['v1.2.0', 'v1.10.0', 'v1.9.0']), 'v1.10.0')
})

test('sortModelIdsForDisplay keeps latest first and semver descending', () => {
  assert.deepEqual(
    sortModelIdsForDisplay(['v1.0.0', 'latest', 'v1.5.0']),
    ['latest', 'v1.5.0', 'v1.0.0'],
  )
})

test('sortModelIdsForDisplay supports prerelease-style letter suffix versions', () => {
  assert.deepEqual(
    sortModelIdsForDisplay(['v0.1.29a', 'v0.1.30a', 'latest']),
    ['latest', 'v0.1.30a', 'v0.1.29a'],
  )
})

test('sortModelIdsForDisplay hides unavailable/non-model ids', () => {
  assert.deepEqual(sortModelIdsForDisplay(['latest', 'v1.0.0', 'README', 'tmp-model', 'v0.1']), ['latest', 'v1.0.0'])
})

test('validateSelectedModels rejects nn seat using unavailable model', () => {
  const result = validateSelectedModels(
    [{ type: 'nn', modelId: 'v9.9.9' }, { type: 'randombot' }],
    ['latest', 'v1.0.0'],
  )
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'MODEL_UNAVAILABLE')
})

test('validateSelectedModels requires model id for nn seat', () => {
  const result = validateSelectedModels([{ type: 'nn' }], ['latest'])
  assert.equal(result.ok, false)
  assert.equal(result.errorCode, 'MODEL_REQUIRED')
})
