import assert from 'node:assert/strict'
import test from 'node:test'
import { generateDerivedGeography } from './generateDerivedGeography.js'

test('rotating prevailing wind shifts rainfall end to end', () => {
  const base = { geographySeed: 4242, width: 64, height: 64 }

  const westWind = generateDerivedGeography({ ...base, prevailingWindDegrees: 270 })
  const eastWind = generateDerivedGeography({ ...base, prevailingWindDegrees: 90 })

  let rainfallL1 = 0
  for (let i = 0; i < westWind.fields.rainfall.length; i += 1) {
    rainfallL1 += Math.abs(westWind.fields.rainfall[i] - eastWind.fields.rainfall[i])
  }
  assert.ok(rainfallL1 > 1, `expected wind to change rainfall (L1 ${rainfallL1})`)
})

test('secondary maximum changes rainfall through the live derived geography path', () => {
  const base = {
    geographySeed: 4242,
    width: 48,
    height: 48,
    prevailingWindDegrees: 270,
  }
  const linked = generateDerivedGeography({
    ...base,
    secondaryMaximumDegrees: 0,
  })
  const opposite = generateDerivedGeography({
    ...base,
    secondaryMaximumDegrees: 90,
  })

  let rainfallL1 = 0
  for (let i = 0; i < linked.fields.rainfall.length; i += 1) {
    rainfallL1 += Math.abs(linked.fields.rainfall[i] - opposite.fields.rainfall[i])
  }
  assert.ok(rainfallL1 > 0.5, `expected secondary maximum to change rainfall (L1 ${rainfallL1})`)
})
