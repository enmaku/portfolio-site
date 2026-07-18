import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { applyColonizationEpoch } from './applyColonizationEpoch.js'
import { beginColonizationCommit } from './beginColonizationCommit.js'
import {
  COLONIZATION_PHASE_SETUP,
  MAX_PEOPLE_PER_HABITABLE_CELL,
  createDefaultColonizationSlice,
} from './createDefaultColonizationSlice.js'
import {
  MIN_SALT_SPOILAGE_MULTIPLIER,
  saltSpoilageMultiplier,
} from './saltSpoilageMultiplier.js'
import { resolveSurvivalTriad } from './resolveSurvivalTriad.js'
import { FRESHWATER_SURFACE } from './freshwater/deriveFreshwaterAvailability.js'

test('saltSpoilageMultiplier is minimal without salt on claimed cells', () => {
  assert.strictEqual(
    saltSpoilageMultiplier([{ x: 0, y: 0 }], [{ x: 5, y: 5, score: 1 }]),
    MIN_SALT_SPOILAGE_MULTIPLIER,
  )
})

test('saltSpoilageMultiplier rises with claimed salt access', () => {
  const poor = saltSpoilageMultiplier([{ x: 0, y: 0 }], [])
  const rich = saltSpoilageMultiplier([{ x: 0, y: 0 }], [{ x: 0, y: 0, score: 1 }])
  assert.ok(rich > poor)
  assert.ok(rich <= 1)
})

test('salt spoilage reduces effective surplus vs salt-rich control', () => {
  const base = {
    claimedCells: [{ x: 0, y: 0 }],
    gridWidth: 1,
    arableRaster: Float32Array.from([2]),
    timberRaster: Float32Array.from([2]),
    elevation: Float32Array.from([0.5]),
    lakeMask: new Uint8Array(1),
    riverCorridorMask: new Uint8Array(1),
    biomes: Uint8Array.from([BIOMES.GRASSLAND]),
    yieldModifier: 'typical',
    freshwaterClassification: Uint8Array.from([FRESHWATER_SURFACE]),
    population: 50,
    peoplePerHabitableCell: MAX_PEOPLE_PER_HABITABLE_CELL,
  }
  const poor = resolveSurvivalTriad({ ...base, saltSpoilageMultiplier: MIN_SALT_SPOILAGE_MULTIPLIER })
  const rich = resolveSurvivalTriad({ ...base, saltSpoilageMultiplier: 1 })
  assert.ok(poor.foodSurplus < rich.foodSurplus)
  assert.strictEqual(poor.populationCeiling, rich.populationCeiling)
})

function geographyWithSalt(saltNodes) {
  const cellCount = 16
  return {
    geographySeed: 9,
    gridWidth: 4,
    gridHeight: 4,
    arableRaster: new Float32Array(cellCount).fill(2),
    timberRaster: new Float32Array(cellCount).fill(2),
    saltNodes,
    fields: {
      elevation: new Float32Array(cellCount).fill(0.5),
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.6),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    lakeMask: new Uint8Array(cellCount),
    // Keep river off the founding pin so land packing still has dry claim cells.
    riverCorridorMask: Uint8Array.from({ length: cellCount }, (_, i) => (i === 15 ? 1 : 0)),
  }
}

test('salt-poor fixture grows slower than salt-rich control', async () => {
  const build = async (saltNodes) => {
    const slice = createDefaultColonizationSlice()
    slice.colonizationPhase = COLONIZATION_PHASE_SETUP
    slice.foundingLanding = { x: 1, y: 1 }
    slice.colonistSettings.startingPopulation = 40
    slice.colonistSettings.threeDayHaulDistance = 2
    // Keep land packing from binding so salt spoilage alone explains the growth gap.
    slice.colonistSettings.peoplePerHabitableCell = MAX_PEOPLE_PER_HABITABLE_CELL
    const doc = geographyWithSalt(saltNodes)
    let running = await beginColonizationCommit(slice, doc)
    for (let i = 0; i < 5; i += 1) {
      running = (await applyColonizationEpoch(running, doc)).slice
    }
    return running.settlements[0].population
  }

  const poorPop = await build([])
  const richPop = await build([{ id: 'salt-0', x: 1, y: 1, score: 1 }])
  assert.ok(richPop > poorPop)
})
