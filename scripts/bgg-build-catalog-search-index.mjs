#!/usr/bin/env node
/**
 * Build Model A catalog search docs from boardgames_ranks.csv (local only).
 *
 * Does not upload to Firestore.
 *
 * Usage:
 *   npm run bgg:ranks:build-index
 *
 * Reads:  data/bgg/boardgames_ranks.csv
 * Writes: data/bgg/catalog-search-docs.jsonl
 *         data/bgg/catalog-search-docs.sample.json
 *         data/bgg/catalog-search-docs.summary.json
 */
import { createReadStream, createWriteStream, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import {
  catalogSearchDocFromRankRow,
  csvRowToObject,
} from './lib/bggCatalogSearchIndex.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'data', 'bgg')
const CSV_PATH = path.join(OUT_DIR, 'boardgames_ranks.csv')
const JSONL_PATH = path.join(OUT_DIR, 'catalog-search-docs.jsonl')
const SAMPLE_PATH = path.join(OUT_DIR, 'catalog-search-docs.sample.json')
const SUMMARY_PATH = path.join(OUT_DIR, 'catalog-search-docs.summary.json')

const SAMPLE_TARGET = 25
const WINGSPAN_ID = '266192'

async function main() {
  if (!existsSync(CSV_PATH)) {
    console.error(`Missing ${path.relative(ROOT, CSV_PATH)}`)
    console.error('Run: npm run bgg:ranks:download')
    process.exit(1)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const out = createWriteStream(JSONL_PATH, { encoding: 'utf8' })

  const rl = readline.createInterface({
    input: createReadStream(CSV_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  let header = null
  let csvRows = 0
  let docs = 0
  let skippedExpansions = 0
  let skippedInvalid = 0
  let prefixEntries = 0
  let maxPrefixes = 0
  /** @type {object[]} */
  const sample = []
  /** @type {object | null} */
  let wingspanDoc = null

  for await (const line of rl) {
    if (!line) continue
    if (header === null) {
      header = line
      continue
    }
    csvRows += 1
    const row = csvRowToObject(header, line)
    if (String(row.is_expansion ?? '') === '1') {
      skippedExpansions += 1
      continue
    }
    const doc = catalogSearchDocFromRankRow(row)
    if (!doc) {
      skippedInvalid += 1
      continue
    }
    const serialized = `${JSON.stringify(doc)}\n`
    if (!out.write(serialized)) {
      await new Promise((resolve) => out.once('drain', resolve))
    }
    docs += 1
    prefixEntries += doc.searchPrefixes.length
    if (doc.searchPrefixes.length > maxPrefixes) {
      maxPrefixes = doc.searchPrefixes.length
    }
    if (sample.length < SAMPLE_TARGET) {
      sample.push(doc)
    }
    if (doc.bggId === WINGSPAN_ID) {
      wingspanDoc = doc
    }
  }

  await new Promise((resolve, reject) => {
    out.end(() => resolve())
    out.on('error', reject)
  })

  if (wingspanDoc && !sample.some((d) => d.bggId === WINGSPAN_ID)) {
    sample.push(wingspanDoc)
  }

  const summary = {
    sourceCsv: path.relative(ROOT, CSV_PATH),
    builtAt: new Date().toISOString(),
    model: 'A',
    csvDataRows: csvRows,
    docsWritten: docs,
    skippedExpansions,
    skippedInvalid,
    prefixEntriesTotal: prefixEntries,
    prefixesPerDocAvg: docs ? Math.round((prefixEntries / docs) * 100) / 100 : 0,
    prefixesPerDocMax: maxPrefixes,
    outputs: {
      jsonl: path.relative(ROOT, JSONL_PATH),
      sample: path.relative(ROOT, SAMPLE_PATH),
      summary: path.relative(ROOT, SUMMARY_PATH),
    },
  }

  writeFileSync(SAMPLE_PATH, `${JSON.stringify(sample, null, 2)}\n`, 'utf8')
  writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

  console.error(JSON.stringify(summary, null, 2))
  console.error(`Wrote ${path.relative(ROOT, JSONL_PATH)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
