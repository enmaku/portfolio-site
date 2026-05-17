/**
 * Emit per-route HTML entry points into `dist/spa/` so link-preview crawlers
 * see route-specific <title>, description, and Open Graph tags even though
 * the app itself is a hash-routed SPA.
 *
 * Each generated page:
 *   1. Ships the correct meta tags for that route.
 *   2. Includes an inline redirect that sends real browsers to the equivalent
 *      hash URL so the SPA router takes over.
 *
 * Uses `GH_PAGES_BASE` (same env the Quasar build reads) so OG URLs and the
 * redirect target respect the GitHub Pages project base path. Uses
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

  console.log(
    `generate-share-pages: site origin ${SITE_ORIGIN}, pages base ${PAGES_BASE}`,
  )
}

main().catch((e) => {
  console.error('generate-share-pages failed:', e)
  process.exitCode = 1
})
