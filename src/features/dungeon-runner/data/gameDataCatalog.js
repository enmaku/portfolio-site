/** @typedef {'WARRIOR' | 'BARBARIAN' | 'MAGE' | 'ROGUE'} DungeonRunnerHero */

/**
 * @typedef {object} HeroIdentity
 * @property {DungeonRunnerHero} hero
 * @property {string} accentClass
 * @property {string} badgeColor
 * @property {string} buttonColor
 * @property {string} badgeGlyph
 * @property {string} shortLabel
 */

const WARRIOR_LOADOUT = Object.freeze([
  'W_PLATE',
  'W_SHIELD',
  'W_VORPAL',
  'W_TORCH',
  'W_HOLY',
  'W_SPEAR',
])

/** @type {Record<string, { rules: { hp: number; useActionType?: string; declineActionType?: string }; ui: { shortName: string; label: string; details: string; symbolKey: string } }>} */
const EQUIPMENT_ENTRIES = {
  W_PLATE: {
    rules: { hp: 5 },
    ui: {
      shortName: 'Plate Armor',
      label: 'Plate Armor',
      details: 'Passive: +5 starting HP for this dungeon run.',
      symbolKey: 'armor',
    },
  },
  W_SHIELD: {
    rules: { hp: 3 },
    ui: {
      shortName: 'Shield',
      label: 'Knight Shield',
      details: 'Passive: +3 starting HP for this dungeon run.',
      symbolKey: 'shield',
    },
  },
  W_VORPAL: {
    rules: { hp: 0 },
    ui: {
      shortName: 'Vorpal Sword',
      label: 'Vorpal Sword',
      details:
        'At dungeon start, name a species; the first revealed copy is auto-defeated, then this is spent.',
      symbolKey: 'vorpal',
    },
  },
  W_TORCH: {
    rules: { hp: 0 },
    ui: {
      shortName: 'Torch',
      label: 'Torch',
      details: 'Passive: auto-defeats monsters with strength 3 or less.',
      symbolKey: 'torch',
    },
  },
  W_HOLY: {
    rules: { hp: 0 },
    ui: {
      shortName: 'Holy Water',
      label: 'Holy Grail',
      details: 'Passive: auto-defeats monsters with even strength.',
      symbolKey: 'chalice',
    },
  },
  W_SPEAR: {
    rules: { hp: 0 },
    ui: {
      shortName: 'Spear',
      label: 'Dragon Spear',
      details: 'Passive: auto-defeats Dragon.',
      symbolKey: 'staff',
    },
  },
  B_HEAL: {
    rules: { hp: 0 },
    ui: {
      shortName: 'Heal',
      label: 'Healing Potion',
      details:
        'Single-use revive: when HP would drop to 0 or below, reset to base hero HP and continue; then spent.',
      symbolKey: 'potion',
    },
  },
  B_SHIELD: {
    rules: { hp: 3 },
    ui: {
      shortName: 'Shield',
      label: 'Leather Shield',
      details: 'Passive: +3 starting HP for this dungeon run.',
      symbolKey: 'shield',
    },
  },
  B_CHAIN: {
    rules: { hp: 4 },
    ui: {
      shortName: 'Chain Mail',
      label: 'Chain Mail',
      details: 'Passive: +4 starting HP for this dungeon run.',
      symbolKey: 'armor',
    },
  },
  B_AXE: {
    rules: {
      hp: 0,
      useActionType: 'USE_FIRE_AXE',
      declineActionType: 'DECLINE_FIRE_AXE',
    },
    ui: {
      shortName: 'Fire Axe',
      label: 'Fire Axe',
      details: 'Single-use: destroy one revealed monster, then continue the run.',
      symbolKey: 'axe',
    },
  },
  B_TORCH: {
    rules: { hp: 0 },
    ui: {
      shortName: 'Torch',
      label: 'Torch',
      details: 'Passive: auto-defeats monsters with strength 3 or less.',
      symbolKey: 'torch',
    },
  },
  B_HAMMER: {
    rules: { hp: 0 },
    ui: {
      shortName: 'Hammer',
      label: 'War Hammer',
      details: 'Passive: auto-defeats Golems.',
      symbolKey: 'hammer',
    },
  },
  M_WALL: {
    rules: { hp: 6 },
    ui: {
      shortName: 'Wall',
      label: 'Wall of Fire',
      details: 'Passive: +6 starting HP for this dungeon run.',
      symbolKey: 'armor',
    },
  },
  M_HOLY: {
    rules: { hp: 0 },
    ui: {
      shortName: 'Holy',
      label: 'Holy Grail',
      details: 'Passive: auto-defeats monsters with even strength.',
      symbolKey: 'chalice',
    },
  },
  M_OMNI: {
    rules: { hp: 0 },
    ui: {
      shortName: 'Omni',
      label: 'Omnipotence',
      details:
        'If you would die, you win instead when every species in the dungeon pile at run start is unique (bidding sacrifice discards do not count).',
      symbolKey: 'omni',
    },
  },
  M_BRACE: {
    rules: { hp: 3 },
    ui: {
      shortName: 'Brace',
      label: 'Bracelet of Protection',
      details: 'Passive: +3 starting HP for this dungeon run.',
      symbolKey: 'shield',
    },
  },
  M_POLY: {
    rules: {
      hp: 0,
      useActionType: 'USE_POLYMORPH',
      declineActionType: 'DECLINE_POLYMORPH',
    },
    ui: {
      shortName: 'Polymorph',
      label: 'Polymorph',
      details:
        'Single-use: replace the revealed monster with the next unrevealed dungeon card and resolve that one.',
      symbolKey: 'poly',
    },
  },
  M_PACT: {
    rules: { hp: 0 },
    ui: {
      shortName: 'Pact',
      label: 'Demonic Pact',
      details: 'Auto-defeats Demon and the next revealed monster, then is spent.',
      symbolKey: 'pact',
    },
  },
  R_ARMOR: {
    rules: { hp: 5 },
    ui: {
      shortName: 'Armor',
      label: 'Mithril Armor',
      details: 'Passive: +5 starting HP for this dungeon run.',
      symbolKey: 'armor',
    },
  },
  R_HEAL: {
    rules: { hp: 0 },
    ui: {
      shortName: 'Heal',
      label: 'Healing Potion',
      details:
        'Single-use revive: when HP would drop to 0 or below, reset to base hero HP and continue; then spent.',
      symbolKey: 'potion',
    },
  },
  R_RING: {
    rules: { hp: 0 },
    ui: {
      shortName: 'Ring',
      label: 'Ring of Power',
      details:
        'Passive: auto-defeat monsters with strength 2 or less and heal HP by their total strength.',
      symbolKey: 'ring',
    },
  },
  R_BUCK: {
    rules: { hp: 3 },
    ui: {
      shortName: 'Buckler',
      label: 'Buckler',
      details: 'Passive: +3 starting HP for this dungeon run.',
      symbolKey: 'shield',
    },
  },
  R_VORP: {
    rules: { hp: 0 },
    ui: {
      shortName: 'Vorpal',
      label: 'Vorpal Dagger',
      details:
        'At dungeon start, name a species; the first revealed copy is auto-defeated, then this is spent.',
      symbolKey: 'vorpal',
    },
  },
  R_CLOAK: {
    rules: { hp: 0 },
    ui: {
      shortName: 'Cloak',
      label: 'Invisibility Cloak',
      details: 'Passive: auto-defeats monsters with strength 6 or more.',
      symbolKey: 'cloak',
    },
  },
}

