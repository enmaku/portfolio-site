/**
 * Local BGG ranks CSV dump via Playwright session (browser login).
 */
import { copyFileSync, createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const BGG_DATA_DIR = path.resolve(__dirname, '../../data/bgg')
export const BGG_AUTH_PATH = path.join(BGG_DATA_DIR, 'playwright-auth.json')
export const BGG_DUMP_URL = 'https://boardgamegeek.com/data_dumps/bg_ranks'
export const BGG_DOWNLOAD_LINK = 'a[href*="boardgames_ranks"]'
export const BGG_LOGIN_TIMEOUT_MS = 10 * 60 * 1000

export function ensureBggDataDir(dir = BGG_DATA_DIR) {
  mkdirSync(dir, { recursive: true })
}

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    throw new Error(
      'Missing playwright. Install once:\n  npm i -D playwright\n  npx playwright install chromium',
    )
  }
}

function zipNameFromUrl(url) {
  try {
    const base = path.basename(new URL(url).pathname)
    if (base.endsWith('.zip')) return base
  } catch {
    /* ignore */
  }
  const day = new Date().toISOString().slice(0, 10)
  return `boardgames_ranks_${day}.zip`
}

/**
 * @param {import('playwright').Page} page
 */
async function fetchDumpHref(page) {
  await page.goto(BGG_DUMP_URL, { waitUntil: 'domcontentloaded' })
  const denied = await page.locator("text=You don't have access").count()
  if (denied > 0) {
    throw new Error('Session lacks dump access')
  }
  await page.waitForSelector(BGG_DOWNLOAD_LINK, { timeout: 30_000 })
  const href = await page.locator(BGG_DOWNLOAD_LINK).first().getAttribute('href')
  if (!href) throw new Error('Download link missing href')
  return href
}

async function downloadZip(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Zip download failed: HTTP ${res.status}`)
  }
  if (!res.body) throw new Error('Zip download returned empty body')
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath))
}

/**
 * Opens a headed browser; waits until dump download link is visible; saves session.
 * @param {{ authPath?: string, timeoutMs?: number }} [opts]
 */
export async function interactiveBggLogin(opts = {}) {
  const authPath = opts.authPath ?? BGG_AUTH_PATH
  const timeoutMs = opts.timeoutMs ?? BGG_LOGIN_TIMEOUT_MS
  ensureBggDataDir(path.dirname(authPath))
  const { chromium } = await loadPlaywright()
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  console.error('Opening BGG dump page — log in if prompted.')
  console.error('Waiting for the ranks download link…')
  await page.goto(BGG_DUMP_URL, { waitUntil: 'domcontentloaded' })

  try {
    await page.waitForSelector(BGG_DOWNLOAD_LINK, { timeout: timeoutMs })
  } catch {
    await browser.close()
    throw new Error('Timed out waiting for download link. Are you logged in with dump access?')
  }

  await context.storageState({ path: authPath })
  await browser.close()
  console.error(`Saved session → ${authPath}`)
}

/**
 * Download ranks zip using saved Playwright auth; extract CSV to `destCsvPath`.
 * @param {{ authPath?: string, outDir?: string, destCsvPath: string }} opts
 * @returns {Promise<{ zipPath: string, csvPath: string }>}
 */
export async function downloadBggRanksCsv(opts) {
  const authPath = opts.authPath ?? BGG_AUTH_PATH
  const outDir = opts.outDir ?? BGG_DATA_DIR
  const destCsvPath = opts.destCsvPath
  if (!existsSync(authPath)) {
    throw new Error(`No saved session at ${authPath}`)
  }

  ensureBggDataDir(outDir)
  const { chromium } = await loadPlaywright()
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ storageState: authPath })
  const page = await context.newPage()

  let href
  try {
    href = await fetchDumpHref(page)
    await context.storageState({ path: authPath })
  } finally {
    await browser.close()
  }

  const zipPath = path.join(outDir, zipNameFromUrl(href))
  console.error(`Downloading → ${zipPath}`)
  await downloadZip(href, zipPath)

  const extractDir = path.join(outDir, '.extract-tmp')
  rmSync(extractDir, { recursive: true, force: true })
  mkdirSync(extractDir, { recursive: true })
  execFileSync('unzip', ['-o', zipPath, '-d', extractDir], { stdio: 'inherit' })
  const extracted = path.join(extractDir, 'boardgames_ranks.csv')
  if (!existsSync(extracted)) {
    throw new Error('Zip extracted but boardgames_ranks.csv was not found')
  }
  copyFileSync(extracted, destCsvPath)
  rmSync(extractDir, { recursive: true, force: true })
  console.error(`CSV ready → ${destCsvPath}`)
  return { zipPath, csvPath: destCsvPath }
}

/**
 * Try download with saved auth; on failure open login and retry once.
 * @param {{ authPath?: string, outDir?: string, destCsvPath: string }} opts
 */
export async function downloadBggRanksCsvWithReauth(opts) {
  try {
    return await downloadBggRanksCsv(opts)
  } catch (err) {
    console.error('Download with saved session failed:', err instanceof Error ? err.message : err)
    console.error('Opening browser for login…')
    await interactiveBggLogin({ authPath: opts.authPath })
    return downloadBggRanksCsv(opts)
  }
}
