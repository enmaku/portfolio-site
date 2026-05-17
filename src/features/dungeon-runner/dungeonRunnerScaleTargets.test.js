import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  DUNGEON_RUNNER_PLATE_SCALE_PX,
  DUNGEON_RUNNER_SYMBOL_SCALE_PX,
  dungeonRunnerNewEquipmentSymbolKeys,
  dungeonRunnerScaledSymbolNames,
  dungeonRunnerScaleTargets,
} from '../../../scripts/dungeon-runner-scale-targets.mjs'
import { EQUIPMENT_IDS } from './engine/kernel.js'
import { equipmentTokenAppearance } from './equipmentTokenAppearance.js'
import { listMonsterCardSpecs } from './ui/monsterCardSpec.js'

function targetByOut(out) {
  return dungeonRunnerScaleTargets.find((t) => t.out === out)
}

test('scale job includes token plate (256², kraft strip family)', () => {
  const t = targetByOut('equipment/plate.png')
  assert.ok(t)
  assert.equal(t.src, 'tokens/plate.png')
  assert.deepEqual(t.srcAlternates, ['equipment/plate.png'])
  assert.equal(t.width, DUNGEON_RUNNER_PLATE_SCALE_PX)
  assert.equal(t.height, DUNGEON_RUNNER_PLATE_SCALE_PX)
  assert.equal(t.strip, 'strip-neutral-card')
})

test('scale job includes new equipment symbol keys at 128² with symbol strip family', () => {
  for (const key of dungeonRunnerNewEquipmentSymbolKeys) {
    assert.ok(
      dungeonRunnerScaledSymbolNames.includes(key),
      `dungeonRunnerScaledSymbolNames missing ${key}`,
    )
    const t = targetByOut(`symbols/${key}.png`)
    assert.ok(t, `missing scale target symbols/${key}.png`)
    assert.equal(t.src, `symbols/${key}.png`)
    assert.equal(t.width, DUNGEON_RUNNER_SYMBOL_SCALE_PX)
    assert.equal(t.height, DUNGEON_RUNNER_SYMBOL_SCALE_PX)
    assert.equal(t.strip, 'strip-neutral-light')
  }
})

test('card blank and plate both use strip-neutral-card', () => {
  assert.equal(targetByOut('cards/card-blank.png').strip, 'strip-neutral-card')
  assert.equal(targetByOut('equipment/plate.png').strip, 'strip-neutral-card')
})

test('every equipment token symbol key is listed for hires scaling', () => {
  const keys = new Set(EQUIPMENT_IDS.map((id) => equipmentTokenAppearance(id).symbolKey))
  for (const key of keys) {
    assert.ok(
      dungeonRunnerScaledSymbolNames.includes(key),
      `dungeonRunnerScaledSymbolNames missing ${key}`,
    )
  }
})

test('scale targets cover every monster card doodle species', () => {
  const monsterCardSpecs = listMonsterCardSpecs()
  for (const spec of monsterCardSpecs) {
    const out = `cards/doodles/${spec.species}.png`
    assert.ok(targetByOut(out), `missing scale target ${out}`)
  }
  const doodleJobs = dungeonRunnerScaleTargets.filter((t) => t.out.startsWith('cards/doodles/'))
  assert.equal(doodleJobs.length, monsterCardSpecs.length)
})

test('scale targets cover every defeat symbol used on monster cards', () => {
  const required = new Set(listMonsterCardSpecs().flatMap((s) => s.icons))
  for (const key of required) {
    assert.ok(targetByOut(`symbols/${key}.png`), `missing scale target symbols/${key}.png`)
  }
})

test('scale pipeline scripts do not reference per-equipment-id bitmap paths', () => {
  const scriptsDir = path.resolve(import.meta.dirname, '../../../scripts')
  const scaleSrc = readFileSync(path.join(scriptsDir, 'scale-dungeon-runner-assets.mjs'), 'utf8')
  const targetsSrc = readFileSync(path.join(scriptsDir, 'dungeon-runner-scale-targets.mjs'), 'utf8')
  const perEquipmentId = /equipment\/[BMRW]_[A-Z0-9_]+\.(svg|png)/i
  assert.equal(perEquipmentId.test(scaleSrc), false)
  assert.equal(perEquipmentId.test(targetsSrc), false)
})
