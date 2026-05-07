import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { MONSTER_CARD_SPECS } from './monsterCardSpec.js'
import { rasterizeCardGrammarMasterRels } from './rasterizeGrammarJobRels.js'

test('card grammar raster rels cover every MONSTER_CARD_SPECS species', () => {
  const { doodleRels } = rasterizeCardGrammarMasterRels()
  for (const spec of MONSTER_CARD_SPECS) {
    assert.ok(doodleRels.includes(`cards/doodles/${spec.species}.svg`), spec.species)
  }
  assert.equal(doodleRels.length, MONSTER_CARD_SPECS.length)
})

test('card grammar raster rels cover every defeat symbol key required by specs', () => {
  const { symbolRels } = rasterizeCardGrammarMasterRels()
  const required = new Set(MONSTER_CARD_SPECS.flatMap((s) => s.icons))
  for (const key of required) {
    assert.ok(symbolRels.includes(`symbols/${key}.svg`), key)
  }
  assert.equal(symbolRels.length, required.size)
})

test('rasterize-dungeon-runner-masters.mjs derives grammar jobs from rasterizeGrammarJobRels', () => {
  const rasterizePath = path.resolve(import.meta.dirname, '../../../../scripts/rasterize-dungeon-runner-masters.mjs')
  const src = readFileSync(rasterizePath, 'utf8')
  assert.match(src, /rasterizeCardGrammarMasterRels/)
  assert.match(src, /rasterizeGrammarJobRels\.js/)
})
