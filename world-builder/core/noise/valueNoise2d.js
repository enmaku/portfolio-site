/**
 * Deterministic smoothed value noise in [0, 1].
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 */
export function sampleValueNoise2d(x, y, seed) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)

  const v00 = latticeValue2d(ix, iy, seed)
  const v10 = latticeValue2d(ix + 1, iy, seed)
  const v01 = latticeValue2d(ix, iy + 1, seed)
  const v11 = latticeValue2d(ix + 1, iy + 1, seed)

  const ix0 = v00 + (v10 - v00) * sx
  const ix1 = v01 + (v11 - v01) * sx
  return ix0 + (ix1 - ix0) * sy
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 */
export function latticeValue2d(x, y, seed) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ seed
  n = Math.imul(n ^ (n >> 13), 1274126177)
  return ((n ^ (n >> 16)) & 0xffff) / 65535
}
