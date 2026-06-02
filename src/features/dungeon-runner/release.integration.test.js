import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import routes from '../../router/routes.js'
import { getShareEntryForPath, PASTE_UNFURL_ROUTES } from '../../share-metadata.js'

test('dungeon runner route is integrated with share metadata contract', () => {
  const route = routes.find((entry) => entry.path === '/projects/dungeon-runner')
  assert.ok(route)
  const page = route.children?.[0]
  assert.ok(page)
  assert.equal(page.meta, undefined)
  const catalogEntry = getShareEntryForPath('/projects/dungeon-runner')
  assert.ok(catalogEntry)
  assert.equal(catalogEntry.pasteUnfurl, true)
  assert.equal(PASTE_UNFURL_ROUTES.some((entry) => entry.routePath === '/projects/dungeon-runner'), true)
})

test('main layout project menu links to dungeon runner', () => {
  const mainLayout = readFileSync(new URL('../../layouts/MainLayout.vue', import.meta.url), 'utf8')
  assert.equal(mainLayout.includes("'/projects/dungeon-runner'"), true)
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

test('release checklist documents TF.js sync and release smoke', () => {
  const checklist = readFileSync(new URL('./RELEASE_CHECKLIST.md', import.meta.url), 'utf8')
  assert.equal(checklist.includes('TF.js model sync'), true)
  assert.equal(checklist.includes('release smoke'), true)
  assert.equal(checklist.includes('MODEL_RELEASE.md'), true)
})

test('MODEL_RELEASE.md documents sync commands semver vs latest and release smoke', () => {
  const doc = readFileSync(new URL('../../../scripts/MODEL_RELEASE.md', import.meta.url), 'utf8')
  assert.equal(doc.includes('sync-dungeon-runner-model'), true)
  assert.equal(doc.includes('web deployed latest'), true)
  assert.equal(doc.includes('Release smoke'), true)
})

test('dungeon runner CONTEXT links TF.js model sync to MODEL_RELEASE.md', () => {
  const context = readFileSync(new URL('./CONTEXT.md', import.meta.url), 'utf8')
  assert.equal(context.includes('TF.js model sync'), true)
  assert.equal(context.includes('scripts/MODEL_RELEASE.md'), true)
  assert.equal(context.includes('web deployed latest'), true)
})

test('.env.example documents DUNGEON_RUNNER_ROOT for model sync and outcome derive parity', () => {
  const envExample = readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8')
  assert.equal(envExample.includes('DUNGEON_RUNNER_ROOT'), true)
  assert.equal(envExample.includes('sync-dungeon-runner-model'), true)
  assert.equal(envExample.includes('matchOutcomeDeriveParity'), true)
})

test('dungeon runner route record still imports layout and page modules', () => {
  const routesSource = readFileSync(new URL('../../router/routes.js', import.meta.url), 'utf8')
  const drIdx = routesSource.indexOf("path: '/projects/dungeon-runner'")
  assert.ok(drIdx >= 0)
  const window = routesSource.slice(drIdx, drIdx + 900)
  assert.equal(window.includes("import('layouts/projects/ProjectShellLayout.vue')"), true)
  assert.equal(window.includes("import('pages/projects/DungeonRunnerPage.vue')"), true)
})

test('dungeon runner contract documents lint and core test gate commands', () => {
  const contract = readFileSync(new URL('./CONTRACT.md', import.meta.url), 'utf8')
  assert.equal(contract.includes('npm run lint'), true)
  assert.equal(contract.includes('node --test'), true)
})
