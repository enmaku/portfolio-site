#!/usr/bin/env node
/**
 * Hit production bggSearch for every two-letter query (aa–zz) so the top 20
 * hits per prefix get thumbnailUrl filled on catalog docs.
 *
 * Usage:
 *   npm run bgg:ranks:seed-short-searches
 *
 * Resumes via data/bgg/catalog-short-search-seed-progress.json
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { envValue, loadDotEnv, REPO_ROOT } from './lib/firebaseAdminLocal.mjs'
import {
  bggSearchUrl,
  formatSeedProgress,
  resolveBggSearchFunctionsBase,
  SHORT_SEARCH_GAP_MS,
  SHORT_SEARCH_HTTP_TIMEOUT_MS,
  twoLetterQueries,
} from './lib/bggSeedShortSearches.mjs'

const PROGRESS_PATH = path.join(REPO_ROOT, 'data', 'bgg', 'catalog-short-search-seed-progress.json')

/**
 * @param {string} progressPath
 * @returns {string[]}
 */
export function readCompletedQueries(progressPath) {
  if (!existsSync(progressPath)) return []
  try {
    const parsed = JSON.parse(readFileSync(progressPath, 'utf8'))
    return Array.isArray(parsed.completedQueries) ? parsed.completedQueries.map(String) : []
  } catch {
    return []
  }
}

/**
 * @param {string} progressPath
 * @param {string[]} completedQueries
 */
export function writeCompletedQueries(progressPath, completedQueries) {
  writeFileSync(
    progressPath,
    `${JSON.stringify({ completedQueries, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  )
}

/**
 * @param {string} url
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 */
export async function fetchBggSearch(url, opts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch
  const timeoutMs = opts.timeoutMs ?? SHORT_SEARCH_HTTP_TIMEOUT_MS
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const err = new Error(`bggSearch HTTP ${response.status}`)
    err.status = response.status
    throw err
  }
  const results = Array.isArray(body?.results) ? body.results : []
  return results
}

async function main() {
  loadDotEnv(path.join(REPO_ROOT, '.env'))
  const functionsBase = resolveBggSearchFunctionsBase({
    VITE_GAME_MANAGER_BGG_FUNCTIONS_BASE: envValue('VITE_GAME_MANAGER_BGG_FUNCTIONS_BASE'),
    VITE_FIREBASE_PROJECT_ID: envValue('VITE_FIREBASE_PROJECT_ID'),
  })
  if (!functionsBase) {
    console.error('Missing VITE_FIREBASE_PROJECT_ID (or VITE_GAME_MANAGER_BGG_FUNCTIONS_BASE)')
    process.exit(1)
  }

  const all = twoLetterQueries()
  const completed = new Set(readCompletedQueries(PROGRESS_PATH))
  const pending = all.filter((q) => !completed.has(q))
  console.error(`bggSearch base: ${functionsBase}`)
  console.error(`Two-letter queries: ${all.length}; remaining: ${pending.length}`)
  if (pending.length === 0) {
    console.error('Nothing to seed.')
    return
  }

  const startedAt = Date.now()
  let done = all.length - pending.length
  const total = all.length

  for (let i = 0; i < pending.length; i += 1) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, SHORT_SEARCH_GAP_MS))
    }
    const query = pending[i]
    const url = bggSearchUrl(functionsBase, query)
    let hitCount = 0
    try {
      const results = await fetchBggSearch(url)
      hitCount = results.length
      completed.add(query)
      done += 1
      writeCompletedQueries(PROGRESS_PATH, [...completed])
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`  failed ${query}: ${message}`)
      done += 1
    }
    console.error(
      `  ${formatSeedProgress({
        done,
        total,
        elapsedMs: Date.now() - startedAt,
        query,
        hitCount,
      })}`,
    )
  }

  console.error(`Done. Progress → ${path.relative(REPO_ROOT, PROGRESS_PATH)}`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
