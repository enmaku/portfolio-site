/**
 * Card face data for UI — kept in sync with `MONSTER_STATS` in engine/kernel.js
 * and dungeon-runner `docs/welcome-to-the-dungeon.md` (monster table).
 */
export const MONSTER_CARD_SPECS = [
  { species: 'goblin', strength: 1, icons: ['torch'] },
  { species: 'skeleton', strength: 2, icons: ['torch', 'chalice'] },
  { species: 'orc', strength: 3, icons: ['torch'] },
  { species: 'vampire', strength: 4, icons: ['chalice'] },
  { species: 'golem', strength: 5, icons: ['hammer'] },
  { species: 'lich', strength: 6, icons: ['chalice', 'cloak'] },
  { species: 'demon', strength: 7, icons: ['pact', 'cloak'] },
  { species: 'dragon', strength: 9, icons: ['staff', 'cloak'] },
]

const byStrength = new Map(MONSTER_CARD_SPECS.map((s) => [s.strength, s]))

/**
 * @param {number} strength
 * @returns {typeof MONSTER_CARD_SPECS[0] | null}
 */
export function monsterCardSpecByStrength(strength) {
  if (!Number.isFinite(strength)) return null
  return byStrength.get(strength) ?? null
}

/**
 * @param {string} species
 */
export function displayNameForSpecies(species) {
  if (!species) return ''
  return species.charAt(0).toUpperCase() + species.slice(1)
}

export const RUNTIME_BASE = '/assets/dungeon-runner/runtime'

export function cardBlankUrl() {
  return `${RUNTIME_BASE}/cards/card-blank.png`
}

export function monsterBackUrl() {
  return `${RUNTIME_BASE}/cards/monster-back.png`
}

export function monsterDoodleUrl(species) {
  return `${RUNTIME_BASE}/cards/doodles/${species}.png`
}

export function symbolUrl(iconKey) {
  return `${RUNTIME_BASE}/symbols/${iconKey}.png`
}
