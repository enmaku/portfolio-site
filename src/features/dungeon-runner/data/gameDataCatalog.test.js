import assert from 'node:assert/strict'
import { access, constants } from 'node:fs/promises'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { EQUIPMENT_IDS, getMonsterStrength, hpForEquip } from '../engine/kernel.js'
import { equipmentTokenAppearance } from '../equipmentTokenAppearance.js'
import {
  adventurers,
  catalogRules,
  defaultLoadout,
  equipment,
  equipmentShortName,
  getDefaultLoadout,
  getEquipmentLabel,
  getEquipmentShortName,
  getMonsterByStrength,
  getAdventurerIdentity,
  monsterDeck,
  monsters,
  policySpeciesOrder,
  sacrificeActionLabel,
} from './gameDataCatalog.js'

const EXPECTED_POLICY_SPECIES_ORDER = [
  'goblin',
  'skeleton',
  'orc',
  'vampire',
  'golem',
  'lich',
  'demon',
  'dragon',
]

const EXPECTED_MONSTER_DECK = [
  'goblin',
  'goblin',
  'skeleton',
  'skeleton',
  'orc',
  'orc',
  'vampire',
  'vampire',
  'golem',
  'golem',
  'lich',
  'demon',
  'dragon',
]

const INTERACTIVE_EQUIPMENT = [
  ['B_AXE', 'USE_FIRE_AXE', 'DECLINE_FIRE_AXE'],
  ['M_POLY', 'USE_POLYMORPH', 'DECLINE_POLYMORPH'],
]

test('equipment catalog keys are unique', () => {
  const keys = Object.keys(equipment)
  assert.equal(new Set(keys).size, keys.length)
})

test('monster catalog keys are unique', () => {
  const keys = Object.keys(monsters)
  assert.equal(new Set(keys).size, keys.length)
})

test('adventurer catalog keys are unique', () => {
  const keys = Object.keys(adventurers)
  assert.equal(new Set(keys).size, keys.length)
})

test('every hero loadout equipment id exists in the equipment catalog', () => {
  const equipmentIds = new Set(Object.keys(equipment))
  for (const entry of Object.values(adventurers)) {
    for (const equipmentId of entry.rules.heroLoadout) {
      assert.ok(equipmentIds.has(equipmentId), `missing equipment ${equipmentId}`)
    }
  }
})

test('every monster deck species has a monster catalog row', () => {
  const speciesInCatalog = new Set(Object.keys(monsters))
  for (const species of monsterDeck) {
    assert.ok(speciesInCatalog.has(species), `missing monster row for ${species}`)
  }
})

test('policy species order lists each catalog monster exactly once', () => {
  const catalogSpecies = Object.keys(monsters)
  assert.equal(policySpeciesOrder.length, catalogSpecies.length)
  assert.deepEqual([...policySpeciesOrder].sort(), [...catalogSpecies].sort())
  assert.equal(new Set(policySpeciesOrder).size, policySpeciesOrder.length)
})

test('policy species order matches neural encoding order', () => {
  assert.deepEqual([...policySpeciesOrder], EXPECTED_POLICY_SPECIES_ORDER)
  assert.equal(catalogRules.policySpeciesOrder, policySpeciesOrder)
})

test('monster deck composition matches standard dungeon deck', () => {
  assert.deepEqual([...monsterDeck], EXPECTED_MONSTER_DECK)
  assert.equal(catalogRules.monsterDeck, monsterDeck)
})

test('equipment HP contributions in catalog rules are non-negative', () => {
  for (const hp of Object.values(catalogRules.equipmentHp)) {
    assert.ok(hp >= 0)
  }
})

test('catalog rules projection is frozen and aligned with top-level exports', () => {
  assert.ok(Object.isFrozen(catalogRules))
  assert.ok(Object.isFrozen(catalogRules.equipmentHp))
  assert.ok(Object.isFrozen(catalogRules.equipmentIds))
  assert.ok(Object.isFrozen(catalogRules.monsterStats))
  assert.ok(Object.isFrozen(catalogRules.adventurerLoadouts))
  assert.ok(Object.isFrozen(catalogRules.baseAdventurerHp))
  assert.ok(Object.isFrozen(catalogRules.adventurerIds))
  assert.deepEqual(
    [...catalogRules.equipmentIds],
    [...Object.keys(equipment)].sort(),
  )
  assert.equal(catalogRules.defaultLoadout, defaultLoadout)
})