/** @type {Record<string, { rules: { strength: number }; ui: { neutralizationIconKeys: readonly string[] } }>} */
const MONSTER_ENTRIES = {
  goblin: { rules: { strength: 1 }, ui: { neutralizationIconKeys: Object.freeze(['torch']) } },
  skeleton: {
    rules: { strength: 2 },
    ui: { neutralizationIconKeys: Object.freeze(['torch', 'chalice']) },
  },
  orc: { rules: { strength: 3 }, ui: { neutralizationIconKeys: Object.freeze(['torch']) } },
  vampire: { rules: { strength: 4 }, ui: { neutralizationIconKeys: Object.freeze(['chalice']) } },
  golem: { rules: { strength: 5 }, ui: { neutralizationIconKeys: Object.freeze(['hammer']) } },
  lich: {
    rules: { strength: 6 },
    ui: { neutralizationIconKeys: Object.freeze(['chalice', 'cloak']) },
  },
  demon: {
    rules: { strength: 7 },
    ui: { neutralizationIconKeys: Object.freeze(['pact', 'cloak']) },
  },
  dragon: {
    rules: { strength: 9 },
    ui: { neutralizationIconKeys: Object.freeze(['staff', 'cloak']) },
  },
}

/** @type {Record<'WARRIOR' | 'BARBARIAN' | 'MAGE' | 'ROGUE', { rules: { heroLoadout: readonly string[]; baseAdventurerHp: number }; ui: { adventurerIdentity: HeroIdentity } }>} */
const ADVENTURER_ENTRIES = {
  WARRIOR: {
    rules: { heroLoadout: WARRIOR_LOADOUT, baseAdventurerHp: 3 },
    ui: {
      adventurerIdentity: {
        hero: 'WARRIOR',
        accentClass: 'dr-hero--warrior',
        badgeColor: 'indigo',
        buttonColor: 'indigo',
        badgeGlyph: 'W',
        shortLabel: 'Warrior',
      },
    },
  },
  BARBARIAN: {
    rules: {
      heroLoadout: Object.freeze(['B_HEAL', 'B_SHIELD', 'B_CHAIN', 'B_AXE', 'B_TORCH', 'B_HAMMER']),
      baseAdventurerHp: 4,
    },
    ui: {
      adventurerIdentity: {
        hero: 'BARBARIAN',
        accentClass: 'dr-hero--barbarian',
        badgeColor: 'deep-orange',
        buttonColor: 'deep-orange',
        badgeGlyph: 'B',
        shortLabel: 'Barbarian',
      },
    },
  },
  MAGE: {
    rules: {
      heroLoadout: Object.freeze(['M_WALL', 'M_HOLY', 'M_OMNI', 'M_BRACE', 'M_POLY', 'M_PACT']),
      baseAdventurerHp: 2,
    },
    ui: {
      adventurerIdentity: {
        hero: 'MAGE',
        accentClass: 'dr-hero--mage',
        badgeColor: 'deep-purple',
        buttonColor: 'deep-purple',
        badgeGlyph: 'M',
        shortLabel: 'Mage',
      },
    },
  },
  ROGUE: {
    rules: {
      heroLoadout: Object.freeze([
        'R_ARMOR',
        'R_HEAL',
        'R_RING',
        'R_BUCK',
        'R_VORP',
        'R_CLOAK',
      ]),
      baseAdventurerHp: 3,
    },
    ui: {
      adventurerIdentity: {
        hero: 'ROGUE',
        accentClass: 'dr-hero--rogue',
        badgeColor: 'green',
        buttonColor: 'green',
        badgeGlyph: 'R',
        shortLabel: 'Rogue',
      },
    },
  },
}

