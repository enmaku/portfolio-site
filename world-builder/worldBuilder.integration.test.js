import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import routes from '../src/router/routes.js'
import { getShareEntryForPath, PASTE_UNFURL_ROUTES } from '../src/share-metadata.js'

const WORLD_BUILDER_PATH = '/projects/world-builder'

test('world builder route is a MainLayout child', () => {
  const mainLayout = routes.find((entry) => entry.path === '/')
  assert.ok(mainLayout)
  const worldBuilderRoute = mainLayout.children?.find(
    (child) => child.path === 'projects/world-builder',
  )
  assert.ok(worldBuilderRoute)
  assert.match(String(worldBuilderRoute.component), /WorldBuilderPage\.vue/)
})

test('world builder route is not under ProjectShellLayout', () => {
  const shellRoute = routes.find((entry) => entry.path === '/projects/world-builder')
  assert.strictEqual(shellRoute, undefined)
})

test('world builder share catalog row is paste-unfurl eligible', () => {
  const entry = getShareEntryForPath(WORLD_BUILDER_PATH)
  assert.ok(entry)
  assert.strictEqual(entry.pasteUnfurl, true)
  assert.strictEqual(entry.title, 'World Builder')
  assert.strictEqual(entry.title.includes('—'), false)
  assert.strictEqual(PASTE_UNFURL_ROUTES.some((row) => row.routePath === WORLD_BUILDER_PATH), true)
})

test('main layout desktop section links world builder in-tab with globe icon', () => {
  const mainLayout = readFileSync(new URL('../src/layouts/MainLayout.vue', import.meta.url), 'utf8')
  assert.strictEqual(mainLayout.includes(`'${WORLD_BUILDER_PATH}'`), true)
  assert.strictEqual(mainLayout.includes("'World Builder'"), true)
  assert.strictEqual(mainLayout.includes("'public'"), true)
  assert.strictEqual(mainLayout.includes('navigateInTab: true'), true)
})

test('world builder page wires derived pipeline, lazy renderer, and control test ids', () => {
  const page = readFileSync(
    new URL('../src/pages/projects/WorldBuilderPage.vue', import.meta.url),
    'utf8',
  )
  assert.strictEqual(page.includes('runDerivedGeographyInWorker'), true)
  assert.strictEqual(page.includes('worldBuilderPageModel'), true)
  assert.strictEqual(
    page.includes("import('@world-builder/renderer/createWorldBuilderMapViewport.js')"),
    true,
  )
  assert.strictEqual(page.includes('data-testid="world-builder-map-host"'), true)
  assert.strictEqual(page.includes('data-testid="world-builder-seed-input"'), true)
  assert.strictEqual(page.includes('data-testid="world-builder-wind-slider"'), true)
  assert.strictEqual(page.includes('data-testid="world-builder-regenerate"'), true)
  assert.strictEqual(page.includes('data-testid="world-builder-generation-report"'), true)
  assert.strictEqual(page.includes('data-testid="world-builder-generation-replay"'), true)
  assert.strictEqual(page.includes('data-testid="world-builder-generation-progress"'), true)
  assert.match(page, /world-builder-generation-step-\$\{step\.id\}/)
  assert.match(page, /world-builder-validation-row-\$\{row\.checkId\}/)
})

test('world builder derived geography pipeline module is importable', async () => {
  const { generateDerivedGeography } = await import('./core/generateDerivedGeography.js')
  const doc = generateDerivedGeography({
    geographySeed: 1,
    prevailingWindDegrees: 45,
    width: 4,
    height: 4,
  })
  assert.strictEqual(doc.gridWidth, 4)
  assert.strictEqual(doc.biomes.length, 16)
  assert.strictEqual(doc.pipelineStage, 'derivedGeography')
  assert.ok(doc.generationReport)
})
