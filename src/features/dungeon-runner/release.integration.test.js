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

test('dungeon runner page uses default-hidden full-screen history drawer', () => {
  const page = readFileSync(new URL('../../pages/projects/DungeonRunnerPage.vue', import.meta.url), 'utf8')
  assert.equal(page.includes('const historyDrawerOpen = ref(false)'), true)
  assert.equal(page.includes('aria-label="Open match history"'), true)
  assert.equal(page.includes('<q-dialog v-model="historyDrawerOpen" position="bottom" maximized>'), true)
  assert.equal(page.includes('aria-label="Close match history"'), true)
  assert.equal(page.includes('v-if="showHistory"'), false)
})
