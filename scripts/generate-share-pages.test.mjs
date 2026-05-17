import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { PASTE_UNFURL_ROUTES, PUBLIC_SITE_ORIGIN } from '../src/share-metadata.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist/spa')
const INDEX_HTML = path.join(DIST, 'index.html')
const BASE_HTML = '<!doctype html><html><head><title>Base</title></head><body></body></html>'
const execFileAsync = promisify(execFile)

test('generate-share-pages writes root and paste-unfurl HTML via buildShareHtml', async (t) => {
  let hadDist = false
  /** @type {string | null} */
  let priorIndex = null

  try {
    await fs.access(DIST)
    hadDist = true
    try {
      priorIndex = await fs.readFile(INDEX_HTML, 'utf8')
    } catch {
      // no index yet
    }
  } catch {
    // dist missing
  }

  await fs.mkdir(DIST, { recursive: true })
  await fs.writeFile(INDEX_HTML, BASE_HTML, 'utf8')

  t.after(async () => {
    for (const entry of PASTE_UNFURL_ROUTES) {
      await fs.rm(path.join(DIST, entry.shareSlug), { recursive: true, force: true })
    }
    if (priorIndex !== null) {
      await fs.writeFile(INDEX_HTML, priorIndex, 'utf8')
    } else if (!hadDist) {
      await fs.rm(DIST, { recursive: true, force: true })
    } else {
      await fs.writeFile(INDEX_HTML, BASE_HTML, 'utf8')
    }
  })

  await execFileAsync('node', ['./scripts/generate-share-pages.mjs'], {
    cwd: ROOT,
    env: { ...process.env, SITE_ORIGIN: PUBLIC_SITE_ORIGIN, GH_PAGES_BASE: '/' },
  })

  const rootHtml = await fs.readFile(INDEX_HTML, 'utf8')
  assert.match(rootHtml, /<meta property="og:site_name" content="Focus Disorder"/)
  assert.notEqual(rootHtml, BASE_HTML)

  const origin = PUBLIC_SITE_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const entry of PASTE_UNFURL_ROUTES) {
    const html = await fs.readFile(path.join(DIST, entry.shareSlug, 'index.html'), 'utf8')
    const slug = entry.shareSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.match(html, new RegExp(`<meta property="og:url" content="${origin}/${slug}"`))
  }

  await assert.rejects(() => fs.access(path.join(DIST, 'cardpreview', 'index.html')))
})
