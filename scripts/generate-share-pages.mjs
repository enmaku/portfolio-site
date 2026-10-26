/**
 * Emit per-route HTML entry points into `dist/spa/` so link-preview crawlers
 * see route-specific <title>, description, and Open Graph tags in history mode.
 *
 * Each generated page ships the correct meta tags for that route and is served
 * as a real 200 OK by GitHub Pages, so the SPA router boots straight into it.
 * A copy of the app shell is also written to `404.html`, which GitHub Pages
 * serves for routes that cannot be pre-generated (dynamic params, unknown paths).
 *
 * Uses `GH_PAGES_BASE` (same env the Quasar build reads) so OG URLs and asset
 * links respect the GitHub Pages project base path. Uses
 * `SITE_ORIGIN` (CI sets the live domain; local default is `PUBLIC_SITE_ORIGIN`) to build absolute OG
 * URLs, since most preview crawlers require absolute URLs.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getShareEntryForPath,
  PASTE_UNFURL_ROUTES,
  PUBLIC_SITE_ORIGIN,
  SHARE_SITE_NAME,
} from '../src/share-metadata.js'
import { buildShareHtml } from '../src/features/share/sharePageHtml.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist/spa')
const INDEX_HTML = path.join(DIST, 'index.html')

const SITE_ORIGIN = (process.env.SITE_ORIGIN || PUBLIC_SITE_ORIGIN).replace(/\/+$/, '')
const PAGES_BASE = normalizeBase(process.env.GH_PAGES_BASE || '/')

function normalizeBase(value) {
  if (!value) return '/'
  const withLeading = value.startsWith('/') ? value : `/${value}`
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`
}

async function main() {
  let baseHtml
  try {
    baseHtml = await fs.readFile(INDEX_HTML, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.warn('generate-share-pages: dist/spa/index.html not found, skipping')
      return
    }
    throw e
  }

  const options = { siteOrigin: SITE_ORIGIN, pagesBase: PAGES_BASE, siteName: SHARE_SITE_NAME }
  const rootEntry = getShareEntryForPath('/')
  if (!rootEntry) throw new Error('share catalog missing home entry')
  const rootHtml = buildShareHtml(baseHtml, rootEntry, options)
  await fs.writeFile(INDEX_HTML, rootHtml, 'utf8')
  console.log(`generate-share-pages: updated ${path.relative(ROOT, INDEX_HTML)}`)

  for (const entry of PASTE_UNFURL_ROUTES) {
    const outDir = path.join(DIST, entry.shareSlug)
    const outFile = path.join(outDir, 'index.html')
    await fs.mkdir(outDir, { recursive: true })
    await fs.writeFile(outFile, buildShareHtml(baseHtml, entry, options), 'utf8')
    console.log(`generate-share-pages: wrote ${path.relative(ROOT, outFile)}`)
  }

  // History mode needs a fallback for routes that cannot be pre-generated
  // (dynamic params, unknown paths). GitHub Pages serves `404.html` for any
  // unmatched path, so a copy of the shell lets the SPA router take over.
  const fallbackPath = path.join(DIST, '404.html')
  await fs.writeFile(fallbackPath, rootHtml, 'utf8')
  console.log(`generate-share-pages: wrote ${path.relative(ROOT, fallbackPath)}`)

  console.log(
    `generate-share-pages: site origin ${SITE_ORIGIN}, pages base ${PAGES_BASE}`,
  )
}

main().catch((e) => {
  console.error('generate-share-pages failed:', e)
  process.exitCode = 1
})
