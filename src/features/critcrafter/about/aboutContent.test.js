import test from 'node:test'
import assert from 'node:assert/strict'
import { ASSUMPTIONS, LICENCE_SECTIONS, aboutText } from './aboutContent.js'

test('about text lists every default-rules assumption from the spec', () => {
  const t = ASSUMPTIONS.join('\n').toLowerCase()
  for (const k of [
    'proficiency without level',
    'armor check penalty',
    'armor speed penalty',
    'strength requirement',
    'size adjustment',
    'circumstance or status',
    'untrained',
  ]) {
    assert.ok(t.includes(k), k)
  }
})

test('licence notice carries ORC, OGL 1.0a, Section 15, Paizo and Foundry attribution, no endorsement, counsel caveat', () => {
  const t = aboutText().toLowerCase()
  for (const k of ['orc license', 'open game license', 'version 1.0a', 'section 15', 'paizo', 'foundry', 'endorsed', 'counsel']) {
    assert.ok(t.includes(k), k)
  }
  assert.ok(LICENCE_SECTIONS.every((s) => s.title && s.body))
})
