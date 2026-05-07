/** @typedef {'WARRIOR' | 'BARBARIAN' | 'MAGE' | 'ROGUE'} DungeonRunnerHero */

/**
 * @typedef {object} HeroIdentity
 * @property {DungeonRunnerHero} hero
 * @property {string} accentClass
 * @property {string} badgeColor
 * @property {string} buttonColor
 * @property {string} badgeGlyph single-letter mark inside circular hero badge
 * @property {string} shortLabel screen-reader / concise label (not raw enum)
 */

/** @type {Record<DungeonRunnerHero, HeroIdentity>} */
const TABLE = {
  WARRIOR: {
    hero: 'WARRIOR',
    accentClass: 'dr-hero--warrior',
    badgeColor: 'indigo',
    buttonColor: 'indigo',
    badgeGlyph: 'W',
    shortLabel: 'Warrior',
  },
  BARBARIAN: {
    hero: 'BARBARIAN',
    accentClass: 'dr-hero--barbarian',
    badgeColor: 'deep-orange',
    buttonColor: 'deep-orange',
    badgeGlyph: 'B',
    shortLabel: 'Barbarian',
  },
  MAGE: {
    hero: 'MAGE',
    accentClass: 'dr-hero--mage',
    badgeColor: 'deep-purple',
    buttonColor: 'deep-purple',
    badgeGlyph: 'M',
    shortLabel: 'Mage',
  },
  ROGUE: {
    hero: 'ROGUE',
    accentClass: 'dr-hero--rogue',
    badgeColor: 'teal',
    buttonColor: 'teal',
    badgeGlyph: 'R',
    shortLabel: 'Rogue',
  },
}

/**
 * @param {string | null | undefined} hero
 * @returns {HeroIdentity}
 */
export function getHeroIdentity(hero) {
  if (hero === 'BARBARIAN' || hero === 'MAGE' || hero === 'ROGUE') return TABLE[hero]
  return TABLE.WARRIOR
}
