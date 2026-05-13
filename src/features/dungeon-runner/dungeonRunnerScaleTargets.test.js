import assert from 'node:assert/strict'
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
