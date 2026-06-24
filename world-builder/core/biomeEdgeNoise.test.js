import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from './biomeIds.js'
import { generateBiomeEdgeNoiseOffsets } from './biomeEdgeNoise.js'
import { classifyBiomesFromFields } from './classifyBiomesFromFields.js'

test('generateBiomeEdgeNoiseOffsets is deterministic for the same seed', () => {
  const first = generateBiomeEdgeNoiseOffsets(4242, 32, 32)
  const second = generateBiomeEdgeNoiseOffsets(4242, 32, 32)

  assert.deepStrictEqual(first.temperature, second.temperature)
  assert.deepStrictEqual(first.rainfall, second.rainfall)
})

test('generateBiomeEdgeNoiseOffsets differs across seeds', () => {
  const first = generateBiomeEdgeNoiseOffsets(1, 32, 32)
  const second = generateBiomeEdgeNoiseOffsets(2, 32, 32)

  let equalSamples = 0
  for (let i = 0; i < first.rainfall.length; i += 1) {
    if (first.rainfall[i] === second.rainfall[i]) equalSamples += 1
  }

  assert.ok(equalSamples < first.rainfall.length)
})

test('generateBiomeEdgeNoiseOffsets returns null at zero strength', () => {
  assert.strictEqual(generateBiomeEdgeNoiseOffsets(42, 16, 16, 0), null)
})

test('generateBiomeEdgeNoiseOffsets scales with strength', () => {
  const full = generateBiomeEdgeNoiseOffsets(7, 16, 16, 1)
  const half = generateBiomeEdgeNoiseOffsets(7, 16, 16, 0.5)

  assert.ok(Math.abs(full.rainfall[0]) > Math.abs(half.rainfall[0]))
})

test('generateBiomeEdgeNoiseOffsets stays within configured amplitude', () => {
  const offsets = generateBiomeEdgeNoiseOffsets(99, 48, 48)

  for (const value of offsets.rainfall) {
    assert.ok(value >= -0.055 && value <= 0.055)
  }
})

test('classifyBiomesFromFields roughens inland biome edges when geography seed is provided', () => {
  const width = 48
  const height = 48
  const cellCount = width * height
  const fields = {
    elevation: new Float32Array(cellCount).fill(0.55),
    temperature: new Float32Array(cellCount).fill(0.55),
    rainfall: new Float32Array(cellCount).fill(0.175),
    drainage: new Float32Array(cellCount).fill(0.5),
    salidity: new Float32Array(cellCount).fill(0.05),
  }

  const smooth = classifyBiomesFromFields(fields, width, height)
  const rough = classifyBiomesFromFields(fields, width, height, undefined, 1337, 1)

  let smoothTransitions = 0
  let roughTransitions = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const left = y * width + x
      const right = left + 1
      if (smooth[left] !== smooth[right]) smoothTransitions += 1
      if (rough[left] !== rough[right]) roughTransitions += 1
    }
  }

  assert.strictEqual(smoothTransitions, 0)
  assert.ok(roughTransitions > 0)
})

test('classifyBiomesFromFields leaves ocean and coast unchanged by edge noise', () => {
  const width = 24
  const height = 24
  const cellCount = width * height
  const fields = {
    elevation: new Float32Array(cellCount),
    temperature: new Float32Array(cellCount).fill(0.5),
    rainfall: new Float32Array(cellCount).fill(0.5),
    drainage: new Float32Array(cellCount).fill(0.5),
    salidity: new Float32Array(cellCount),
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x
      fields.elevation[i] = x < width / 2 ? 0.2 : 0.55
      fields.salidity[i] = x < width / 2 ? 1 : 0.05
    }
  }

  const withoutNoise = classifyBiomesFromFields(fields, width, height)
  const withNoise = classifyBiomesFromFields(fields, width, height, undefined, 9001, 1)

  for (let i = 0; i < cellCount; i += 1) {
    if (withoutNoise[i] === BIOMES.OCEAN || withoutNoise[i] === BIOMES.COAST) {
      assert.strictEqual(withNoise[i], withoutNoise[i])
    }
  }
})

test('zero biome edge noise strength matches unseeded classification', () => {
  const width = 16
  const height = 16
  const cellCount = width * height
  const fields = {
    elevation: new Float32Array(cellCount).fill(0.55),
    temperature: new Float32Array(cellCount).fill(0.5),
    rainfall: new Float32Array(cellCount).fill(0.5),
    drainage: new Float32Array(cellCount).fill(0.5),
    salidity: new Float32Array(cellCount).fill(0.05),
  }

  const baseline = classifyBiomesFromFields(fields, width, height)
  const disabled = classifyBiomesFromFields(fields, width, height, undefined, 1337, 0)

  assert.deepStrictEqual(disabled, baseline)
})
