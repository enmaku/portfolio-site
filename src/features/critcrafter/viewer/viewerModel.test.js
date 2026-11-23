import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { visibleTabs, TABS, resolveSheetFunctionUrl, hasSpells } from './viewerModel.js'
import { minimalSheet } from '../test/minimalSheet.js'

const fixtures = new URL('../fixtures/', import.meta.url)
const load = (f) => JSON.parse(readFileSync(new URL(f, fixtures), 'utf8'))

test('the five tabs are Stats, Skills, Gear, Spells, Actions in order', () => {
  assert.deepEqual(
    TABS.map((t) => t.key),
    ['stats', 'skills', 'gear', 'spells', 'actions'],
  )
})

test('Spells is hidden when the sheet has no casters, focus or rituals', () => {
  const sheet = minimalSheet()
  assert.equal(hasSpells(sheet), false)
  assert.deepEqual(
    visibleTabs(sheet).map((t) => t.key),
    ['stats', 'skills', 'gear', 'actions'],
  )
})

test('Spells shows for casters, focus or rituals alone', () => {
  const caster = minimalSheet()
  caster.spells.casters = [{ key: 'x' }]
  const focus = minimalSheet()
  focus.spells.focus = { key: 'x' }
  const ritual = minimalSheet()
  ritual.spells.rituals = [{ key: 'x' }]
  for (const s of [caster, focus, ritual]) assert.equal(hasSpells(s), true)
  assert.equal(visibleTabs(caster).length, 5)
})

test('every committed sheet fixture yields a tab list that starts with Stats', () => {
  const files = readdirSync(fixtures).filter((f) => f.endsWith('.sheet.json'))
  assert.ok(files.length > 0)
  for (const f of files) {
    const tabs = visibleTabs(load(f))
    assert.equal(tabs[0].key, 'stats', f)
    assert.ok(tabs.length === 4 || tabs.length === 5, f)
  }
})

test('function URL: explicit base (emulator) wins and gets the function name appended', () => {
  assert.equal(
    resolveSheetFunctionUrl({ base: 'http://127.0.0.1:5001/p/us-central1/', projectId: 'p' }),
    'http://127.0.0.1:5001/p/us-central1/critcrafterSheet',
  )
})

test('function URL: falls back to the project cloudfunctions.net host, else empty', () => {
  assert.equal(
    resolveSheetFunctionUrl({ projectId: ' my-proj ' }),
    'https://us-central1-my-proj.cloudfunctions.net/critcrafterSheet',
  )
  assert.equal(resolveSheetFunctionUrl({}), '')
})
