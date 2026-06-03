import { existsSync, lstatSync, readFileSync, readlinkSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const DEFAULT_REPO_MODELS_DIR = 'models'

/**
 * @param {unknown} rawModels
 * @returns {Map<string, string | undefined>}
 */
export function parseCatalogPublishedAtById(rawModels) {
  /** @type {Map<string, string | undefined>} */
  const map = new Map()
  if (!Array.isArray(rawModels)) return map

  for (const entry of rawModels) {
    if (typeof entry === 'string' && entry.trim()) {
      map.set(entry.trim(), map.get(entry.trim()))
      continue
    }
    if (!entry || typeof entry !== 'object') continue
    const id = typeof entry.id === 'string' ? entry.id.trim() : ''
    if (!id) continue
    const publishedAt = typeof entry.publishedAt === 'string' && entry.publishedAt.trim()
      ? entry.publishedAt.trim()
      : undefined
    map.set(id, publishedAt ?? map.get(id))
  }
  return map
}

/**
 * @param {string} modelsRoot
 * @returns {Map<string, string | undefined>}
 */
export function readCatalogPublishedAtById(modelsRoot) {
  const catalogPath = path.join(modelsRoot, 'models.json')
  if (!existsSync(catalogPath)) return new Map()
  try {
    const raw = JSON.parse(readFileSync(catalogPath, 'utf8'))
    return parseCatalogPublishedAtById(raw?.models)
  } catch {
    return new Map()
  }
}

/**
 * @param {string} repoRoot
 * @returns {Record<string, string>}
 */
export function readPromotionPublishedAtById(repoRoot) {
  /** @type {Record<string, string>} */
  const dates = {}
  const modelsRoot = path.join(repoRoot, DEFAULT_REPO_MODELS_DIR)
  const ledgerPath = path.join(modelsRoot, 'promotions.jsonl')
  if (existsSync(ledgerPath)) {
    for (const line of readFileSync(ledgerPath, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const record = JSON.parse(trimmed)
        const id = record.promoted_version ?? record.version
        const publishedAt = record.promoted_at
        if (typeof id === 'string' && typeof publishedAt === 'string' && publishedAt.trim()) {
          dates[id] = publishedAt.trim()
        }
      } catch {
        // skip malformed lines
      }
    }
  }

  if (!existsSync(modelsRoot)) return dates
  for (const entry of readdirSync(modelsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const promotionPath = path.join(modelsRoot, entry.name, 'promotion.json')
    if (!existsSync(promotionPath)) continue
    try {
      const record = JSON.parse(readFileSync(promotionPath, 'utf8'))
      const id = record.promoted_version ?? record.version ?? entry.name
      const publishedAt = record.promoted_at
      if (typeof id === 'string' && typeof publishedAt === 'string' && publishedAt.trim()) {
        dates[id] = publishedAt.trim()
      }
    } catch {
      // skip malformed promotion.json
    }
  }

  return dates
}

/**
 * @param {string} modelsRoot
 * @returns {string[]}
 */
export function listDeployedModelIds(modelsRoot) {
  if (!existsSync(modelsRoot)) return []
  return readdirSync(modelsRoot).filter((entry) => {
    const dirPath = path.join(modelsRoot, entry)
    return statSync(dirPath).isDirectory() && existsSync(path.join(dirPath, 'model.json'))
  })
}

/**
 * @param {string} modelsRoot
 * @param {string} repoRoot
 * @returns {string | null}
 */
export function readProductionLatestId(modelsRoot) {
  const latestPath = path.join(modelsRoot, 'latest')
  try {
    const stat = lstatSync(latestPath)
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(latestPath)
      return path.basename(path.resolve(path.dirname(latestPath), target))
    }
  } catch {
    return null
  }
  return null
}

/**
 * @param {string} modelsRoot
 * @param {{ repoRoot?: string | null, sortModelIds?: (ids: string[]) => string[] }} [options]
 */
export function writeModelCatalog(modelsRoot, options = {}) {
  const dirIds = listDeployedModelIds(modelsRoot)
  const existing = readCatalogPublishedAtById(modelsRoot)
  const repoRoot = options.repoRoot ?? null
  const promotionDates = repoRoot ? readPromotionPublishedAtById(repoRoot) : {}
  const productionLatestId =
    repoRoot != null ? readProductionLatestId(path.join(repoRoot, DEFAULT_REPO_MODELS_DIR)) : null

  const sort = options.sortModelIds ?? ((ids) => [...ids].sort())
  const sortedIds = sort(dirIds)

  const models = sortedIds.map((id) => {
    let publishedAt = existing.get(id) ?? promotionDates[id]
    if (id === 'latest' && productionLatestId) {
      publishedAt =
        promotionDates[productionLatestId] ??
        existing.get(productionLatestId) ??
        promotionDates[id] ??
        existing.get(id)
    }
    if (typeof publishedAt === 'string' && publishedAt.length > 0) {
      return { id, publishedAt }
    }
    return { id }
  })

  writeFileSync(path.join(modelsRoot, 'models.json'), JSON.stringify({ models }, null, 2) + '\n')
  return models
}
