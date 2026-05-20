import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  isPromotedInLedger,
  listPromotedVersionIds,
  parseSyncArgs,
  readProductionLatestId,
  refreshWebDeployedLatest,
  resolveDungeonRunnerModelsDir,
  runSync,
  shouldRefreshWebLatest,
  validatePromotedVersionId,
} from './lib/dungeon-runner-sync-lib.mjs'

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function makeRepoLayout(baseDir, { versions = [], productionLatest = null, ledger = [] } = {}) {
  const modelsRoot = path.join(baseDir, 'models')
  mkdirSync(modelsRoot, { recursive: true })
  for (const version of versions) {
    const dir = path.join(modelsRoot, version)
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'policy.weights.h5'), 'weights')
  }
  if (ledger.length > 0) {
    writeFileSync(
      path.join(modelsRoot, 'promotions.jsonl'),
      `${ledger.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
    )
  }
  if (productionLatest) {
    symlinkSync(productionLatest, path.join(modelsRoot, 'latest'))
  }
  return { modelsRoot, repoRoot: baseDir }
}

async function mockConvert(cwd) {
  return async (modelId) => {
    const outDir = path.join(cwd, 'public', 'models', 'dungeon-runner', modelId)
    mkdirSync(outDir, { recursive: true })
    writeFileSync(path.join(outDir, 'model.json'), JSON.stringify({ format: 'layers-model', modelId }) + '\n')
    return { status: 0 }
  }
}

test('parseSyncArgs defaults empty argv to --from-latest', () => {
  const parsed = parseSyncArgs([])
  assert.equal(parsed.ok, true)
  assert.equal(parsed.fromLatest, true)
})

test('parseSyncArgs rejects non-semver explicit ids', () => {
  const parsed = parseSyncArgs(['bc-run-abc'])
  assert.equal(parsed.ok, false)
  assert.match(parsed.error, /Invalid promoted version/)
})

test('parseSyncArgs accepts explicit id, --from-latest, and --all exclusively', () => {
  assert.equal(parseSyncArgs(['v0.1.30a']).ok, true)
  assert.equal(parseSyncArgs([]).fromLatest, true)
  assert.equal(parseSyncArgs(['--from-latest']).fromLatest, true)
  assert.equal(parseSyncArgs(['--all']).syncAll, true)
  assert.equal(parseSyncArgs(['v0.1.30a', '--from-latest']).ok, false)
  assert.equal(parseSyncArgs(['--all', '--from-latest']).ok, false)
})

test('readProductionLatestId resolves symlink target', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-sync-'))
  makeRepoLayout(temp, { versions: ['v0.1.30a'], productionLatest: 'v0.1.30a' })
  assert.equal(readProductionLatestId(path.join(temp, 'models')), 'v0.1.30a')
  rmSync(temp, { recursive: true, force: true })
})

test('readProductionLatestId rejects models/latest directory', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-sync-'))
  const modelsRoot = path.join(temp, 'models')
  mkdirSync(path.join(modelsRoot, 'v0.1.30a'), { recursive: true })
  mkdirSync(path.join(modelsRoot, 'latest'), { recursive: true })
  assert.throws(
    () => readProductionLatestId(modelsRoot),
    /directory, not a symlink/,
  )
  rmSync(temp, { recursive: true, force: true })
})

test('readProductionLatestId resolves ADR-style ../<version> symlink', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-sync-'))
  const modelsRoot = path.join(temp, 'models')
  mkdirSync(path.join(modelsRoot, 'v0.1.30a'), { recursive: true })
  symlinkSync(path.join('..', 'v0.1.30a'), path.join(modelsRoot, 'latest'))
  assert.equal(readProductionLatestId(modelsRoot), 'v0.1.30a')
  rmSync(temp, { recursive: true, force: true })
})

test('explicit sync fails when H5 weights are missing', async () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-sync-'))
  const work = mkdtempSync(path.join(tmpdir(), 'dr-sync-work-'))
  mkdirSync(path.join(work, 'public', 'models', 'dungeon-runner'), { recursive: true })
  const modelsRoot = path.join(temp, 'models')
  mkdirSync(modelsRoot, { recursive: true })
  mkdirSync(path.join(modelsRoot, 'v0.1.30a'), { recursive: true })
  writeFileSync(path.join(modelsRoot, 'promotions.jsonl'), `${JSON.stringify({ promoted_version: 'v0.1.30a' })}\n`)

  const result = await runSync({
    cwd: work,
    parsed: { ...parseSyncArgs(['v0.1.30a']), ok: true },
    repoRoot: temp,
    convertModel: await mockConvert(work),
    updateCatalog: async () => ({ status: 0 }),
  })

  assert.equal(result.status, 1)
  assert.match(result.message, /Model file not found/)
  rmSync(temp, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
})

test('explicit sync fails when id missing from promotion ledger', async () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-sync-'))
  const work = mkdtempSync(path.join(tmpdir(), 'dr-sync-work-'))
  mkdirSync(path.join(work, 'public', 'models', 'dungeon-runner'), { recursive: true })
  makeRepoLayout(temp, { versions: ['v0.1.29a', 'v0.1.30a'], productionLatest: 'v0.1.30a' })

  const result = await runSync({
    cwd: work,
    parsed: { ...parseSyncArgs(['v0.1.29a']), ok: true },
    repoRoot: temp,
    convertModel: await mockConvert(work),
    updateCatalog: async () => ({ status: 0 }),
  })

  assert.equal(result.status, 1)
  assert.match(result.message, /not in ledger/)
  rmSync(temp, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
})

test('explicit sync succeeds with promotion.json and skips web latest when not production latest', async () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-sync-'))
  const work = mkdtempSync(path.join(tmpdir(), 'dr-sync-work-'))
  mkdirSync(path.join(work, 'public', 'models', 'dungeon-runner'), { recursive: true })
  makeRepoLayout(temp, { versions: ['v0.1.29a', 'v0.1.30a'], productionLatest: 'v0.1.30a' })
  writeFileSync(path.join(temp, 'models', 'v0.1.29a', 'promotion.json'), JSON.stringify({ version: 'v0.1.29a' }))
  mkdirSync(path.join(work, 'public', 'models', 'dungeon-runner', 'latest'), { recursive: true })
  writeFileSync(
    path.join(work, 'public', 'models', 'dungeon-runner', 'latest', 'model.json'),
    JSON.stringify({ stale: true }) + '\n',
  )

  const result = await runSync({
    cwd: work,
    parsed: { ...parseSyncArgs(['v0.1.29a']), ok: true },
    repoRoot: temp,
    convertModel: await mockConvert(work),
    updateCatalog: async () => ({ status: 0 }),
  })

  assert.equal(result.status, 0)
  assert.ok(readFileSync(path.join(work, 'public', 'models', 'dungeon-runner', 'v0.1.29a', 'model.json'), 'utf8').includes('v0.1.29a'))
  const latest = JSON.parse(readFileSync(path.join(work, 'public', 'models', 'dungeon-runner', 'latest', 'model.json'), 'utf8'))
  assert.equal(latest.stale, true)
  rmSync(temp, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
})

test('re-syncing production latest refreshes web deployed latest again', async () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-sync-'))
  const work = mkdtempSync(path.join(tmpdir(), 'dr-sync-work-'))
  mkdirSync(path.join(work, 'public', 'models', 'dungeon-runner'), { recursive: true })
  makeRepoLayout(temp, {
    versions: ['v0.1.30a'],
    productionLatest: 'v0.1.30a',
    ledger: [{ promoted_version: 'v0.1.30a', run_id: 'run-1' }],
  })

  let convertPass = 0
  const convert = async (modelId) => {
    convertPass += 1
    const outDir = path.join(work, 'public', 'models', 'dungeon-runner', modelId)
    mkdirSync(outDir, { recursive: true })
    const label = convertPass > 1 ? `${modelId}-rebuilt` : modelId
    writeFileSync(path.join(outDir, 'model.json'), JSON.stringify({ format: 'layers-model', modelId: label }) + '\n')
    return { status: 0 }
  }
  const first = await runSync({
    cwd: work,
    parsed: { ...parseSyncArgs(['v0.1.30a']), ok: true },
    repoRoot: temp,
    convertModel: convert,
    updateCatalog: async () => ({ status: 0 }),
  })
  assert.equal(first.status, 0)

  const second = await runSync({
    cwd: work,
    parsed: { ...parseSyncArgs(['v0.1.30a']), ok: true },
    repoRoot: temp,
    convertModel: convert,
    updateCatalog: async () => ({ status: 0 }),
  })
  assert.equal(second.status, 0)
  const latest = JSON.parse(readFileSync(path.join(work, 'public', 'models', 'dungeon-runner', 'latest', 'model.json'), 'utf8'))
  assert.equal(latest.modelId, 'v0.1.30a-rebuilt')
  rmSync(temp, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
})

test('sync production latest id refreshes web deployed latest', async () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-sync-'))
  const work = mkdtempSync(path.join(tmpdir(), 'dr-sync-work-'))
  mkdirSync(path.join(work, 'public', 'models', 'dungeon-runner'), { recursive: true })
  makeRepoLayout(temp, {
    versions: ['v0.1.30a'],
    productionLatest: 'v0.1.30a',
    ledger: [{ promoted_version: 'v0.1.30a', run_id: 'run-1' }],
  })

  const result = await runSync({
    cwd: work,
    parsed: { ...parseSyncArgs(['v0.1.30a']), ok: true },
    repoRoot: temp,
    convertModel: await mockConvert(work),
    updateCatalog: async () => ({ status: 0 }),
  })

  assert.equal(result.status, 0)
  const latest = JSON.parse(readFileSync(path.join(work, 'public', 'models', 'dungeon-runner', 'latest', 'model.json'), 'utf8'))
  assert.equal(latest.modelId, 'v0.1.30a')
  rmSync(temp, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
})

test('--from-latest resolves symlink without ledger line for older id', async () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-sync-'))
  const work = mkdtempSync(path.join(tmpdir(), 'dr-sync-work-'))
  mkdirSync(path.join(work, 'public', 'models', 'dungeon-runner'), { recursive: true })
  makeRepoLayout(temp, { versions: ['v0.1.30a'], productionLatest: 'v0.1.30a' })

  const result = await runSync({
    cwd: work,
    parsed: { ...parseSyncArgs(['--from-latest']), ok: true },
    repoRoot: temp,
    convertModel: await mockConvert(work),
    updateCatalog: async () => ({ status: 0 }),
  })

  assert.equal(result.status, 0)
  assert.ok(existsModel(work, 'v0.1.30a'))
  assert.ok(existsModel(work, 'latest'))
  rmSync(temp, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
})

test('explicit sync accepts promotions.jsonl without per-dir promotion.json', async () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-sync-'))
  const work = mkdtempSync(path.join(tmpdir(), 'dr-sync-work-'))
  mkdirSync(path.join(work, 'public', 'models', 'dungeon-runner'), { recursive: true })
  makeRepoLayout(temp, {
    versions: ['v0.1.29a', 'v0.1.30a'],
    productionLatest: 'v0.1.30a',
    ledger: [{ promoted_version: 'v0.1.29a', run_id: 'run-a' }],
  })

  const result = await runSync({
    cwd: work,
    parsed: { ...parseSyncArgs(['v0.1.29a']), ok: true },
    repoRoot: temp,
    convertModel: await mockConvert(work),
    updateCatalog: async () => ({ status: 0 }),
  })

  assert.equal(result.status, 0)
  assert.ok(existsModel(work, 'v0.1.29a'))
  assert.equal(existsModel(work, 'latest'), false)
  rmSync(temp, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
})

test('--all succeeds without promotion ledger entries', async () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-sync-'))
  const work = mkdtempSync(path.join(tmpdir(), 'dr-sync-work-'))
  mkdirSync(path.join(work, 'public', 'models', 'dungeon-runner'), { recursive: true })
  makeRepoLayout(temp, { versions: ['v0.1.29a', 'v0.1.30a'], productionLatest: 'v0.1.30a' })

  const result = await runSync({
    cwd: work,
    parsed: { ...parseSyncArgs(['--all']), ok: true },
    repoRoot: temp,
    convertModel: await mockConvert(work),
    updateCatalog: async () => ({ status: 0 }),
  })

  assert.equal(result.status, 0)
  assert.ok(existsModel(work, 'v0.1.29a'))
  assert.ok(existsModel(work, 'v0.1.30a'))
  const latest = JSON.parse(readFileSync(path.join(work, 'public', 'models', 'dungeon-runner', 'latest', 'model.json'), 'utf8'))
  assert.equal(latest.modelId, 'v0.1.30a')
  rmSync(temp, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
})

test('--all fails when production latest symlink is missing', async () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-sync-'))
  const work = mkdtempSync(path.join(tmpdir(), 'dr-sync-work-'))
  mkdirSync(path.join(work, 'public', 'models', 'dungeon-runner'), { recursive: true })
  const modelsRoot = path.join(temp, 'models')
  mkdirSync(path.join(modelsRoot, 'v0.1.30a'), { recursive: true })
  writeFileSync(path.join(modelsRoot, 'v0.1.30a', 'policy.weights.h5'), 'weights')

  const result = await runSync({
    cwd: work,
    parsed: { ...parseSyncArgs(['--all']), ok: true },
    repoRoot: temp,
    convertModel: await mockConvert(work),
    updateCatalog: async () => ({ status: 0 }),
  })

  assert.equal(result.status, 1)
  assert.match(result.message, /Production latest path not found/)
  rmSync(temp, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
})

test('--all converts semver dirs and refreshes web latest once from production latest', async () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-sync-'))
  const work = mkdtempSync(path.join(tmpdir(), 'dr-sync-work-'))
  mkdirSync(path.join(work, 'public', 'models', 'dungeon-runner'), { recursive: true })
  makeRepoLayout(temp, {
    versions: ['v0.1.29a', 'v0.1.30a'],
    productionLatest: 'v0.1.30a',
    ledger: [
      { promoted_version: 'v0.1.29a', run_id: 'run-a' },
      { promoted_version: 'v0.1.30a', run_id: 'run-b' },
    ],
  })

  const converted = []
  const result = await runSync({
    cwd: work,
    parsed: { ...parseSyncArgs(['--all']), ok: true },
    repoRoot: temp,
    convertModel: async (modelId) => {
      converted.push(modelId)
      return (await mockConvert(work))(modelId)
    },
    updateCatalog: async () => ({ status: 0 }),
  })

  assert.equal(result.status, 0)
  assert.deepEqual(converted, ['v0.1.29a', 'v0.1.30a'])
  const latest = JSON.parse(readFileSync(path.join(work, 'public', 'models', 'dungeon-runner', 'latest', 'model.json'), 'utf8'))
  assert.equal(latest.modelId, 'v0.1.30a')
  rmSync(temp, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
})

test('isPromotedInLedger reads promotions.jsonl promoted_version', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-sync-'))
  makeRepoLayout(temp, { ledger: [{ promoted_version: 'v0.2.01', run_id: 'x' }] })
  assert.equal(isPromotedInLedger('v0.2.01', temp), true)
  assert.equal(isPromotedInLedger('bc-foo', temp), false)
  rmSync(temp, { recursive: true, force: true })
})

test('listPromotedVersionIds ignores latest and non-semver dirs', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-sync-'))
  const modelsRoot = path.join(temp, 'models')
  mkdirSync(modelsRoot, { recursive: true })
  mkdirSync(path.join(modelsRoot, 'v0.1.29a'))
  mkdirSync(path.join(modelsRoot, 'runs'))
  mkdirSync(path.join(modelsRoot, 'latest'))
  mkdirSync(path.join(modelsRoot, 'README'))
  assert.deepEqual(listPromotedVersionIds(modelsRoot), ['v0.1.29a'])
  rmSync(temp, { recursive: true, force: true })
})

test('resolveDungeonRunnerModelsDir prefers DUNGEON_RUNNER_ROOT when models exist', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-sync-'))
  const modelsRoot = path.join(temp, 'models')
  mkdirSync(modelsRoot, { recursive: true })
  const resolved = resolveDungeonRunnerModelsDir({
    env: { DUNGEON_RUNNER_ROOT: temp },
    repoRoot: null,
  })
  assert.equal(resolved.source, 'local')
  assert.equal(resolved.modelsDir, modelsRoot)
  rmSync(temp, { recursive: true, force: true })
})

test('validatePromotedVersionId rejects bc-* training run ids', () => {
  assert.equal(validatePromotedVersionId('bc-foo').ok, false)
  assert.equal(validatePromotedVersionId('v0.2.01').ok, true)
})

test('shouldRefreshWebLatest only when ids match', () => {
  assert.equal(shouldRefreshWebLatest('v0.1.30a', 'v0.1.30a'), true)
  assert.equal(shouldRefreshWebLatest('v0.1.29a', 'v0.1.30a'), false)
})

test('runSync invokes catalog writer so models.json lists converted dirs', async () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-sync-'))
  const work = mkdtempSync(path.join(tmpdir(), 'dr-sync-work-'))
  const modelsOut = path.join(work, 'public', 'models', 'dungeon-runner')
  mkdirSync(modelsOut, { recursive: true })
  makeRepoLayout(temp, {
    versions: ['v0.1.30a'],
    productionLatest: 'v0.1.30a',
    ledger: [{ promoted_version: 'v0.1.30a', run_id: 'run-1' }],
  })

  const result = await runSync({
    cwd: work,
    parsed: { ...parseSyncArgs(['v0.1.30a']), ok: true },
    repoRoot: temp,
    convertModel: await mockConvert(work),
    updateCatalog: () =>
      spawnSync('node', [path.join(REPO_ROOT, 'scripts/update-dungeon-runner-model-catalog.mjs')], { cwd: work }),
  })

  assert.equal(result.status, 0)
  const catalog = JSON.parse(readFileSync(path.join(modelsOut, 'models.json'), 'utf8'))
  assert.ok(catalog.models.includes('v0.1.30a'))
  assert.ok(catalog.models.includes('latest'))
  rmSync(temp, { recursive: true, force: true })
  rmSync(work, { recursive: true, force: true })
})

test('refreshWebDeployedLatest copies semver tree into latest', () => {
  const work = mkdtempSync(path.join(tmpdir(), 'dr-sync-work-'))
  const semverDir = path.join(work, 'public', 'models', 'dungeon-runner', 'v0.1.30a')
  mkdirSync(semverDir, { recursive: true })
  writeFileSync(path.join(semverDir, 'model.json'), '{"modelId":"v0.1.30a"}\n')
  writeFileSync(path.join(semverDir, 'group1-shard1of1.bin'), 'shard')
  refreshWebDeployedLatest({ cwd: work, modelId: 'v0.1.30a' })
  assert.equal(readFileSync(path.join(work, 'public', 'models', 'dungeon-runner', 'latest', 'model.json'), 'utf8'), '{"modelId":"v0.1.30a"}\n')
  rmSync(work, { recursive: true, force: true })
})

function existsModel(work, modelId) {
  try {
    readFileSync(path.join(work, 'public', 'models', 'dungeon-runner', modelId, 'model.json'))
    return true
  } catch {
    return false
  }
}
