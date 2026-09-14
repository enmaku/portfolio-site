#!/usr/bin/env node
/**
 * Hit production bggSearch for progressive title prefixes of the top 500 ranked
 * games (e.g. Last Will → "last", then "last will").
 *
 * Usage:
 *   npm run bgg:ranks:seed-top-searches
 *
 * Reads: data/bgg/catalog-search-docs.jsonl
 * Resumes via data/bgg/catalog-top-search-seed-progress.json
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { envValue, loadDotEnv, REPO_ROOT } from './lib/firebaseAdminLocal.mjs'
import {
  bggSearchUrl,
  formatSeedProgress,
  resolveBggSearchFunctionsBase,
  SHORT_SEARCH_GAP_MS,
} from './lib/bggSeedShortSearches.mjs'
import {
  TOP_GAMES_LIMIT,
  uniqueTypingQueriesForTopGames,
} from './lib/bggSeedTopSearches.mjs'
import {
  fetchBggSearch,
  readCompletedQueries,
  writeCompletedQueries,
} from './bgg-seed-short-searches.mjs'

const JSONL_PATH = path.join(REPO_ROOT, 'data', 'bgg', 'catalog-search-docs.jsonl')
const PROGRESS_PATH = path.join(REPO_ROOT, 'data', 'bgg', 'catalog-top-search-seed-progress.json')

/**
 * @param {string} jsonlPath
 * @returns {object[]}
 */
export function readCatalogJsonl(jsonlPath) {
  const raw = readFileSync(jsonlPath, 'utf8')
  const docs = []
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    docs.push(JSON.parse(line))
  }
  return docs
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
  if (!existsSync(JSONL_PATH)) {
    console.error(`Missing ${path.relative(REPO_ROOT, JSONL_PATH)}`)
    console.error('Run: npm run bgg:ranks:build-index')
    process.exit(1)
  }

  const docs = readCatalogJsonl(JSONL_PATH)
  const all = uniqueTypingQueriesForTopGames(docs, TOP_GAMES_LIMIT)
  const completed = new Set(readCompletedQueries(PROGRESS_PATH))
  const pending = all.filter((q) => !completed.has(q))
  console.error(`bggSearch base: ${functionsBase}`)
  console.error(`Top ${TOP_GAMES_LIMIT} games → ${all.length} unique typing queries; remaining: ${pending.length}`)
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
