#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  parseSyncArgs,
  resolveDungeonRunnerModelsDir,
  runSync,
} from './lib/dungeon-runner-sync-lib.mjs'

loadDotEnv(path.join(process.cwd(), '.env'))

const parsed = parseSyncArgs(process.argv.slice(2))
if (!parsed.ok) {
  console.error(parsed.error)
  process.exit(1)
}

const repoRef = parsed.repoRef
const repoUrl = parsed.repoUrl
const repoModelsDir = parsed.repoModelsDir

let tempRepoDir = null
let repoRoot = resolveDungeonRunnerModelsDir({
  env: process.env,
  repoModelsDir,
}).repoRoot

if (!repoRoot) {
  tempRepoDir = mkdtempSync(path.join(tmpdir(), 'dungeon-runner-sync-'))
  const clone = spawnSync('git', ['clone', '--depth', '1', '--branch', repoRef, repoUrl, tempRepoDir], {
    stdio: 'inherit',
  })
  if (clone.status !== 0) {
    cleanupTemp(tempRepoDir)
    process.exit(clone.status ?? 1)
  }
  repoRoot = tempRepoDir
}

const result = await runSync({
  cwd: process.cwd(),
  env: process.env,
  parsed,
  repoRoot,
  convertModel: (modelId, convertEnv, convertArgs) =>
    spawnSync('node', ['./scripts/convert-dungeon-runner-h5.mjs', modelId, ...convertArgs.filter((arg) => arg !== '--all')], {
      stdio: 'inherit',
      env: convertEnv,
    }),
  updateCatalog: () =>
    spawnSync('node', ['./scripts/update-dungeon-runner-model-catalog.mjs'], {
      stdio: 'inherit',
    }),
})

cleanupTemp(tempRepoDir)

if (result.status !== 0) {
  if (result.message) console.error(result.message)
  process.exit(result.status ?? 1)
}

console.log(result.message)

function cleanupTemp(dirPath) {
  if (!dirPath) return
  rmSync(dirPath, { recursive: true, force: true })
}

function loadDotEnv(envPath) {
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (!key || process.env[key] !== undefined) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}
