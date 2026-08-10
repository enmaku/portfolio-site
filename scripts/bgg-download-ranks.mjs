#!/usr/bin/env node
/**
 * Local BoardGameGeek ranks CSV dump helper.
 *
 * Usage:
 *   npm run bgg:ranks:login
 *   npm run bgg:ranks:download
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BGG_DATA_DIR,
  downloadBggRanksCsv,
  interactiveBggLogin,
} from './lib/bggRanksDump.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CSV_PATH = path.join(BGG_DATA_DIR, 'boardgames_ranks.csv')

async function main() {
  const cmd = process.argv[2]
  if (cmd === 'login') {
    await interactiveBggLogin()
    return
  }
  if (cmd === 'download') {
    await downloadBggRanksCsv({ destCsvPath: CSV_PATH })
    console.error(`Ready → ${path.relative(ROOT, CSV_PATH)}`)
    return
  }
  console.error(`Usage:
  node scripts/bgg-download-ranks.mjs login
  node scripts/bgg-download-ranks.mjs download`)
  process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
