import assert from 'node:assert/strict'
import test from 'node:test'
import { generateDerivedGeography } from './generateDerivedGeography.js'

function biomeHistogram(biomes) {
  const counts = new Map()
  for (let i = 0; i < biomes.length; i += 1) {
    counts.set(biomes[i], (counts.get(biomes[i]) ?? 0) + 1)
  }
  return counts
}

function histogramDistance(a, b) {
  const keys = new Set([...a.keys(), ...b.keys()])
  let distance = 0
  for (const key of keys) {
    distance += Math.abs((a.get(key) ?? 0) - (b.get(key) ?? 0))
  }
  return distance
}

test('rotating prevailing wind shifts rainfall, biomes, and rivers end to end', () => {
  const base = { geographySeed: 4242, width: 64, height: 64 }

  const westWind = generateDerivedGeography({ ...base, prevailingWindDegrees: 270 })
  const eastWind = generateDerivedGeography({ ...base, prevailingWindDegrees: 90 })

  let rainfallL1 = 0
  for (let i = 0; i < westWind.fields.rainfall.length; i += 1) {
    rainfallL1 += Math.abs(westWind.fields.rainfall[i] - eastWind.fields.rainfall[i])
  }
  assert.ok(rainfallL1 > 1, `expected wind to change rainfall (L1 ${rainfallL1})`)

  const biomeDistance = histogramDistance(
    biomeHistogram(westWind.biomes),
    biomeHistogram(eastWind.biomes),
  )
  assert.ok(biomeDistance > 0, 'expected wind to shift the biome histogram')

  let riverMaskDifferences = 0
  for (let i = 0; i < westWind.riverNetworkMask.length; i += 1) {
    if (westWind.riverNetworkMask[i] !== eastWind.riverNetworkMask[i]) {
      riverMaskDifferences += 1
    }
  }
  assert.ok(riverMaskDifferences > 0, 'expected wind to move the river network')
})