const MONSTER_DECK = Object.freeze([
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
])

const POLICY_SPECIES_ORDER = Object.freeze([
  'goblin',
  'skeleton',
  'orc',
  'vampire',
  'golem',
  'lich',
  'demon',
  'dragon',
])

function buildCatalogRules() {
  /** @type {Record<string, number>} */
  const equipmentHp = {}
  for (const [equipmentId, entry] of Object.entries(EQUIPMENT_ENTRIES)) {
    equipmentHp[equipmentId] = entry.rules.hp
  }

  /** @type {Record<string, { strength: number; icons: readonly string[] }>} */
  const monsterStats = {}
  for (const [species, entry] of Object.entries(MONSTER_ENTRIES)) {
    monsterStats[species] = Object.freeze({
      strength: entry.rules.strength,
      icons: entry.ui.neutralizationIconKeys,
    })
  }

  /** @type {Record<string, readonly string[]>} */
  const adventurerLoadouts = {}
  /** @type {Record<string, number>} */
  const baseAdventurerHp = {}
  for (const [adventurerId, entry] of Object.entries(ADVENTURER_ENTRIES)) {
    adventurerLoadouts[adventurerId] = entry.rules.heroLoadout
    baseAdventurerHp[adventurerId] = entry.rules.baseAdventurerHp
  }

  return Object.freeze({
    equipmentHp: Object.freeze(equipmentHp),
    equipmentIds: Object.freeze([...Object.keys(EQUIPMENT_ENTRIES)].sort()),
    monsterStats: Object.freeze(monsterStats),
    adventurerLoadouts: Object.freeze(adventurerLoadouts),
    baseAdventurerHp: Object.freeze(baseAdventurerHp),
    monsterDeck: MONSTER_DECK,
    policySpeciesOrder: POLICY_SPECIES_ORDER,
    adventurerIds: Object.freeze(['WARRIOR', 'BARBARIAN', 'MAGE', 'ROGUE']),
    defaultLoadout: WARRIOR_LOADOUT,
  })
}

