import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from './biomeIds.js'
import { classifyBiomeFromSample } from './classifyBiomesFromFields.js'

const cases = [
  {
    name: 'ocean below sea level',
    sample: { elevation: 0.2, temperature: 0.5, rainfall: 0.5, drainage: 0.5, salidity: 1 },
    expected: BIOMES.OCEAN,
  },
  {
    name: 'coast with high salidity',
    sample: { elevation: 0.45, temperature: 0.5, rainfall: 0.5, drainage: 0.5, salidity: 0.6 },
    expected: BIOMES.COAST,
  },
  {
    name: 'swamp wet low drainage',
    sample: { elevation: 0.5, temperature: 0.5, rainfall: 0.75, drainage: 0.2, salidity: 0.1 },
    expected: BIOMES.SWAMP,
  },
  {
    name: 'desert dry interior',
    sample: { elevation: 0.5, temperature: 0.55, rainfall: 0.1, drainage: 0.5, salidity: 0.05 },
    expected: BIOMES.DESERT,
  },
  {
    name: 'glacier cold high peak',
    sample: { elevation: 0.9, temperature: 0.15, rainfall: 0.4, drainage: 0.5, salidity: 0 },
    expected: BIOMES.GLACIER,
  },
  {
    name: 'mountain high warm',
    sample: { elevation: 0.85, temperature: 0.45, rainfall: 0.4, drainage: 0.5, salidity: 0 },
    expected: BIOMES.MOUNTAIN,
  },
]

for (const row of cases) {
  test(`classifyBiomeFromSample: ${row.name}`, () => {
    assert.strictEqual(classifyBiomeFromSample(row.sample), row.expected)
  })
}