test('catalog rules equipment HP matches kernel hpForEquip', () => {
  assert.deepEqual([...EQUIPMENT_IDS], [...catalogRules.equipmentIds])
  for (const equipmentId of catalogRules.equipmentIds) {
    assert.equal(catalogRules.equipmentHp[equipmentId], hpForEquip(equipmentId))
    assert.equal(equipment[equipmentId].rules.hp, hpForEquip(equipmentId))
  }
})

test('catalog rules monster stats match kernel getMonsterStrength', () => {
  for (const species of Object.keys(monsters)) {
    const rules = catalogRules.monsterStats[species]
    assert.equal(rules.strength, getMonsterStrength(species))
    assert.equal(rules.strength, monsters[species].rules.strength)
    assert.deepEqual(rules.icons, monsters[species].ui.neutralizationIconKeys)
    assert.ok(Object.isFrozen(rules))
    assert.ok(Object.isFrozen(rules.icons))
  }
})

test('monster strengths are unique per species', () => {
  const strengths = Object.values(monsters).map((entry) => entry.rules.strength)
  assert.equal(new Set(strengths).size, strengths.length)
})

test('monsters have strength and neutralization icon keys in ui', () => {
  for (const entry of Object.values(monsters)) {
    assert.equal(typeof entry.rules.strength, 'number')
    assert.ok(Array.isArray(entry.ui.neutralizationIconKeys))
    assert.ok(entry.ui.neutralizationIconKeys.length > 0)
    assert.ok(Object.isFrozen(entry.ui.neutralizationIconKeys))
  }
})

test('interactive equipment rows expose use and decline action types', () => {
  for (const [equipmentId, useActionType, declineActionType] of INTERACTIVE_EQUIPMENT) {
    const rules = equipment[equipmentId].rules
    assert.equal(rules.useActionType, useActionType)
    assert.equal(rules.declineActionType, declineActionType)
  }
})

test('every equipment row has a symbol key matching token appearance', () => {
  for (const equipmentId of Object.keys(equipment)) {
    const symbolKey = equipment[equipmentId].ui.symbolKey
    assert.equal(typeof symbolKey, 'string')
    assert.ok(symbolKey.length > 0)
    const appearance = equipmentTokenAppearance(equipmentId)
    assert.equal(appearance.symbolKey, symbolKey)
  }
})

test('equipment short name accessors resolve catalog ui strings', () => {
  for (const equipmentId of Object.keys(equipment)) {
    assert.equal(getEquipmentShortName(equipmentId), equipment[equipmentId].ui.shortName)
    assert.equal(equipmentShortName(equipmentId), equipment[equipmentId].ui.shortName)
  }
})

test('sacrifice action label uses equipment short name', () => {
  assert.equal(sacrificeActionLabel('W_SHIELD'), 'Sacrifice Shield')
})

test('Warrior hero loadout equals default loadout', () => {
  assert.equal(adventurers.WARRIOR.rules.heroLoadout, defaultLoadout)
  assert.equal(catalogRules.adventurerLoadouts.WARRIOR, defaultLoadout)
  assert.equal(getDefaultLoadout(), defaultLoadout)
})

test('getAdventurerIdentity resolves catalog ui entries for each adventurer', () => {
  for (const adventurerId of catalogRules.adventurerIds) {
    assert.deepEqual(
      getAdventurerIdentity(adventurerId),
      adventurers[adventurerId].ui.adventurerIdentity,
    )
  }
})

test('getAdventurerIdentity maps each adventurer to cue tokens and compact badge glyph', () => {
  const mage = getAdventurerIdentity('MAGE')
  assert.equal(mage.hero, 'MAGE')
  assert.equal(mage.accentClass, 'dr-hero--mage')
  assert.equal(mage.badgeColor, 'deep-purple')
  assert.equal(mage.buttonColor, 'deep-purple')
  assert.equal(mage.badgeGlyph, 'M')
  assert.equal(mage.shortLabel, 'Mage')

  const warrior = getAdventurerIdentity('WARRIOR')
  assert.equal(warrior.buttonColor, warrior.badgeColor)
  assert.equal(warrior.badgeGlyph, 'W')
})

