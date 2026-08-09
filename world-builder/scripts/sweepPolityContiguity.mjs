/**
 * Sweep conflict tunables for contiguous polities / low fragmentation.
 * Small maps, many seeds. Uses applyColonizationEpoch (same politics/conflict engine
 * as the live UI path after politics was wired into runColonizationEpochStep).
 *
 * Run: node world-builder/scripts/sweepPolityContiguity.mjs
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
    elev[i] = 0.52 + 0.07 * Math.sin((x + seed) * 0.19) * Math.cos((y + seed) * 0.17) + 0.04 * rand()
    arable[i] = 1.7 + 1.1 * rand()
    if (x === ((7 + (seed % 5)) % width)) river[i] = 1
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

function living(slice) {
  return (slice.settlements ?? []).filter((s) => s.status === 'living')
}

function activeFactions(slice) {
  return (slice.factions ?? []).filter((f) => f.status === 'active')
}

/**
 * Local polity graph: only short-haul candidate edges count as contiguous.
 * Full trade reach (≤1 haul) is too dense and hides leapfrog fragmentation.
 * @param {object[]} edges
 * @param {number} maxHaulFraction
 */
function buildNeighborIndex(edges, maxHaulFraction = 0.35) {
  /** @type {Map<string, Set<string>>} */
  const neighbors = new Map()
  for (const edge of edges ?? []) {
    const a = edge?.fromSettlementId
    const b = edge?.toSettlementId
    if (!a || !b) continue
    const haul = Number(edge.haulDistanceFraction)
    if (!(haul >= 0) || haul > maxHaulFraction) continue
    if (!neighbors.has(a)) neighbors.set(a, new Set())
    if (!neighbors.has(b)) neighbors.set(b, new Set())
    neighbors.get(a)?.add(b)
    neighbors.get(b)?.add(a)
  }
  return neighbors
}

/**
 * Trade-graph components among a faction's living pins.
 * @param {string[]} memberIds
 * @param {Map<string, Set<string>>} neighbors
 */
function componentCount(memberIds, neighbors) {
  const set = new Set(memberIds)
  /** @type {Set<string>} */
  const seen = new Set()
  let components = 0
  for (const start of memberIds) {
    if (seen.has(start)) continue
    components += 1
    /** @type {string[]} */
    const stack = [start]
    seen.add(start)
    while (stack.length) {
      const id = stack.pop()
      for (const next of neighbors.get(id) ?? []) {
        if (!set.has(next) || seen.has(next)) continue
        seen.add(next)
        stack.push(next)
      }
    }
  }
  return components
}

function fragmentation(slice, localHaulFraction = 0.35) {
  const neighbors = buildNeighborIndex(
    slice.tradeRouteState?.candidates ?? [],
    localHaulFraction,
  )
  const factions = activeFactions(slice)
  let multiPin = 0
  let extraComponents = 0
  let isolatedFromCapital = 0
  let leapfrogPins = 0
  for (const faction of factions) {
    const members = living(slice)
      .filter((s) => s.factionId === faction.id)
      .map((s) => s.id)
    if (members.length < 2) continue
    multiPin += 1
    const components = componentCount(members, neighbors)
    extraComponents += Math.max(0, components - 1)

    const capital = faction.capitalSettlementId
    if (!capital || !members.includes(capital)) continue
    /** @type {Set<string>} */
    const reachable = new Set([capital])
    /** @type {string[]} */
    const stack = [capital]
    const memberSet = new Set(members)
    while (stack.length) {
      const id = stack.pop()
      for (const next of neighbors.get(id) ?? []) {
        if (!memberSet.has(next) || reachable.has(next)) continue
        reachable.add(next)
        stack.push(next)
      }
    }
    const isolated = members.length - reachable.size
    isolatedFromCapital += isolated
    leapfrogPins += isolated
  }
  return { multiPin, extraComponents, isolatedFromCapital, leapfrogPins }
}

