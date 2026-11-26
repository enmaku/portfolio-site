import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import routes from '../../../router/routes.js'
import {
  APP_ICON_COLORS,
  APP_ICON_SIZES,
  INSTALLABLE_APPS,
  SHARE_CATALOG,
  appIconPath,
  getInstallableAppForPath,
  getShareEntryForPath,
} from '../../../share-metadata.js'

const publicFile = (rel) => fileURLToPath(new URL(`../../../../public/${rel}`, import.meta.url))

test('exactly one share-catalog row serves /projects/critcrafter, paste-unfurl, generic card', () => {
  const rows = SHARE_CATALOG.filter((e) => e.routePath.startsWith('/projects/critcrafter'))
  assert.equal(rows.length, 1)
  const [row] = rows
  assert.equal(row.routePath, '/projects/critcrafter')
  assert.equal(row.pasteUnfurl, true)
  assert.equal(row.shareSlug, 'projects/critcrafter')
  assert.equal(row.title, 'CritCrafter')
  assert.equal(row.ogImage, 'icons/social/critcrafter.png')
  assert.equal(row.favicon, 'critcrafter')
  assert.ok(row.description.length > 20)
  // ?id= links unfurl as that same generic card: lookup is by path only.
  assert.equal(getShareEntryForPath('/projects/critcrafter/'), row)
})

test('the share card carries no per-character data', () => {
  const row = getShareEntryForPath('/projects/critcrafter')
  assert.doesNotMatch(JSON.stringify(row), /\?id=|Lithrei|Anya/i)
})

test('the OG image, favicon and launcher icons exist; launcher colour is registered but the app is not installable', async () => {
  assert.equal(existsSync(publicFile('icons/social/critcrafter.png')), true)
  assert.equal(existsSync(publicFile('icons/favicon-critcrafter.svg')), true)
  assert.equal(existsSync(publicFile('icons/app-icon-critcrafter.svg')), true)
  assert.match(APP_ICON_COLORS.critcrafter, /^#[0-9a-fA-F]{6}$/)
  for (const size of APP_ICON_SIZES) {
    const file = publicFile(appIconPath('critcrafter', size))
    assert.equal(existsSync(file), true, file)
    const meta = await sharp(file).metadata()
    assert.equal(meta.width, size)
    assert.equal(meta.height, size)
  }
  assert.equal(INSTALLABLE_APPS.some((a) => a.iconId === 'critcrafter'), false)
  assert.equal(getInstallableAppForPath('/projects/critcrafter'), null)
})

test('/projects/critcrafter is a single route in the project shell; the prototype stays dev-gated', () => {
  const shell = routes.find((r) => r.path === '/projects/critcrafter')
  assert.ok(shell, 'route registered')
  assert.equal(shell.children.length, 1)
  assert.equal(shell.children[0].path, '')
  assert.equal(
    routes.some((r) => r.path === '/projects/critcrafter-prototype'),
    Boolean(import.meta.env?.DEV),
  )
})

test('the main nav lists CritCrafter in the Mobile section', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../../../layouts/MainLayout.vue', import.meta.url)),
    'utf8',
  )
  const mobile = src.slice(src.indexOf("label: 'Mobile'"), src.indexOf("label: 'Desktop'"))
  assert.match(mobile, /to: '\/projects\/critcrafter'/)
})
