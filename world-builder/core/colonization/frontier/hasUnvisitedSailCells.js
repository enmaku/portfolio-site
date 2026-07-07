/**
 * @param {Uint8Array | null | undefined} visitRaster
 * @param {Uint8Array | null | undefined} sailMask
 * @returns {boolean}
 */
export function hasUnvisitedSailCells(visitRaster, sailMask) {
  if (!visitRaster || !sailMask || visitRaster.length !== sailMask.length) {
    return false
  }

  for (let index = 0; index < sailMask.length; index += 1) {
    if (sailMask[index] === 1 && visitRaster[index] !== 1) {
      return true
    }
  }

  return false
}
