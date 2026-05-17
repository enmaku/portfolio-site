import { sortModelIdsForDisplay } from './discovery.js'

export function normalizeModelCatalog(raw) {
  const models = Array.isArray(raw?.models) ? raw.models.filter((id) => typeof id === 'string' && id.trim()) : []
  return { models: sortModelIdsForDisplay([...new Set(models)]) }
}

export async function fetchModelCatalog() {
  const baseUrl = import.meta.env?.BASE_URL ?? '/'
  const prefix = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const response = await fetch(`${prefix}models/dungeon-runner/models.json`, { cache: 'no-store' })
  if (!response.ok) return { models: [] }
  return normalizeModelCatalog(await response.json())
}
