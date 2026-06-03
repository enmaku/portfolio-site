import { sortModelIdsForDisplay } from './discovery.js'

function parseCatalogModelIds(rawModels) {
  if (!Array.isArray(rawModels)) return []
  const ids = []
  for (const entry of rawModels) {
    if (typeof entry === 'string' && entry.trim()) {
      ids.push(entry.trim())
      continue
    }
    if (entry && typeof entry === 'object' && typeof entry.id === 'string' && entry.id.trim()) {
      ids.push(entry.id.trim())
    }
  }
  return ids
}

function parseCatalogPublishedAtByModelId(rawModels) {
  if (!Array.isArray(rawModels)) return {}
  /** @type {Record<string, string>} */
  const publishedAtByModelId = {}
  for (const entry of rawModels) {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id.trim()) continue
    if (typeof entry.publishedAt === 'string' && entry.publishedAt.trim()) {
      publishedAtByModelId[entry.id.trim()] = entry.publishedAt.trim()
    }
  }
  return publishedAtByModelId
}

export function normalizeModelCatalog(raw) {
  const models = sortModelIdsForDisplay([...new Set(parseCatalogModelIds(raw?.models))])
  const publishedAtByModelId = parseCatalogPublishedAtByModelId(raw?.models)
  return { models, publishedAtByModelId }
}

export async function fetchModelCatalog() {
  const baseUrl = import.meta.env?.BASE_URL ?? '/'
  const prefix = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const response = await fetch(`${prefix}models/dungeon-runner/models.json`, { cache: 'no-store' })
  if (!response.ok) return { models: [] }
  return normalizeModelCatalog(await response.json())
}
