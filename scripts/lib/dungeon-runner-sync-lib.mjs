import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync } from 'node:fs'
import path from 'node:path'
import { assertH5WeightsPresent } from './dungeon-runner-convert-lib.mjs'
import { isPromotedVersionDirName, validatePromotedVersionId } from './dungeon-runner-model-id.mjs'

export { isPromotedVersionDirName, validatePromotedVersionId } from './dungeon-runner-model-id.mjs'
const DEFAULT_REPO_URL = 'https://github.com/enmaku/dungeon-runner.git'
const DEFAULT_REPO_REF = 'main'
const DEFAULT_REPO_MODELS_DIR = 'models'

export function parseSyncArgs(argv) {
  const args = argv ?? []
  const syncAll = args.includes('--all')
  const fromLatest = args.includes('--from-latest') || args.length === 0
  const modelId = args.find((arg) => !arg.startsWith('--')) ?? null
  const repoUrl = getArgValue(args, '--repo-url') ?? DEFAULT_REPO_URL
  const repoRef = getArgValue(args, '--repo-ref') ?? DEFAULT_REPO_REF
  const repoModelsDir = getArgValue(args, '--repo-models-dir') ?? DEFAULT_REPO_MODELS_DIR

  if (syncAll && (modelId || fromLatest)) {
    return { ok: false, error: 'Use either <promoted-version>, --from-latest, or --all' }
  }
  if (fromLatest && modelId) {
    return { ok: false, error: 'Use either <promoted-version> or --from-latest, not both' }
  }
  if (!syncAll && !fromLatest && !modelId) {
    return {
      ok: false,
      error:
        'Usage: node scripts/sync-dungeon-runner-model.mjs [<promoted-version>|--from-latest|--all] [--repo-url <url>] [--repo-ref <ref>] [--repo-models-dir <dir>] (no args defaults to --from-latest)',
    }
  }

  if (modelId) {
    const idCheck = validatePromotedVersionId(modelId)
    if (!idCheck.ok) return { ok: false, error: idCheck.error }
  }

  return {
    ok: true,
    syncAll,
    fromLatest,
    modelId,
    repoUrl,
    repoRef,
    repoModelsDir,
    convertArgs: args.filter((arg) => arg !== '--from-latest'),
  }
}

export function resolveDungeonRunnerModelsDir({ env, repoRoot, repoModelsDir = DEFAULT_REPO_MODELS_DIR }) {
  const localRoot = env?.DUNGEON_RUNNER_ROOT?.trim()
  if (localRoot) {
    const modelsDir = path.join(localRoot, repoModelsDir)
    if (existsSync(modelsDir)) return { modelsDir, repoRoot: localRoot, source: 'local' }
  }
  if (repoRoot) {
    return { modelsDir: path.join(repoRoot, repoModelsDir), repoRoot, source: 'clone' }
  }
  return { modelsDir: null, repoRoot: null, source: null }
}

export function readProductionLatestId(modelsRoot) {
  const latestPath = path.join(modelsRoot, 'latest')
  let stat
  try {
    stat = lstatSync(latestPath)
  } catch {
    throw new Error(`Production latest path not found: ${latestPath}`)
  }
  if (stat.isSymbolicLink()) {
    const target = readlinkSync(latestPath)
    const resolved = path.resolve(path.dirname(latestPath), target)
    return path.basename(resolved)
  }
  if (stat.isDirectory()) {
    throw new Error(
      'models/latest is a directory, not a symlink; migrate dungeon-runner production latest before --from-latest',
    )
  }
  throw new Error(`models/latest must be a symlink: ${latestPath}`)
}

export function listPromotedVersionIds(modelsRoot) {
  if (!existsSync(modelsRoot)) return []
  return readdirSync(modelsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isPromotedVersionDirName(entry.name))
    .map((entry) => entry.name)
    .sort()
}

