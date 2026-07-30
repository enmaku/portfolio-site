import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../../../biomeIds.js'
import { applyColonizationEpoch } from '../../applyColonizationEpoch.js'
import { beginColonizationCommit } from '../../beginColonizationCommit.js'
import {
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
} from '../../createDefaultColonizationSlice.js'
import { HISTORY_KIND_TRADE_PARTNER_JOIN } from '../historyKinds.js'
import { resetConflictTuning } from '../conflict/conflictTuning.js'
import { resetSoftPowerTuning } from './softPowerTuning.js'

function makeDoc(seed, width = 28, height = 28) {
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
    if (Math.hypot(x - width * 0.55, y - height * 0.55) < 2.2) {
      elev[i] = 0.22
      lake[i] = 1
      arable[i] = 0.2
    }
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
    saltNodes: [{ x: (width / 4) | 0, y: (height / 4) | 0, richness: 1 }],
    metalNodes: [
      {
        x: ((width * 3) / 4) | 0,
        y: ((height * 3) / 4) | 0,
        metalKind: 'base',
        richness: 0.9,
      },
    ],
    coastalNodes: [],
  }
}

/**
 * Live applyColonizationEpoch path: soft power must produce trade partners on
 * healthy mid-size maps within a short horizon (regression for cooldown gating).
 */
test('live epoch path: healthy seeds produce trade partners by epoch 16', async () => {
  resetConflictTuning()
  resetSoftPowerTuning()
  const seeds = [42, 777, 4096, 1111, 1337, 2024]
  let healthy = 0
  let withJoin = 0
  let withPaintBy9 = 0

  for (const seed of seeds) {
    const world = makeDoc(seed)
    let slice = createDefaultColonizationSlice()
    slice.colonizationPhase = COLONIZATION_PHASE_SETUP
    slice.foundingLanding = { x: 6, y: 6 }
    slice.colonistSettings.threeDayHaulDistance = 8
    slice.colonistSettings.startingPopulation = 180
    slice = await beginColonizationCommit(slice, world)

    let joins = 0
    let paintedBy9 = false
    for (let i = 0; i < 16; i += 1) {
      const { slice: next, events } = await applyColonizationEpoch(slice, world)
      slice = next
      joins += events.filter((e) => e.kind === HISTORY_KIND_TRADE_PARTNER_JOIN).length
      if (
        slice.epoch <= 9 &&
        Object.keys(slice.softPowerPaintBySettlementId ?? {}).length > 0
      ) {
        paintedBy9 = true
      }
    }
    const living = (slice.settlements ?? []).filter((s) => s.status === 'living').length
    if (living < 8) continue
    healthy += 1
    if (joins > 0) withJoin += 1
    if (paintedBy9) withPaintBy9 += 1
  }

  assert.ok(healthy >= 4, `expected several healthy seeds, got ${healthy}`)
  assert.ok(
    withPaintBy9 >= Math.ceil(healthy / 2),
    `soft-power paint should appear by epoch 9 on most healthy seeds (${withPaintBy9}/${healthy})`,
  )
  assert.ok(
    withJoin >= 2,
    `trade_partner_join should fire on multiple healthy seeds by epoch 16 (${withJoin}/${healthy})`,
  )
})
