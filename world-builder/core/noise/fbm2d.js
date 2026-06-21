/**
 * Fractal Brownian motion on a 2D grid.
 * @param {Object} params
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.seed
 * @param {number} [params.octaves]
 * @param {number} [params.frequency]
 * @param {number} [params.lacunarity]
 * @param {number} [params.persistence]
 * @returns {Float32Array} values in [0, 1]
 */
export function generateFbm2d({
  width,
  height,
  seed,
  octaves = 5,
  frequency = 0.012,
  lacunarity = 2,
  persistence = 0.5,
}) {
  const out = new Float32Array(width * height)
  let maxAmplitude = 0
  let amplitude = 1

  for (let o = 0; o < octaves; o += 1) {
    maxAmplitude += amplitude
    amplitude *= persistence
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = 0
      amplitude = 1
      let freq = frequency
      for (let o = 0; o < octaves; o += 1) {
        value += hashNoise(x * freq, y * freq, seed + o * 1013) * amplitude
        freq *= lacunarity
        amplitude *= persistence
      }
      out[y * width + x] = value / maxAmplitude
    }
  }

  return out
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 */
function hashNoise(x, y, seed) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)

  const v00 = latticeValue(ix, iy, seed)
  const v10 = latticeValue(ix + 1, iy, seed)
  const v01 = latticeValue(ix, iy + 1, seed)
  const v11 = latticeValue(ix + 1, iy + 1, seed)

  const ix0 = v00 + (v10 - v00) * sx
  const ix1 = v01 + (v11 - v01) * sx
  return ix0 + (ix1 - ix0) * sy
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 */
function latticeValue(x, y, seed) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ seed
  n = Math.imul(n ^ (n >> 13), 1274126177)
  return ((n ^ (n >> 16)) & 0xffff) / 65535
}
