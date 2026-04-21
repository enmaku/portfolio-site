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
 * `SITE_ORIGIN` (CI sets the live domain; local default is https://enmaku.github.io) to build absolute OG
 * URLs, since most preview crawlers require absolute URLs.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SHAREABLE_ROUTES, SHARE_METADATA } from '../src/share-metadata.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist/spa')
const INDEX_HTML = path.join(DIST, 'index.html')

const SITE_ORIGIN = (process.env.SITE_ORIGIN || 'https://enmaku.github.io').replace(/\/+$/, '')
const PAGES_BASE = normalizeBase(process.env.GH_PAGES_BASE || '/')

function normalizeBase(value) {
  if (!value) return '/'
  const withLeading = value.startsWith('/') ? value : `/${value}`
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`
}

/** @param {string} relPath */
function absoluteUrl(relPath) {
  const cleaned = String(relPath).replace(/^\/+/, '')
  return `${SITE_ORIGIN}${PAGES_BASE}${cleaned}`
}

/** @param {string} value */
function escapeAttr(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** @param {string} value */
function escapeJs(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/**
 * Remove any `<meta attrName="keyValue" ...>` tags, tolerating Quasar/Vite's
 * minified output which drops quotes around simple attribute values.
 *
 * @param {string} html
 * @param {'name' | 'property'} attrName
 * @param {string} keyValue
 */
function removeMeta(html, attrName, keyValue) {
  return html.replace(/<meta\b[^>]*>/gi, (match) => {
    const pattern = new RegExp(`\\b${attrName}=(?:"${keyValue}"|${keyValue})(?=[\\s>])`, 'i')
    return pattern.test(match) ? '' : match
  })
}

/**
 * @param {string} html
 * @param {'name' | 'property'} attrName
 * @param {string} keyValue
 * @param {string} content
 */
function setMeta(html, attrName, keyValue, content) {
  const stripped = removeMeta(html, attrName, keyValue)
  const tag = `<meta ${attrName}="${keyValue}" content="${escapeAttr(content)}" />`
  return stripped.replace('</head>', `    ${tag}\n  </head>`)
}

/** @param {string} html @param {string} title */
function setTitle(html, title) {
  const next = `<title>${escapeAttr(title)}</title>`
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, next)
  }
  return html.replace('</head>', `    ${next}\n  </head>`)
}

/**
 * @param {string} html
 * @param {import('../src/share-metadata.js').ShareMetadata} entry
 */
function buildShareHtml(html, entry) {
  const shareUrl = absoluteUrl(entry.shareSlug)
  const ogImageUrl = absoluteUrl(entry.ogImage)
  const hashTarget =
    entry.routePath === '/' ? `${PAGES_BASE}#/` : `${PAGES_BASE}#${entry.routePath}`

  let output = html

  output = setTitle(output, entry.title)
  output = setMeta(output, 'name', 'description', entry.description)
  output = setMeta(output, 'property', 'og:title', entry.title)
  output = setMeta(output, 'property', 'og:description', entry.description)
  output = setMeta(output, 'property', 'og:image', ogImageUrl)
  output = setMeta(output, 'property', 'og:url', shareUrl)
  output = setMeta(output, 'name', 'twitter:title', entry.title)
  output = setMeta(output, 'name', 'twitter:description', entry.description)
  output = setMeta(output, 'name', 'twitter:image', ogImageUrl)

  const redirectTag = `<script>(function(){if(!window.location.hash){window.location.replace('${escapeJs(hashTarget)}');}})();</script>`
  output = output.replace(/<body(\s[^>]*)?>/i, (match) => `${match}\n    ${redirectTag}`)

  return output
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

  const rootHtml = buildShareHtml(baseHtml, SHARE_METADATA.root)
  await fs.writeFile(INDEX_HTML, rootHtml, 'utf8')
  console.log(`generate-share-pages: updated ${path.relative(ROOT, INDEX_HTML)}`)

  for (const entry of SHAREABLE_ROUTES) {
    const outDir = path.join(DIST, entry.shareSlug)
    const outFile = path.join(outDir, 'index.html')
    await fs.mkdir(outDir, { recursive: true })
    await fs.writeFile(outFile, buildShareHtml(baseHtml, entry), 'utf8')
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
