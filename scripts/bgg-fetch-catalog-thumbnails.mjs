#!/usr/bin/env node
/**
 * Fill thumbnailUrl on catalog-search-docs.jsonl via BGG /thing (no stats).
 *
 * Usage:
 *   npm run bgg:ranks:fetch-thumbs
 *
 * Resumes via data/bgg/catalog-thumb-fetch-progress.json
 */
import {
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadDotEnv, REPO_ROOT } from './lib/firebaseAdminLocal.mjs'
import {
  applyThumbnailsToDocs,
  fetchThumbnailUrlsForIds,
  idsMissingThumbnail,
} from './lib/bggCatalogThumbnails.mjs'

const JSONL_PATH = path.join(REPO_ROOT, 'data', 'bgg', 'catalog-search-docs.jsonl')
const PROGRESS_PATH = path.join(REPO_ROOT, 'data', 'bgg', 'catalog-thumb-fetch-progress.json')

/**
 * @param {number} ms
 * @returns {string}
 */
export function formatDurationMs(ms) {
  const sec = Math.max(0, Math.round(Number(ms) / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

/**
 * @param {{ fetched: number, total: number, elapsedMs: number }} info
 * @returns {string}
 */
export function formatThumbProgress({ fetched, total, elapsedMs }) {
  const done = Math.min(fetched, total)
  const pct = total <= 0 ? 100 : (done / total) * 100
  const remaining = Math.max(0, total - done)
  const etaMs = done > 0 ? (elapsedMs / done) * remaining : 0
  const etaLabel = done > 0 ? formatDurationMs(etaMs) : '—'
  return `${pct.toFixed(1)}%  ${done}/${total}  elapsed ${formatDurationMs(elapsedMs)}  eta ${etaLabel}`
}

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

/**
 * @param {string} jsonlPath
 * @param {object[]} docs
 */
export function writeCatalogJsonl(jsonlPath, docs) {
  const tmp = `${jsonlPath}.tmp`
  const body = `${docs.map((doc) => JSON.stringify(doc)).join('\n')}\n`
  writeFileSync(tmp, body, 'utf8')
  renameSync(tmp, jsonlPath)
}

/**
 * @param {string} progressPath
 * @returns {string[]}
 */
export function readProgressIds(progressPath) {
  if (!existsSync(progressPath)) return []
  try {
    const parsed = JSON.parse(readFileSync(progressPath, 'utf8'))
    return Array.isArray(parsed.completedIds) ? parsed.completedIds.map(String) : []
  } catch {
    return []
  }
}

/**
 * @param {string} progressPath
 * @param {string[]} completedIds
 */
export function writeProgressIds(progressPath, completedIds) {
  writeFileSync(
    progressPath,
    `${JSON.stringify({ completedIds, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  )
}

async function main() {
  loadDotEnv(path.join(REPO_ROOT, '.env'))
  const apiKey = String(process.env.GAME_MANAGER_API_KEY || '').trim()
  if (!apiKey) {
    console.error('Missing GAME_MANAGER_API_KEY (check .env)')
    process.exit(1)
  }
  if (!existsSync(JSONL_PATH)) {
    console.error(`Missing ${path.relative(REPO_ROOT, JSONL_PATH)}`)
    console.error('Run: npm run bgg:ranks:build-index')
    process.exit(1)
  }

  const docs = readCatalogJsonl(JSONL_PATH)
  const completed = readProgressIds(PROGRESS_PATH)
  const missing = idsMissingThumbnail(docs, completed)
  console.error(`Catalog docs: ${docs.length}; missing thumbs: ${missing.length}`)
  if (missing.length === 0) {
    console.error('Nothing to fetch.')
    return
  }

  const done = new Set(completed)
  const total = missing.length
  let fetched = 0
  const startedAt = Date.now()
  await fetchThumbnailUrlsForIds(apiKey, missing, {
    onBatch: ({ ids, urlById }) => {
      applyThumbnailsToDocs(docs, urlById)
      for (const id of ids) done.add(id)
      fetched += ids.length
      writeCatalogJsonl(JSONL_PATH, docs)
      writeProgressIds(PROGRESS_PATH, [...done])
      console.error(
        `  ${formatThumbProgress({ fetched, total, elapsedMs: Date.now() - startedAt })}`,
      )
    },
  })

  console.error(`Done. Progress → ${path.relative(REPO_ROOT, PROGRESS_PATH)}`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
