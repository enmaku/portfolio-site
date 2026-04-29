#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const args = process.argv.slice(2)
const modelId = args.find((arg) => !arg.startsWith('--'))
const syncAll = args.includes('--all')
const repoUrl = getArgValue(args, '--repo-url') ?? 'https://github.com/enmaku/dungeon-runner.git'
const repoRef = getArgValue(args, '--repo-ref') ?? 'main'
const repoModelsDir = getArgValue(args, '--repo-models-dir') ?? 'models'

if (!syncAll && !modelId) {
  console.error(
    'Usage: node scripts/sync-dungeon-runner-model.mjs <model-id>|--all [--repo-url <url>] [--repo-ref <ref>] [--repo-models-dir <dir>]',
  )
  process.exit(1)
}

if (syncAll) {
  const tempRepoDir = mkdtempSync(path.join(tmpdir(), 'dungeon-runner-models-all-'))
  const clone = spawnSync('git', ['clone', '--depth', '1', '--branch', repoRef, repoUrl, tempRepoDir], {
    stdio: 'inherit',
  })
  if (clone.status !== 0) {
    cleanupTemp(tempRepoDir)
    process.exit(clone.status ?? 1)
  }
  const modelsRoot = path.join(tempRepoDir, repoModelsDir)
  const modelIds = readdirSync(modelsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  for (const id of modelIds) {
    const convert = spawnSync('node', ['./scripts/convert-dungeon-runner-h5.mjs', id], {
      stdio: 'inherit',
      env: {
        ...process.env,
        DUNGEON_RUNNER_MODELS_DIR: modelsRoot,
      },
    })
    if (convert.status !== 0) {
      cleanupTemp(tempRepoDir)
      process.exit(convert.status ?? 1)
    }
  }
  cleanupTemp(tempRepoDir)
} else {
  const convert = spawnSync('node', ['./scripts/convert-dungeon-runner-h5.mjs', ...args], {
    stdio: 'inherit',
  })
  if (convert.status !== 0) {
    process.exit(convert.status ?? 1)
  }
}

const update = spawnSync('node', ['./scripts/update-dungeon-runner-model-catalog.mjs'], {
  stdio: 'inherit',
})

if (update.status !== 0) {
  process.exit(update.status ?? 1)
}

console.log(`Synced Dungeon Runner model: ${syncAll ? 'all' : modelId}`)

function getArgValue(argsList, name) {
  const index = argsList.indexOf(name)
  if (index === -1) return null
  return argsList[index + 1] ?? null
}

function cleanupTemp(dirPath) {
  if (!dirPath) return
  rmSync(dirPath, { recursive: true, force: true })
}
