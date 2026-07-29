/**
 * Conflict geopolitics parameter sweep.
 * Run: node world-builder/scripts/sweepConflictGeopolitics.mjs
 */
import { BIOMES } from '../core/biomeIds.js'
import { applyColonizationEpoch } from '../core/colonization/applyColonizationEpoch.js'
import { beginColonizationCommit } from '../core/colonization/beginColonizationCommit.js'
import {
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
} from '../core/colonization/createDefaultColonizationSlice.js'
import {
  resetConflictTuning,
  setConflictTuning,
} from '../core/colonization/politics/conflict/conflictTuning.js'

function makeDoc(seed, width, height) {
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
    const ridge = 0.08 * Math.sin((x + seed) * 0.21) * Math.cos((y + seed * 3) * 0.19)
    elev[i] = 0.52 + ridge + 0.05 * rand()
    arable[i] = 1.6 + 1.2 * rand()
    // Thin river corridor only — avoid drowning the map.
    if (x === ((8 + (seed % 7)) % width)) river[i] = 1
    if (y === height - 1 && x > width / 2) {
      elev[i] = 0.25
      lake[i] = 1
      arable[i] = 0.3
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

function living(slice) {
  return (slice.settlements ?? []).filter((s) => s.status === 'living')
}

function activeFactions(slice) {
  return (slice.factions ?? []).filter((f) => f.status === 'active')
}

function herfindahl(slice) {
  const pins = living(slice)
  if (pins.length === 0) return 0
  const counts = new Map()
  for (const s of pins) {
    const key = s.factionId ?? '__unaligned__'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let h = 0
  for (const c of counts.values()) {
    const share = c / pins.length
    h += share * share
  }
  return h
}

function topFactionShare(slice) {
  const pins = living(slice)
  if (pins.length === 0) return 0
  const counts = new Map()
  for (const s of pins) {
    if (!s.factionId) continue
    counts.set(s.factionId, (counts.get(s.factionId) ?? 0) + 1)
  }
  let max = 0
  for (const c of counts.values()) max = Math.max(max, c)
  return max / pins.length
}

/**
 * @param {{
 *   seed: number,
 *   epochs: number,
 *   haul: number,
 *   width?: number,
 *   height?: number,
 *   startingPopulation?: number,
 * }} opts
 */
async function runOne(opts) {
  const world = makeDoc(opts.seed, opts.width ?? 28, opts.height ?? 28)
  let slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 6, y: 6 }
  slice.colonistSettings.threeDayHaulDistance = opts.haul
  slice.colonistSettings.startingPopulation = opts.startingPopulation ?? 160
  slice = await beginColonizationCommit(slice, world)

  let wars = 0
  let attackerWins = 0
  let defenderWins = 0
  let epochsWithWar = 0
  let epochsWithConquest = 0
  let unalignedEver = 0
  let unalignedAbsorbed = 0
  /** @type {Map<string, string | null>} */
  const lastFaction = new Map()
  let ownershipFlips = 0
  let multiActorEpochs = 0

  /** @type {Set<string>} */
  const seenUnaligned = new Set()
  /** @type {Set<string>} */
  const absorbedUnaligned = new Set()

  for (let i = 0; i < opts.epochs; i += 1) {
    for (const s of living(slice)) {
      if (!s.factionId) {
        seenUnaligned.add(s.id)
        unalignedEver = seenUnaligned.size
      }
    }

    const actors =
      activeFactions(slice).length + living(slice).filter((s) => !s.factionId).length
    const beforeFaction = new Map(living(slice).map((s) => [s.id, s.factionId ?? null]))

    const { slice: next, events } = await applyColonizationEpoch(slice, world)
    slice = next

    if (actors >= 2) multiActorEpochs += 1

    const starts = events.filter((e) => e.kind === 'major_war_start')
    const ends = events.filter((e) => e.kind === 'major_war_end')
    if (starts.length) {
      wars += starts.length
      epochsWithWar += 1
    }
    let conqueredThisEpoch = 0
    for (const e of ends) {
      if (e.winner === 'attacker') {
        attackerWins += 1
        conqueredThisEpoch += 1
      } else if (e.fought) defenderWins += 1
    }
    if (conqueredThisEpoch > 0) epochsWithConquest += 1

    for (const s of living(slice)) {
      const prev = beforeFaction.get(s.id)
      const now = s.factionId ?? null
      if (prev === undefined) continue
      if (prev !== now) {
        ownershipFlips += 1
        if (prev == null && now != null && seenUnaligned.has(s.id)) {
          absorbedUnaligned.add(s.id)
        }
      }
      const prior = lastFaction.get(s.id)
      if (prior !== undefined && prior !== now) {
        // already counted via beforeFaction
      }
      lastFaction.set(s.id, now)
    }
  }

  unalignedAbsorbed = absorbedUnaligned.size
  const pins = living(slice)
  const factions = activeFactions(slice)
  const singletons = factions.filter((f) => (f.settlementIds ?? []).length <= 1).length
  const fought = attackerWins + defenderWins

  return {
    seed: opts.seed,
    haul: opts.haul,
    wars,
    attackerWins,
    defenderWins,
    winRate: fought > 0 ? attackerWins / fought : 0,
    warEpochRate: multiActorEpochs > 0 ? epochsWithWar / multiActorEpochs : 0,
    conquestEpochRate: multiActorEpochs > 0 ? epochsWithConquest / multiActorEpochs : 0,
    unalignedAbsorbRate: unalignedEver > 0 ? unalignedAbsorbed / unalignedEver : 1,
    finalFactions: factions.length,
    finalUnaligned: pins.filter((s) => !s.factionId).length,
    finalLiving: pins.length,
    singletons,
    topShare: topFactionShare(slice),
    herfindahl: herfindahl(slice),
    ownershipFlips,
    multiActorEpochs,
  }
}

function scoreMetrics(m) {
  if (!(m.multiActorEpochs > 0) || !(m.finalLiving > 2)) return -5
  const conquest = clamp01(m.conquestEpochRate)
  const win = clamp01(m.winRate)
  const war = clamp01(m.warEpochRate)
  const absorb = clamp01(m.unalignedAbsorbRate)
  // Prefer 2–6 final factions on these maps (consolidation without total monopoly)
  const factionBand =
    m.finalFactions >= 2 && m.finalFactions <= 6
      ? 1
      : m.finalFactions === 1
        ? 0.55
        : m.finalFactions < 2
          ? 0.2
          : Math.max(0, 1 - (m.finalFactions - 6) / 10)
  const consolidation = clamp01(m.topShare) * 0.55 + clamp01(m.herfindahl) * 0.45
  const churn = clamp01(m.ownershipFlips / Math.max(8, m.finalLiving))
  const singletonPenalty = clamp01(m.singletons / Math.max(1, m.finalFactions))

  return (
    conquest * 3.5 +
    win * 3.0 +
    war * 1.2 +
    absorb * 2.0 +
    factionBand * 1.8 +
    consolidation * 1.2 +
    churn * 1.2 -
    singletonPenalty * 0.8
  )
}

function clamp01(n) {
  return Math.max(0, Math.min(1, Number(n) || 0))
}

function mean(rows, key) {
  if (rows.length === 0) return 0
  return rows.reduce((a, r) => a + r[key], 0) / rows.length
}

/** @type {Array<Partial<import('../core/colonization/politics/conflict/conflictTuning.js').ConflictTuning> & { label: string }>} */
const CANDIDATES = [
  { label: 'baseline' },
  {
    label: 'edge-filter-2wars',
    warThreshold: 20,
    rivalBonus: 25,
    unalignedBonus: 40,
    preferWinnableStakes: true,
    requireAttackerEdge: true,
    attackerEdgeMargin: 1.02,
    maxConquestsPerEpoch: 2,
    defenderHamlet: 1.0,
    defenderVillage: 1.03,
    defenderTown: 1.08,
    defenderCity: 1.15,
    defenderCapitalBump: 1.05,
    mightIntensityDivisor: 2,
    tollCap: 35,
    tollCpForCap: 3_000,
  },
  {
    label: 'edge-filter-3wars',
    warThreshold: 15,
    rivalBonus: 28,
    unalignedBonus: 45,
    preferWinnableStakes: true,
    requireAttackerEdge: true,
    attackerEdgeMargin: 1.05,
    maxConquestsPerEpoch: 3,
    defenderHamlet: 1.0,
    defenderVillage: 1.02,
    defenderTown: 1.06,
    defenderCity: 1.12,
    defenderCapitalBump: 1.05,
    mightIntensityDivisor: 2,
    mightIntensityCap: 50,
    tollCap: 40,
    tollCpForCap: 2_500,
  },
  {
    label: 'edge-soft-margin',
    warThreshold: 18,
    rivalBonus: 24,
    unalignedBonus: 42,
    preferWinnableStakes: true,
    requireAttackerEdge: true,
    attackerEdgeMargin: 1.0,
    maxConquestsPerEpoch: 3,
    defenderHamlet: 1.0,
    defenderVillage: 1.02,
    defenderTown: 1.08,
    defenderCity: 1.15,
    defenderCapitalBump: 1.08,
    mightIntensityDivisor: 2.5,
    tollCap: 35,
    tollCpForCap: 3_000,
  },
  {
    label: 'edge-low-threshold-flood',
    warThreshold: 10,
    rivalBonus: 30,
    unalignedBonus: 50,
    preferWinnableStakes: true,
    requireAttackerEdge: true,
    attackerEdgeMargin: 1.01,
    maxConquestsPerEpoch: 3,
    defenderHamlet: 1.0,
    defenderVillage: 1.0,
    defenderTown: 1.05,
    defenderCity: 1.1,
    defenderCapitalBump: 1.05,
    mightIntensityDivisor: 2,
    mightIntensityCap: 55,
    foodCap: 40,
    wealthCap: 30,
    tollCap: 45,
    tollCpForCap: 2_000,
  },
  {
    label: 'edge-capital-hard',
    warThreshold: 16,
    rivalBonus: 26,
    unalignedBonus: 44,
    preferWinnableStakes: true,
    requireAttackerEdge: true,
    attackerEdgeMargin: 1.03,
    maxConquestsPerEpoch: 2,
    defenderHamlet: 1.0,
    defenderVillage: 1.02,
    defenderTown: 1.1,
    defenderCity: 1.2,
    defenderCapitalBump: 1.3,
    mightIntensityDivisor: 2,
    tollCap: 38,
    tollCpForCap: 2_800,
  },
]

const SEEDS = [11, 42, 99, 202, 777, 1337]
const HAULS = [6, 10, 16]
const EPOCHS = 28

async function evaluateCandidate(candidate) {
  resetConflictTuning()
  const { label, ...patch } = candidate
  if (Object.keys(patch).length) setConflictTuning(patch)

  /** @type {Awaited<ReturnType<typeof runOne>>[]} */
  const rows = []
  for (const seed of SEEDS) {
    for (const haul of HAULS) {
      rows.push(await runOne({ seed, haul, epochs: EPOCHS }))
    }
  }

  const summary = {
    label,
    score: rows.reduce((a, r) => a + scoreMetrics(r), 0) / rows.length,
    conquestEpochRate: mean(rows, 'conquestEpochRate'),
    warEpochRate: mean(rows, 'warEpochRate'),
    winRate: mean(rows, 'winRate'),
    unalignedAbsorbRate: mean(rows, 'unalignedAbsorbRate'),
    finalFactions: mean(rows, 'finalFactions'),
    singletons: mean(rows, 'singletons'),
    topShare: mean(rows, 'topShare'),
    herfindahl: mean(rows, 'herfindahl'),
    ownershipFlips: mean(rows, 'ownershipFlips'),
    wars: mean(rows, 'wars'),
    patch,
  }
  return summary
}

const results = []
for (const candidate of CANDIDATES) {
  const started = Date.now()
  const summary = await evaluateCandidate(candidate)
  summary.elapsedMs = Date.now() - started
  results.push(summary)
  console.log(
    JSON.stringify({
      label: summary.label,
      score: Number(summary.score.toFixed(3)),
      conquest: Number(summary.conquestEpochRate.toFixed(3)),
      war: Number(summary.warEpochRate.toFixed(3)),
      win: Number(summary.winRate.toFixed(3)),
      absorb: Number(summary.unalignedAbsorbRate.toFixed(3)),
      factions: Number(summary.finalFactions.toFixed(2)),
      topShare: Number(summary.topShare.toFixed(3)),
      flips: Number(summary.ownershipFlips.toFixed(1)),
      ms: summary.elapsedMs,
    }),
  )
}

results.sort((a, b) => b.score - a.score)
console.log('\n=== RANKED ===')
for (const r of results) {
  console.log(
    `${r.score.toFixed(3)}  ${r.label}  conquest=${r.conquestEpochRate.toFixed(2)} win=${r.winRate.toFixed(2)} absorb=${r.unalignedAbsorbRate.toFixed(2)} factions=${r.finalFactions.toFixed(1)}`,
  )
}
console.log('\nWINNER_PATCH=' + JSON.stringify(results[0].patch))
resetConflictTuning()
