import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../../../biomeIds.js'
import { beginColonizationCommit } from '../../beginColonizationCommit.js'
import {
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
} from '../../createDefaultColonizationSlice.js'
import { runColonizationEpochStep } from '../../runColonizationEpochStep.js'
import { HISTORY_KIND_ALLIANCE } from '../historyKinds.js'
import { resetConflictTuning } from '../conflict/conflictTuning.js'
import { resetSoftPowerTuning } from '../softPower/softPowerTuning.js'
import { resetPoliticalPressureTuning } from './politicalPressureTuning.js'

function makeDoc(seed, width = 22, height = 22) {
  const n = width * height
  const arable = new Float32Array(n)
  const elev = new Float32Array(n)
  const lake = new Uint8Array(n)
  const river = new Uint8Array(n)
  let s = seed >>> 0
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
  for (let i = 0; i < n; i += 1) {
    const x = i % width
    const y = (i / width) | 0
    elev[i] =
      0.52 + 0.07 * Math.sin((x + seed) * 0.19) * Math.cos((y + seed) * 0.17) + 0.04 * rand()
    arable[i] = 1.7 + 1.1 * rand()
    if (x === ((7 + (seed % 5)) % width) || y === ((11 + (seed % 7)) % height)) river[i] = 1
  }
  return {
    geographySeed: seed,
    gridWidth: width,
    gridHeight: height,
    arableRaster: arable,
    timberRaster: new Float32Array(n).fill(1.8),
    movementCost: new Float32Array(n).fill(1),
    fields: {
      elevation: elev,
      temperature: new Float32Array(n).fill(0.55),
      rainfall: new Float32Array(n).fill(0.7),
      drainage: new Float32Array(n).fill(0.3),
      salinity: new Float32Array(n).fill(0.08),
    },
    biomes: new Uint8Array(n).fill(BIOMES.GRASSLAND),
    lakeMask: lake,
    riverCorridorMask: river,
    saltNodes: [],
    metalNodes: [],
    coastalNodes: [],
  }
}

/**
 * Live UI epoch path: political pressure must produce alliances on healthy maps.
 */
test('live epoch path: healthy seeds produce alliances by epoch 16', async () => {
  resetConflictTuning()
  resetSoftPowerTuning()
  resetPoliticalPressureTuning()
  const seeds = [42, 77, 111, 777, 999, 1337]
  let healthy = 0
  let withAlliance = 0

  for (const seed of seeds) {
    const world = makeDoc(seed)
    let slice = createDefaultColonizationSlice()
    slice.colonizationPhase = COLONIZATION_PHASE_SETUP
    slice.foundingLanding = { x: 5, y: 5 }
    slice.colonistSettings.threeDayHaulDistance = 8
    slice.colonistSettings.startingPopulation = 180
    slice = await beginColonizationCommit(slice, world)
    const hist0 = (slice.historyLog ?? []).length

    for (let i = 0; i < 16; i += 1) {
      const { slice: next } = await runColonizationEpochStep(slice, world)
      slice = next
    }
    const alliances = (slice.historyLog ?? [])
      .slice(hist0)
      .filter((e) => e.kind === HISTORY_KIND_ALLIANCE).length
    const living = (slice.settlements ?? []).filter((s) => s.status === 'living').length
    if (living < 6) continue
    healthy += 1
    if (alliances > 0) withAlliance += 1
  }

  assert.ok(healthy >= 4, `expected several healthy seeds, got ${healthy}`)
  assert.ok(
    withAlliance >= Math.ceil(healthy / 2),
    `alliance should fire on most healthy seeds (${withAlliance}/${healthy})`,
  )
})
