import assert from 'node:assert/strict'
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const MODELS_ROOT = path.join(ROOT, 'public', 'models', 'dungeon-runner')

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

  assert.equal(
    existsSync(path.join(MODELS_ROOT, 'latest', 'model.json')),
    true,
    'public/models/dungeon-runner/latest/model.json must exist after TF.js sync when semver models are checked in',
  )
})
