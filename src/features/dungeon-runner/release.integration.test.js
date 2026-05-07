import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import routes from '../../router/routes.js'
import { SHARE_METADATA, SHAREABLE_ROUTES } from '../../share-metadata.js'

test('dungeon runner route is integrated with share metadata contract', () => {
  const route = routes.find((entry) => entry.path === '/projects/dungeon-runner')
  assert.ok(route)
  const page = route.children?.[0]
  assert.ok(page)
  assert.equal(page.meta?.title, SHARE_METADATA.dungeonRunner.title)
  assert.equal(page.meta?.shareKey, 'dungeonRunner')
  assert.equal(page.meta?.favicon, SHARE_METADATA.dungeonRunner.favicon)
  assert.equal(SHAREABLE_ROUTES.some((entry) => entry.routePath === '/projects/dungeon-runner'), true)
})

test('main layout project menu links to dungeon runner', () => {
  const mainLayout = readFileSync(new URL('../../layouts/MainLayout.vue', import.meta.url), 'utf8')
  assert.equal(mainLayout.includes("'/projects/dungeon-runner'"), true)
  assert.equal(mainLayout.includes('Dungeon Runner'), true)
})

test('release notes include known risks and out-of-scope sections', () => {
  const notes = readFileSync(new URL('./RELEASE_NOTES.md', import.meta.url), 'utf8')
  assert.equal(notes.includes('## Known Risks'), true)
  assert.equal(notes.includes('## Out-of-Scope Carryovers'), true)
})

test('release checklist includes manual debug replay smoke check', () => {
  const checklist = readFileSync(new URL('./RELEASE_CHECKLIST.md', import.meta.url), 'utf8')
  assert.equal(checklist.includes('manual debug/replay smoke checks'), true)
})

test('release checklist codifies npm test and lint gates', () => {
  const checklist = readFileSync(new URL('./RELEASE_CHECKLIST.md', import.meta.url), 'utf8')
  assert.equal(checklist.includes('`npm test`'), true)
  assert.equal(checklist.includes('`npm run lint`'), true)
})

test('dungeon runner page uses default-hidden full-screen history drawer', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('const historyDrawerOpen = ref(false)'), true)
  assert.equal(page.includes('aria-label="Open match history"'), true)
  assert.equal(page.includes('<q-dialog v-model="historyDrawerOpen" position="bottom" maximized>'), true)
  assert.equal(page.includes('aria-label="Close match history"'), true)
  assert.equal(page.includes('v-if="showHistory"'), false)
})

test('dungeon runner page exposes match presentation speed in settings menu', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('aria-label="Match settings"'), true)
  assert.equal(page.includes('<q-menu anchor="bottom right" self="top right"'), true)
  assert.equal(page.includes('presentationSpeedProfile'), true)
  assert.equal(page.includes('setSpeedProfile'), true)
  assert.equal(page.includes('presentationSpeedProfile: pace'), true)
  assert.equal(page.includes('z-index: 30'), true)
  assert.equal(page.includes('z-index: 20'), true)
})

test('dungeon runner page places memory aid toggle in match settings menu', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const menuIdx = page.indexOf('<q-menu anchor="bottom right" self="top right"')
  const toggleIdx = page.indexOf('aria-label="Toggle memory aid"')
  assert.ok(menuIdx >= 0 && toggleIdx > menuIdx, 'memory aid toggle should live inside settings menu')
})

test('dungeon runner route record still imports layout and page modules', () => {
  const routesSource = readFileSync(new URL('../../router/routes.js', import.meta.url), 'utf8')
  const drIdx = routesSource.indexOf("path: '/projects/dungeon-runner'")
  assert.ok(drIdx >= 0)
  const window = routesSource.slice(drIdx, drIdx + 900)
  assert.equal(window.includes("import('layouts/projects/DungeonRunnerLayout.vue')"), true)
  assert.equal(window.includes("import('pages/projects/DungeonRunnerPage.vue')"), true)
})

test('dungeon runner contract documents lint and core test gate commands', () => {
  const contract = readFileSync(new URL('./CONTRACT.md', import.meta.url), 'utf8')
  assert.equal(contract.includes('npm run lint'), true)
  assert.equal(contract.includes('node --test'), true)
})

test('dungeon runner page exposes settings menu section copy and pace options', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('Match presentation'), true)
  assert.equal(page.includes('Match recall'), true)
  assert.equal(page.includes("{ label: 'Cinematic', value: 'cinematic' }"), true)
  assert.equal(page.includes("{ label: 'Brisk', value: 'brisk' }"), true)
})

test('dungeon runner page syncs presentation speed ref into orchestrator', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  const watchIdx = page.indexOf('watch(presentationSpeedProfile')
  assert.ok(watchIdx >= 0)
  const watchBlock = page.slice(watchIdx, watchIdx + 450)
  assert.equal(watchBlock.includes('presentationOrchestrator.setSpeedProfile(next)'), true)
})