test('getAdventurerIdentity defaults unknown or missing adventurer to warrior', () => {
  assert.equal(getAdventurerIdentity(null).hero, 'WARRIOR')
  assert.equal(getAdventurerIdentity(undefined).hero, 'WARRIOR')
  assert.equal(getAdventurerIdentity('').hero, 'WARRIOR')
  assert.equal(getAdventurerIdentity('NOT_A_HERO').hero, 'WARRIOR')
})

test('catalog rules accessors resolve entries', () => {
  assert.equal(getEquipmentShortName('W_PLATE'), equipment.W_PLATE.ui.shortName)
  assert.equal(getEquipmentLabel('W_PLATE'), equipment.W_PLATE.ui.label)
  assert.equal(getMonsterByStrength(1)?.rules.strength, 1)
  assert.equal(getMonsterByStrength(1), monsters.goblin)
  assert.equal(getAdventurerIdentity('MAGE').hero, 'MAGE')
})

test('base adventurer HP values are positive integers', () => {
  for (const hp of Object.values(catalogRules.baseAdventurerHp)) {
    assert.ok(Number.isInteger(hp))
    assert.ok(hp > 0)
  }
})

const FEATURE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const REMOVED_PARALLEL_CATALOG_FILES = ['ui/equipmentDisplayCatalog.js', 'ui/heroIdentity.js']

const FORBIDDEN_PARALLEL_TABLE_MARKERS = [
  /\bexport const MONSTER_CARD_SPECS\b/,
  /\bconst EQUIPMENT_UI\b/,
  /\bconst HP_FOR_EQUIP\b/,
  /\bconst MONSTER_STATS\b/,
  /\bconst HERO_LOADOUTS\b/,
  /\bconst BASE_MONSTER_DECK\b/,
  /\bconst HERO_EQUIPMENT_SLOTS\b/,
  /\bconst MONSTER_SPECIES\b/,
]

const FORBIDDEN_HERO_IDENTITY_UI_MARKERS = [
  /\bgetHeroIdentity\b/,
  /from\s+['"].*\/heroIdentity\.js['"]/,
]

function listFeatureJsFiles(dir, acc = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name)
    if (name.isDirectory()) {
      if (name.name === 'data' || name.name === 'node_modules') continue
      listFeatureJsFiles(full, acc)
    } else if (name.name.endsWith('.js') && !name.name.endsWith('.test.js')) {
      acc.push(full)
    }
  }
  return acc
}

test('deleted legacy catalog modules are absent', async () => {
  for (const rel of REMOVED_PARALLEL_CATALOG_FILES) {
    await assert.rejects(access(path.join(FEATURE_ROOT, rel), constants.F_OK))
  }
})

test('thin UI helpers do not host parallel static tables', () => {
  const offenders = []
  for (const file of listFeatureJsFiles(FEATURE_ROOT)) {
    if (file.endsWith(`${path.sep}data${path.sep}gameDataCatalog.js`)) continue
    const src = readFileSync(file, 'utf8')
    for (const pattern of FORBIDDEN_PARALLEL_TABLE_MARKERS) {
      if (pattern.test(src)) {
        offenders.push(`${path.relative(FEATURE_ROOT, file)}: ${pattern}`)
      }
    }
  }
  assert.deepEqual(offenders, [])
})

test('UI modules resolve adventurer identity via catalog, not heroIdentity pass-through', () => {
  const offenders = []
  for (const file of listFeatureJsFiles(FEATURE_ROOT)) {
    const src = readFileSync(file, 'utf8')
    for (const pattern of FORBIDDEN_HERO_IDENTITY_UI_MARKERS) {
      if (pattern.test(src)) {
        offenders.push(`${path.relative(FEATURE_ROOT, file)}: ${pattern}`)
      }
    }
  }
  assert.deepEqual(offenders, [])
})
