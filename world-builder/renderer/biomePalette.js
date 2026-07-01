import { BIOMES } from '../core/biomeIds.js'

/** @type {ReadonlyArray<[number, number, number, number]>} RGBA tuples per biome id */
export const BIOMES_PALETTE = [
  [16, 32, 96, 255],
  [72, 120, 168, 255],
  [120, 176, 72, 255],
  [168, 152, 64, 255],
  [48, 112, 48, 255],
  [24, 88, 32, 255],
  [64, 96, 72, 255],
  [160, 168, 152, 255],
  [208, 184, 120, 255],
  [152, 136, 88, 255],
  [48, 88, 56, 255],
  [104, 112, 72, 255],
  [120, 112, 104, 255],
  [224, 232, 240, 255],
  [56, 128, 176, 255],
  [32, 148, 255, 255],
]

/** @param {number} biomeId */
export function biomeColorForId(biomeId) {
  const color = BIOMES_PALETTE[biomeId] ?? BIOMES_PALETTE[BIOMES.GRASSLAND]
  return color
}
