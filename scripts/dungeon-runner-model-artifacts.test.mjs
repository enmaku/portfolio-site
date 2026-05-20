import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const MODELS_ROOT = path.join(ROOT, 'public', 'models', 'dungeon-runner')

function assertWebDeployedLatestGuard(modelsRoot) {
  const semverDirs = readdirSync(modelsRoot).filter((entry) => {
    const dirPath = path.join(modelsRoot, entry)
    return (
      entry !== 'latest' &&
      /^v\d+\.\d+\.\d+[a-z0-9.-]*$/i.test(entry) &&
      statSync(dirPath).isDirectory() &&
      existsSync(path.join(dirPath, 'model.json'))
    )
  })
  if (semverDirs.length === 0) return
  assert.equal(
    existsSync(path.join(modelsRoot, 'latest', 'model.json')),
    true,
    'public/models/dungeon-runner/latest/model.json must exist after TF.js sync when semver models are checked in',
  )
}

test('web deployed latest guard fails when semver exists but latest is missing', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-artifacts-'))
  const modelsRoot = path.join(temp, 'public', 'models', 'dungeon-runner')
  mkdirSync(path.join(modelsRoot, 'v0.1.30a'), { recursive: true })
  writeFileSync(path.join(modelsRoot, 'v0.1.30a', 'model.json'), '{"format":"layers-model"}\n')
  assert.throws(() => assertWebDeployedLatestGuard(modelsRoot), /latest\/model\.json must exist/)
  rmSync(temp, { recursive: true, force: true })
})

test('web deployed latest model.json exists when semver models are present', () => {
  if (!existsSync(MODELS_ROOT)) return

  const semverDirs = readdirSync(MODELS_ROOT).filter((entry) => {
    const dirPath = path.join(MODELS_ROOT, entry)
    return (
      entry !== 'latest' &&
      /^v\d+\.\d+\.\d+[a-z0-9.-]*$/i.test(entry) &&
      statSync(dirPath).isDirectory() &&
      existsSync(path.join(dirPath, 'model.json'))
    )
  })

  if (semverDirs.length === 0) return
  assertWebDeployedLatestGuard(MODELS_ROOT)
})
