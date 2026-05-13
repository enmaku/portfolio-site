/**
 * Source of truth for `npm run scale-dungeon-runner-assets` (hires PNG → runtime).
 * Hires tree: `artifacts/dungeon-runner/hires-pre-scale/` (usually gitignored).
 *
 * Optional `srcAlternates`: first existing file wins, trying `src` then each alternate in order.
 */

/** @typedef {'strip-neutral-light' | 'strip-neutral-card' | 'strip-neutral-subtle'} DungeonRunnerStripMode */

/**
 * @typedef {{
 *   src: string
 *   srcAlternates?: ReadonlyArray<string>
 *   out: string
 *   width: number
 *   height: number
 *   strip: DungeonRunnerStripMode
 * }} DungeonRunnerScaleTarget
 */

/** Match `MonsterCardFace.vue` aspect-ratio `384 / 245` so `fit: contain` does not pillarbox in the PNG. */
const CARD_W = 480
const CARD_H = Math.round((CARD_W * 245) / 384)
const DOODLE_W = 400
const DOODLE_H = 224
export const DUNGEON_RUNNER_SYMBOL_SCALE_PX = 128
/** Token plate is shown small in UI; extra pixels preserve corrugated-edge detail after downscale. */
export const DUNGEON_RUNNER_PLATE_SCALE_PX = 256
const SEAT_ICON = 128
const TURN = 112
const BOARD_W = 800
const BOARD_H = 144

/** Equipment-token symbol keys introduced with #79 slice 03; each must appear in `dungeonRunnerScaledSymbolNames`. */
export const dungeonRunnerNewEquipmentSymbolKeys = [
  'armor',
  'shield',
  'potion',
  'vorpal',
  'ring',
  'axe',
  'poly',
  'omni',
]

/** Keys scaled as 128×128 symbols (`strip-neutral-light`, same family as torch/chalice/…). */
export const dungeonRunnerScaledSymbolNames = [
  'torch',
  'chalice',
  'hammer',
  'cloak',
  'pact',
  'staff',
  'armor',
  'shield',
  'potion',
  'vorpal',
  'ring',
  'axe',
  'poly',
  'omni',
]

/** @type {ReadonlyArray<DungeonRunnerScaleTarget>} */
export const dungeonRunnerScaleTargets = [
  ...dungeonRunnerScaledSymbolNames.map((name) => ({
    src: `symbols/${name}.png`,
    out: `symbols/${name}.png`,
    width: DUNGEON_RUNNER_SYMBOL_SCALE_PX,
    height: DUNGEON_RUNNER_SYMBOL_SCALE_PX,
    strip: /** @type {DungeonRunnerStripMode} */ ('strip-neutral-light'),
  })),
  {
    src: 'tokens/plate.png',
    srcAlternates: ['equipment/plate.png'],
    out: 'equipment/plate.png',
    width: DUNGEON_RUNNER_PLATE_SCALE_PX,
    height: DUNGEON_RUNNER_PLATE_SCALE_PX,
    strip: 'strip-neutral-card',
  },
  {
    src: 'cards/card-blank.png',
    out: 'cards/card-blank.png',
    width: CARD_W,
    height: CARD_H,
    strip: 'strip-neutral-card',
  },
  {
    src: 'cards/monster-back.png',
    out: 'cards/monster-back.png',
    width: CARD_W,
    height: CARD_H,
    strip: 'strip-neutral-card',
  },
  ...['goblin', 'skeleton', 'orc', 'vampire', 'golem', 'lich', 'demon', 'dragon'].map((species) => ({
    src: `cards/doodles/${species}.png`,
    out: `cards/doodles/${species}.png`,
    width: DOODLE_W,
    height: DOODLE_H,
    strip: /** @type {DungeonRunnerStripMode} */ ('strip-neutral-light'),
  })),
  { src: 'icons/runner.png', out: 'icons/runner.png', width: SEAT_ICON, height: SEAT_ICON, strip: 'strip-neutral-light' },
  { src: 'icons/monster.png', out: 'icons/monster.png', width: SEAT_ICON, height: SEAT_ICON, strip: 'strip-neutral-light' },
  { src: 'counters/turn.png', out: 'counters/turn.png', width: TURN, height: TURN, strip: 'strip-neutral-light' },
  { src: 'board/bidding-texture.png', out: 'board/bidding-texture.png', width: BOARD_W, height: BOARD_H, strip: 'strip-neutral-subtle' },
]
