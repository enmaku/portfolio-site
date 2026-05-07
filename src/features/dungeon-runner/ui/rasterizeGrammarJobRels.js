import { MONSTER_CARD_SPECS } from './monsterCardSpec.js'

/**
 * Master SVG rel paths (under public/assets/dungeon-runner/masters) for card-face
 * grammar raster jobs — kept in sync with MONSTER_CARD_SPECS.
 */
export function rasterizeCardGrammarMasterRels() {
  const doodleRels = MONSTER_CARD_SPECS.map((s) => `cards/doodles/${s.species}.svg`)
  const symbolKeys = [...new Set(MONSTER_CARD_SPECS.flatMap((s) => s.icons))]
  const symbolRels = symbolKeys.map((k) => `symbols/${k}.svg`)
  return { doodleRels, symbolRels }
}