export function isPromotedInLedger(modelId, repoRoot) {
  const modelsRoot = path.join(repoRoot, DEFAULT_REPO_MODELS_DIR)
  const promotionPath = path.join(modelsRoot, modelId, 'promotion.json')
  if (existsSync(promotionPath)) return true

  const ledgerPath = path.join(modelsRoot, 'promotions.jsonl')
  if (!existsSync(ledgerPath)) return false

  const lines = readFileSync(ledgerPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    try {
      const record = JSON.parse(line)
      if (record.promoted_version === modelId || record.version === modelId) return true
    } catch {
      // skip malformed lines
    }
  }
  return false
}

export function shouldRefreshWebLatest(modelId, productionLatestId) {
  return Boolean(modelId && productionLatestId && modelId === productionLatestId)
}

export function refreshWebDeployedLatest({ cwd, modelId }) {
  const semverDir = path.join(cwd, 'public', 'models', 'dungeon-runner', modelId)
  const latestDir = path.join(cwd, 'public', 'models', 'dungeon-runner', 'latest')
  if (!existsSync(path.join(semverDir, 'model.json'))) {
    throw new Error(`Cannot refresh web deployed latest: missing ${path.join(semverDir, 'model.json')}`)
  }
  mkdirSync(latestDir, { recursive: true })
  cpSync(semverDir, latestDir, { recursive: true, force: true })
}

export async function runSync({
  cwd = process.cwd(),
  env = process.env,
  parsed,
  repoRoot,
  convertModel,
  updateCatalog,
}) {
  const modelsRoot = path.join(repoRoot, parsed.repoModelsDir)
  let productionLatestId = null
  try {
    productionLatestId = readProductionLatestId(modelsRoot)
  } catch (error) {
    if (parsed.fromLatest || parsed.syncAll) {
      return { status: 1, message: error.message }
    }
  }

  const convertEnv = {
    ...env,
    DUNGEON_RUNNER_MODELS_DIR: modelsRoot,
  }

  if (parsed.syncAll) {
    const modelIds = listPromotedVersionIds(modelsRoot)
    for (const id of modelIds) {
      const weightsCheck = assertH5WeightsPresent({
        sourceModelsDir: modelsRoot,
        modelId: id,
      })
      if (!weightsCheck.ok) {
        return { status: 1, message: weightsCheck.error }
      }
      const result = await convertModel(id, convertEnv, parsed.convertArgs)
      if (result.status !== 0) return result
    }
    if (productionLatestId && existsSync(path.join(modelsRoot, productionLatestId))) {
      refreshWebDeployedLatest({ cwd, modelId: productionLatestId })
    }
  } else {
    let modelId = parsed.modelId
    if (parsed.fromLatest) {
      if (!productionLatestId) {
        return { status: 1, message: 'Could not resolve production latest' }
      }
      modelId = productionLatestId
    }

    const idCheck = validatePromotedVersionId(modelId)
    if (!idCheck.ok) {
      return { status: 1, message: idCheck.error }
    }
    modelId = idCheck.modelId

    const weightsCheck = assertH5WeightsPresent({
      sourceModelsDir: modelsRoot,
      modelId,
    })
    if (!weightsCheck.ok) {
      return { status: 1, message: weightsCheck.error }
    }

    const requiresLedger = !parsed.fromLatest
    if (requiresLedger && !isPromotedInLedger(modelId, repoRoot)) {
      return {
        status: 1,
        message: `Promoted version not in ledger: ${modelId} (missing promotions.jsonl entry and models/${modelId}/promotion.json)`,
      }
    }

    const convertResult = await convertModel(modelId, convertEnv, parsed.convertArgs)
    if (convertResult.status !== 0) return convertResult

    if (shouldRefreshWebLatest(modelId, productionLatestId)) {
      refreshWebDeployedLatest({ cwd, modelId })
    }
  }

  const catalogResult = await updateCatalog()
  if (catalogResult.status !== 0) return catalogResult

  const label = parsed.syncAll ? 'all' : parsed.fromLatest ? productionLatestId : parsed.modelId
  return { status: 0, message: `Synced Dungeon Runner model: ${label}` }
}

function getArgValue(argsList, name) {
  const index = argsList.indexOf(name)
  if (index === -1) return null
  return argsList[index + 1] ?? null
}
