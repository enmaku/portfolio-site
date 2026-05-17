import {
  getMonsterCardSpec,
  getMonsterSpeciesByStrength,
  listMonsterCardSpecs,
} from '../data/gameDataCatalog.js'
import { dungeonRunnerAssetPack, DUNGEON_RUNNER_RUNTIME_BASE } from './assetPack.js'

/**
 * @param {number} strength
 * @returns {ReturnType<typeof getMonsterCardSpec>}
 */
export function monsterCardSpecByStrength(strength) {
  const species = getMonsterSpeciesByStrength(strength)
  return species ? getMonsterCardSpec(species) : null
}

/**
 * @param {string} species
 * @returns {ReturnType<typeof getMonsterCardSpec>}
 */
export function monsterCardSpecBySpecies(species) {
  return getMonsterCardSpec(species)
}

export { listMonsterCardSpecs }

/**
 * @param {string} species
 */
export function displayNameForSpecies(species) {
  if (!species) return ''
  return species.charAt(0).toUpperCase() + species.slice(1)
}

export function cardBlankUrl() {
  return `${DUNGEON_RUNNER_RUNTIME_BASE}/cards/card-blank.png`
}

export function monsterBackUrl() {
  return dungeonRunnerAssetPack.cards.monsterBack.runtimePath
}

/** Flat raster reference card; gameplay uses layered `MonsterCardFace` (blank + doodle + symbols). */
export function revealedMonsterTemplateUrl() {
  return dungeonRunnerAssetPack.cards.revealedMonster.runtimePath
}

export function monsterDoodleUrl(species) {
  return `${DUNGEON_RUNNER_RUNTIME_BASE}/cards/doodles/${species}.png`
}

export function symbolUrl(iconKey) {
  return `${DUNGEON_RUNNER_RUNTIME_BASE}/symbols/${iconKey}.png`
}