function herfindahl(slice) {
  const pins = living(slice)
  if (!pins.length) return 0
  const counts = new Map()
  for (const s of pins) {
    const key = s.factionId ?? '__u__'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let h = 0
  for (const c of counts.values()) {
    const share = c / pins.length
    h += share * share
  }
  return h
}

/**
 * @param {{
 *   seed: number,
 *   epochs: number,
 *   haul: number,
 *   width: number,
 *   height: number,
 * }} opts
 */
async function runOne(opts) {
  const world = makeDoc(opts.seed, opts.width, opts.height)
  let slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 5, y: 5 }
  slice.colonistSettings.threeDayHaulDistance = opts.haul
  slice.colonistSettings.startingPopulation = 140
  slice = await beginColonizationCommit(slice, world)

  let wars = 0
  let attackerWins = 0
  let rebellions = 0
  let multiActorEpochs = 0

  for (let i = 0; i < opts.epochs; i += 1) {
    const actors =
      activeFactions(slice).length + living(slice).filter((s) => !s.factionId).length
    if (actors >= 2) multiActorEpochs += 1
    const { slice: next, events } = await applyColonizationEpoch(slice, world)
    slice = next
    wars += events.filter((e) => e.kind === 'major_war_start').length
    attackerWins += events.filter((e) => e.kind === 'major_war_end' && e.winner === 'attacker')
      .length
    rebellions += events.filter((e) => e.kind === 'rebellion_start').length
  }

  const pins = living(slice)
  const factions = activeFactions(slice)
  const frag = fragmentation(slice)
  const unaligned = pins.filter((s) => !s.factionId).length
  const unalignedShare = pins.length ? unaligned / pins.length : 0

  return {
    seed: opts.seed,
    wars,
    attackerWins,
    rebellions,
    multiActorEpochs,
    finalLiving: pins.length,
    finalFactions: factions.length,
    finalUnaligned: unaligned,
    unalignedShare,
    herfindahl: herfindahl(slice),
    multiPinFactions: frag.multiPin,
    extraComponents: frag.extraComponents,
    isolatedFromCapital: frag.isolatedFromCapital,
    leapfrogPins: frag.leapfrogPins,
    fragmentRate: pins.length ? frag.extraComponents / pins.length : 0,
    isolateRate: pins.length ? frag.isolatedFromCapital / pins.length : 0,
    leapfrogRate: pins.length ? frag.leapfrogPins / pins.length : 0,
  }
}

function clamp01(n) {
  return Math.max(0, Math.min(1, Number(n) || 0))
}

function scoreMetrics(m) {
  if (!(m.multiActorEpochs > 0) || !(m.finalLiving > 3)) return -10
  // Extra short-haul components + capital-unreachable pins are the visual fragmentation.
  const fragmentPenalty =
    clamp01(m.fragmentRate * 5) + clamp01(m.isolateRate * 4) + clamp01(m.leapfrogRate * 4)
  const unaligned = m.unalignedShare
  // Want a few independents, not none and not half the map.
  const independentBand =
    unaligned >= 0.04 && unaligned <= 0.28
      ? 1
      : unaligned < 0.04
        ? 0.45 + unaligned * 8
        : Math.max(0, 1 - (unaligned - 0.28) / 0.4)
  const factionBand =
    m.finalFactions >= 2 && m.finalFactions <= 7
      ? 1
      : m.finalFactions === 1
        ? 0.5
        : m.finalFactions < 2
          ? 0.15
          : Math.max(0, 1 - (m.finalFactions - 7) / 8)
  const activity = clamp01(m.attackerWins / Math.max(4, m.multiActorEpochs))
  const rebellionLoad = clamp01(m.rebellions / Math.max(4, m.multiActorEpochs))
  const consolidation = clamp01(m.herfindahl)

  return (
    independentBand * 2.2 +
    factionBand * 2.0 +
    activity * 1.6 +
    consolidation * 1.0 -
    fragmentPenalty * 5.5 -
    rebellionLoad * 0.8
  )
}

function mean(rows, key) {
  if (!rows.length) return 0
  return rows.reduce((a, r) => a + r[key], 0) / rows.length
}

