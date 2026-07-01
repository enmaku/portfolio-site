import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from './biomeIds.js'
import { classifyBiomeFromSample, classifyBiomesWithHydrology } from './classifyBiomesFromFields.js'

const cases = [
  {
    name: 'ocean below sea level',
    sample: { elevation: 0.2, temperature: 0.5, rainfall: 0.5, drainage: 0.5, salinity: 1 },
    expected: BIOMES.OCEAN,
  },
  {
    name: 'coast with high salinity',
    sample: { elevation: 0.45, temperature: 0.5, rainfall: 0.5, drainage: 0.5, salinity: 0.6 },
    expected: BIOMES.COAST,
  },
  {
    name: 'swamp wet low drainage',
    sample: { elevation: 0.5, temperature: 0.5, rainfall: 0.75, drainage: 0.2, salinity: 0.1 },
    expected: BIOMES.SWAMP,
  },
  {
    name: 'desert dry interior',
    sample: { elevation: 0.5, temperature: 0.55, rainfall: 0.1, drainage: 0.5, salinity: 0.05 },
    expected: BIOMES.DESERT,
  },
  {
    name: 'glacier cold high peak',
    sample: { elevation: 0.9, temperature: 0.15, rainfall: 0.4, drainage: 0.5, salinity: 0 },
    expected: BIOMES.GLACIER,
  },
  {
    name: 'mountain high warm',
    sample: { elevation: 0.85, temperature: 0.45, rainfall: 0.4, drainage: 0.5, salinity: 0 },
    expected: BIOMES.MOUNTAIN,
  },
]

for (const row of cases) {
  test(`classifyBiomeFromSample: ${row.name}`, () => {
    assert.strictEqual(classifyBiomeFromSample(row.sample), row.expected)
  })
}

test('classifyBiomesWithHydrology applies lake mask over land biomes', () => {
  const width = 4
  const height = 4
  const fields = {
    elevation: new Float32Array(16).fill(0.55),
    temperature: new Float32Array(16).fill(0.5),
    rainfall: new Float32Array(16).fill(0.5),
    drainage: new Float32Array(16).fill(0.5),
    salinity: new Float32Array(16).fill(0.1),
  }
  const lakeMask = new Uint8Array(16)
  lakeMask[5] = 1
  const riverCorridorMask = new Uint8Array(16)
  const flowDirection = new Int16Array(16).fill(-1)

  const biomes = classifyBiomesWithHydrology(fields, width, height, {
    lakeMask,
    riverCorridorMask,
    flowDirection,
  })

  assert.strictEqual(biomes[5], BIOMES.FRESHWATER_LAKE)
})

test('classifyBiomesWithHydrology paints river corridor cells from mask', () => {
  const width = 5
  const height = 5
  const fields = {
    elevation: new Float32Array(25).fill(0.55),
    temperature: new Float32Array(25).fill(0.5),
    rainfall: new Float32Array(25).fill(0.5),
    drainage: new Float32Array(25).fill(0.5),
    salinity: new Float32Array(25).fill(0.1),
  }
  const lakeMask = new Uint8Array(25)
  const riverCorridorMask = new Uint8Array(25)
  riverCorridorMask[12] = 1
  const flowDirection = new Int16Array(25).fill(-1)
  flowDirection[12] = 4

  const biomes = classifyBiomesWithHydrology(fields, width, height, {
    lakeMask,
    riverCorridorMask,
    flowDirection,
  })

  assert.strictEqual(biomes[12], BIOMES.RIVER_CORRIDOR)
})
