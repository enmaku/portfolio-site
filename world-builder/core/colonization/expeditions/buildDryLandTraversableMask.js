import { buildOceanMask } from './expeditionRouting.js'

/**
 * Dry land passability: not ocean, lakeMask, or riverCorridorMask.
 *
 * @param {import('../../types.js').WorldDocument} doc
 * @returns {Uint8Array}
 */
export function buildDryLandTraversableMask(doc) {
  const { gridWidth, gridHeight } = doc
  const cellCount = gridWidth * gridHeight
  const ocean = buildOceanMask(doc)
  const lakeMask = doc.lakeMask ?? new Uint8Array(cellCount)
  const riverCorridorMask = doc.riverCorridorMask ?? new Uint8Array(cellCount)
  const mask = new Uint8Array(cellCount)
  for (let i = 0; i < cellCount; i += 1) {
    if (ocean[i] !== true && lakeMask[i] !== 1 && riverCorridorMask[i] !== 1) {
      mask[i] = 1
    }
  }
  return mask
}