export const equipment = Object.freeze(EQUIPMENT_ENTRIES)
export const monsters = Object.freeze(MONSTER_ENTRIES)
export const adventurers = Object.freeze(ADVENTURER_ENTRIES)
export const monsterDeck = MONSTER_DECK
export const policySpeciesOrder = POLICY_SPECIES_ORDER
export const defaultLoadout = WARRIOR_LOADOUT
export const catalogRules = Object.freeze(buildCatalogRules())

/**
 * @param {string} equipmentId
 * @returns {string | undefined}
 */
export function getEquipmentShortName(equipmentId) {
  return equipment[equipmentId]?.ui.shortName ?? equipmentId
}

/** @param {string} equipmentId */
export function equipmentShortName(equipmentId) {
  return getEquipmentShortName(equipmentId)
}

/**
 * @param {string} equipmentId
 * @returns {string}
 */
export function sacrificeActionLabel(equipmentId) {
  return `Sacrifice ${getEquipmentShortName(equipmentId)}`
}

/**
 * @param {string} equipmentId
 * @returns {string | undefined}
 */
export function getEquipmentLabel(equipmentId) {
  return equipment[equipmentId]?.ui.label
}

/**
 * @param {number} strength
 * @returns {(typeof MONSTER_ENTRIES)[string] | undefined}
 */
export function getMonsterByStrength(strength) {
  if (!Number.isFinite(strength)) return undefined
  return Object.values(MONSTER_ENTRIES).find((entry) => entry.rules.strength === strength)
}

/**
 * @param {number} strength
 * @returns {string | undefined}
 */
export function getMonsterSpeciesByStrength(strength) {
  if (!Number.isFinite(strength)) return undefined
  for (const [species, entry] of Object.entries(MONSTER_ENTRIES)) {
    if (entry.rules.strength === strength) return species
  }
  return undefined
}

/**
 * @param {string} species
 * @returns {{ species: string; strength: number; icons: readonly string[] } | null}
 */
export function getMonsterCardSpec(species) {
  const entry = MONSTER_ENTRIES[species]
  if (!entry) return null
  return {
    species,
    strength: entry.rules.strength,
    icons: entry.ui.neutralizationIconKeys,
  }
}

/** @returns {readonly { species: string; strength: number; icons: readonly string[] }[]} */
export function listMonsterCardSpecs() {
  return Object.freeze(
    Object.keys(MONSTER_ENTRIES)
      .map((species) => getMonsterCardSpec(species))
      .filter((spec) => spec != null)
      .sort((a, b) => a.strength - b.strength),
  )
}

/**
 * @param {string} adventurerId
 * @returns {HeroIdentity}
 */
export function getAdventurerIdentity(adventurerId) {
  if (adventurerId === 'BARBARIAN' || adventurerId === 'MAGE' || adventurerId === 'ROGUE') {
    return adventurers[adventurerId].ui.adventurerIdentity
  }
  return adventurers.WARRIOR.ui.adventurerIdentity
}

/**
 * @param {string} adventurerId
 * @returns {string}
 */
export function getAdventurerTypeChipLabel(adventurerId) {
  const identity = getAdventurerIdentity(adventurerId)
  const baseHp = catalogRules.baseAdventurerHp[identity.hero]
  return `${identity.shortLabel} (${baseHp} HP)`
}

/** @returns {readonly string[]} */
export function getDefaultLoadout() {
  return defaultLoadout
}