/** @type {Array<Partial<import('../core/colonization/politics/conflict/conflictTuning.js').ConflictTuning> & { label: string }>} */
const CANDIDATES = [
  { label: 'current' },
  {
    label: 'nc055-hard',
    requireBorderNeighbor: true,
    allowDistantUnalignedConquest: false,
    borderNeighborHaulFraction: 0.55,
    borderEaseBoost: 5,
    unalignedEaseBoost: 2.2,
    haulProximityWeight: 4,
    maxConquestsPerEpoch: 3,
    rebellionDistantHaulFraction: 0.9,
    warThreshold: 10,
    unalignedBonus: 58,
  },
  {
    label: 'nc05-du07',
    requireBorderNeighbor: true,
    allowDistantUnalignedConquest: true,
    borderNeighborHaulFraction: 0.5,
    distantUnalignedHaulFraction: 0.7,
    nonBorderEaseMult: 0.08,
    borderEaseBoost: 8,
    unalignedEaseBoost: 1.9,
    haulProximityWeight: 7,
    maxConquestsPerEpoch: 3,
    rebellionDistantHaulFraction: 0.9,
    warThreshold: 11,
    unalignedBonus: 55,
  },
  {
    label: 'nc045-du065',
    requireBorderNeighbor: true,
    allowDistantUnalignedConquest: true,
    borderNeighborHaulFraction: 0.45,
    distantUnalignedHaulFraction: 0.65,
    nonBorderEaseMult: 0.06,
    borderEaseBoost: 9,
    unalignedEaseBoost: 1.8,
    haulProximityWeight: 8,
    maxConquestsPerEpoch: 3,
    rebellionDistantHaulFraction: 0.95,
    warThreshold: 11,
    unalignedBonus: 52,
  },
  {
    label: 'nc055-du08',
    requireBorderNeighbor: true,
    allowDistantUnalignedConquest: true,
    borderNeighborHaulFraction: 0.55,
    distantUnalignedHaulFraction: 0.8,
    nonBorderEaseMult: 0.1,
    borderEaseBoost: 7,
    unalignedEaseBoost: 2.0,
    haulProximityWeight: 6,
    maxConquestsPerEpoch: 3,
    rebellionDistantHaulFraction: 0.9,
    warThreshold: 10,
    unalignedBonus: 58,
  },
  {
    label: 'nc06-du075',
    requireBorderNeighbor: true,
    allowDistantUnalignedConquest: true,
    borderNeighborHaulFraction: 0.6,
    distantUnalignedHaulFraction: 0.75,
    nonBorderEaseMult: 0.08,
    borderEaseBoost: 8,
    unalignedEaseBoost: 1.9,
    haulProximityWeight: 6,
    maxConquestsPerEpoch: 3,
    rebellionDistantHaulFraction: 0.85,
    warThreshold: 10,
    unalignedBonus: 55,
  },
  {
    label: 'nc05-du06',
    requireBorderNeighbor: true,
    allowDistantUnalignedConquest: true,
    borderNeighborHaulFraction: 0.5,
    distantUnalignedHaulFraction: 0.6,
    nonBorderEaseMult: 0.05,
    borderEaseBoost: 10,
    unalignedEaseBoost: 1.7,
    haulProximityWeight: 9,
    maxConquestsPerEpoch: 3,
    rebellionDistantHaulFraction: 0.9,
    warThreshold: 11,
    unalignedBonus: 50,
  },
  {
    label: 'nc065-hard',
    requireBorderNeighbor: true,
    allowDistantUnalignedConquest: false,
    borderNeighborHaulFraction: 0.65,
    borderEaseBoost: 4,
    unalignedEaseBoost: 2.0,
    haulProximityWeight: 3,
    maxConquestsPerEpoch: 3,
    rebellionDistantHaulFraction: 0.85,
    warThreshold: 10,
    unalignedBonus: 55,
  },
]

const SEEDS = [11, 29, 47, 73, 101, 139, 181, 223]
const EPOCHS = 12
const HAULS = [3, 5]
const SIZE = 14

const ranked = []
const sweepStarted = performance.now()
process.stdout.write(
  `sweep: ${CANDIDATES.length} candidates × ${HAULS.length} hauls × ${SEEDS.length} seeds × ${EPOCHS} epochs on ${SIZE}×${SIZE} (local haul≤0.35)\n`,
)

for (const candidate of CANDIDATES) {
  const { label, ...patch } = candidate
  const t0 = performance.now()
  /** @type {Awaited<ReturnType<typeof runOne>>[]} */
  const rows = []
  for (const haul of HAULS) {
    for (const seed of SEEDS) {
      resetConflictTuning()
      setConflictTuning(patch)
      rows.push(
        await runOne({
          seed: seed + haul * 17,
          epochs: EPOCHS,
          haul,
          width: SIZE,
          height: SIZE,
        }),
      )
    }
  }
  const summary = {
    label,
    score: mean(rows.map((r) => ({ score: scoreMetrics(r) })), 'score'),
    fragmentRate: mean(rows, 'fragmentRate'),
    isolateRate: mean(rows, 'isolateRate'),
    extraComponents: mean(rows, 'extraComponents'),
    isolatedFromCapital: mean(rows, 'isolatedFromCapital'),
    leapfrogRate: mean(rows, 'leapfrogRate'),
    unalignedShare: mean(rows, 'unalignedShare'),
    finalFactions: mean(rows, 'finalFactions'),
    herfindahl: mean(rows, 'herfindahl'),
    attackerWins: mean(rows, 'attackerWins'),
    rebellions: mean(rows, 'rebellions'),
    finalLiving: mean(rows, 'finalLiving'),
    elapsedMs: Math.round(performance.now() - t0),
    patch,
  }
  ranked.push(summary)
  // Line-buffer progress when stdout is redirected.
  process.stdout.write(`${JSON.stringify(summary)}\n`)
}
process.stdout.write(`sweep total ${(performance.now() - sweepStarted) / 1000}s\n`)

ranked.sort((a, b) => b.score - a.score)
process.stdout.write('\n=== RANKED ===\n')
for (const row of ranked) {
  process.stdout.write(
    `${row.score.toFixed(3)}  ${row.label}  frag=${row.fragmentRate.toFixed(3)} isol=${row.isolateRate.toFixed(3)} leap=${row.leapfrogRate.toFixed(3)} una=${row.unalignedShare.toFixed(3)} fac=${row.finalFactions.toFixed(1)} wins=${row.attackerWins.toFixed(1)} reb=${row.rebellions.toFixed(1)}\n`,
  )
}
process.stdout.write(`\nWINNER ${JSON.stringify(ranked[0], null, 2)}\n`)
