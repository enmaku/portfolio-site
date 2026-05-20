import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  assertH5WeightsPresent,
  resolveH5InputPath,
} from './lib/dungeon-runner-convert-lib.mjs'
import { validatePromotedVersionId } from './lib/dungeon-runner-model-id.mjs'

test('validatePromotedVersionId rejects training run ids and accepts semver', () => {
  assert.equal(validatePromotedVersionId('bc-run-1').ok, false)
  assert.equal(validatePromotedVersionId('v0.1.30a').ok, true)
  assert.equal(validatePromotedVersionId('v0.2').ok, true)
  assert.equal(validatePromotedVersionId('v0.2.01').ok, true)
  assert.equal(validatePromotedVersionId('latest').ok, false)
})

test('resolveH5InputPath prefers nested policy.weights.h5 under promoted version dir', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-convert-'))
  const modelsRoot = path.join(temp, 'models')
  mkdirSync(path.join(modelsRoot, 'v0.1.30a'), { recursive: true })
  writeFileSync(path.join(modelsRoot, 'v0.1.30a', 'policy.weights.h5'), 'weights')
  writeFileSync(path.join(modelsRoot, 'v0.1.30a.h5'), 'flat')

  const resolved = resolveH5InputPath({ sourceModelsDir: modelsRoot, modelId: 'v0.1.30a' })
  assert.equal(resolved.layout, 'nested')
  assert.equal(resolved.exists, true)
  assert.match(resolved.inputPath, /v0\.1\.30a\/policy\.weights\.h5$/)
  rmSync(temp, { recursive: true, force: true })
})

test('resolveH5InputPath falls back to flat <id>.h5 when nested file missing', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-convert-'))
  const modelsRoot = path.join(temp, 'models')
  mkdirSync(modelsRoot, { recursive: true })
  writeFileSync(path.join(modelsRoot, 'v0.1.29a.h5'), 'flat-only')

  const resolved = resolveH5InputPath({ sourceModelsDir: modelsRoot, modelId: 'v0.1.29a' })
  assert.equal(resolved.layout, 'flat')
  assert.equal(resolved.exists, true)
  rmSync(temp, { recursive: true, force: true })
})

test('assertH5WeightsPresent reports nested path when weights missing', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-convert-'))
  const modelsRoot = path.join(temp, 'models')
  mkdirSync(path.join(modelsRoot, 'v0.1.30a'), { recursive: true })

  const check = assertH5WeightsPresent({ sourceModelsDir: modelsRoot, modelId: 'v0.1.30a' })
  assert.equal(check.ok, false)
  assert.match(check.error, /policy\.weights\.h5/)
  rmSync(temp, { recursive: true, force: true })
})
