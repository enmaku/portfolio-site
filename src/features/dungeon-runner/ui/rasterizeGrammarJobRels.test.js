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

test('SVG master generate and raster jobs do not reference per-equipment-id paths', () => {
  const scriptsDir = path.resolve(import.meta.dirname, '../../../../scripts')
  const rasterSrc = readFileSync(path.join(scriptsDir, 'rasterize-dungeon-runner-masters.mjs'), 'utf8')
  const genSrc = readFileSync(path.join(scriptsDir, 'generate-dungeon-runner-master-svgs.mjs'), 'utf8')
  const perEquipmentMaster = /equipment\/[BMRW]_[A-Z0-9_]+\.svg/i
  assert.equal(perEquipmentMaster.test(rasterSrc), false)
  assert.equal(perEquipmentMaster.test(genSrc), false)
})
