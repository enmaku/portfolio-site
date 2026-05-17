import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { EQUIPMENT_IDS, hpForEquip } from './engine/kernel.js'
import { equipmentTokenAppearance } from './equipmentTokenAppearance.js'

/** @type {Record<string, { symbolKey: string; overlay: number | null }>} */
const EXPECTED = {
  B_AXE: { symbolKey: 'axe', overlay: null },
  B_CHAIN: { symbolKey: 'armor', overlay: 4 },
  B_HAMMER: { symbolKey: 'hammer', overlay: null },
  B_HEAL: { symbolKey: 'potion', overlay: null },
  B_SHIELD: { symbolKey: 'shield', overlay: 3 },
  B_TORCH: { symbolKey: 'torch', overlay: null },
  M_BRACE: { symbolKey: 'shield', overlay: 3 },
  M_HOLY: { symbolKey: 'chalice', overlay: null },
  M_OMNI: { symbolKey: 'omni', overlay: null },
  M_PACT: { symbolKey: 'pact', overlay: null },
  M_POLY: { symbolKey: 'poly', overlay: null },
  M_WALL: { symbolKey: 'armor', overlay: 6 },
  R_ARMOR: { symbolKey: 'armor', overlay: 5 },
  R_BUCK: { symbolKey: 'shield', overlay: 3 },
  R_CLOAK: { symbolKey: 'cloak', overlay: null },
  R_HEAL: { symbolKey: 'potion', overlay: null },
  R_RING: { symbolKey: 'ring', overlay: null },
  R_VORP: { symbolKey: 'vorpal', overlay: null },
  W_HOLY: { symbolKey: 'chalice', overlay: null },
  W_PLATE: { symbolKey: 'armor', overlay: 5 },
  W_SHIELD: { symbolKey: 'shield', overlay: 3 },
  W_SPEAR: { symbolKey: 'staff', overlay: null },
  W_TORCH: { symbolKey: 'torch', overlay: null },
  W_VORPAL: { symbolKey: 'vorpal', overlay: null },
}

test('every match-engine equipment id has defined token appearance', () => {
  const expectedIds = Object.keys(EXPECTED).sort()
  assert.deepEqual(expectedIds, [...EQUIPMENT_IDS])
  for (const id of EQUIPMENT_IDS) {
    assert.deepEqual(equipmentTokenAppearance(id), EXPECTED[id])
  }
})

test('unknown equipment id is rejected', () => {
  assert.throws(() => equipmentTokenAppearance('NOT_REAL'), /Unknown equipment/)
})

test('armor token overlays use engine max HP values', () => {
  const armorIds = ['B_CHAIN', 'M_WALL', 'R_ARMOR', 'W_PLATE']
  for (const id of armorIds) {
    assert.equal(equipmentTokenAppearance(id).overlay, hpForEquip(id))
  }
  assert.deepEqual(
    [...new Set(armorIds.map((id) => equipmentTokenAppearance(id).overlay))].sort(),
    [4, 5, 6],
  )
})

test('shield token overlays use engine max HP values', () => {
  const shieldIds = ['B_SHIELD', 'M_BRACE', 'R_BUCK', 'W_SHIELD']
  for (const id of shieldIds) {
    assert.equal(equipmentTokenAppearance(id).overlay, hpForEquip(id))
    assert.equal(equipmentTokenAppearance(id).symbolKey, 'shield')
  }
})

test('equipment token appearance has no UI or asset-pack dependency', () => {
  const source = readFileSync(new URL('./equipmentTokenAppearance.js', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /\bvue\b/i)
  assert.doesNotMatch(source, /\bquasar\b/i)
  assert.doesNotMatch(source, /\bassetPack\b/)
})
