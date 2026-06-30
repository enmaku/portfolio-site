import { sampleValueNoise2d } from './valueNoise2d.js'

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
        value += sampleValueNoise2d(x * freq, y * freq, seed + o * 1013) * amplitude
        freq *= lacunarity
        amplitude *= persistence
      }
      out[y * width + x] = value / maxAmplitude
    }
  }

  return out
}
