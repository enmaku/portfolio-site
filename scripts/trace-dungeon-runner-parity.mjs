#!/usr/bin/env node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { applyAction, createInitialMatchState, getLegalActions } from '../src/features/dungeon-runner/engine/kernel.js'
import { buildPolicyLegalMask, buildPolicyObservation, decodePolicyIndexToAction } from '../src/features/dungeon-runner/nn/policyAdapter.js'

const args = process.argv.slice(2)
const seed = Number(getArgValue(args, '--seed') ?? 4242)
const maxSteps = Number(getArgValue(args, '--max-steps') ?? 20)
const modelId = getArgValue(args, '--model-id') ?? 'latest'
const hero = (getArgValue(args, '--hero') ?? 'WARRIOR').toUpperCase()
const sourceRepo = getArgValue(args, '--source-repo') ?? '/tmp/dungeon-runner-src'
const weightsPath = getArgValue(args, '--weights') ?? `${sourceRepo}/models/${modelId}/policy.weights.h5`
const pythonBin = process.env.PYTHON_BIN ?? './.venv-tfjs312/bin/python'
const logStepsArg = getArgValue(args, '--log-steps')
const logSteps = logStepsArg
  ? new Set(
      logStepsArg
        .split(',')
        .map((s) => Number(String(s).trim()))
        .filter((n) => Number.isFinite(n)),
    )
  : null

const jsTrace = runJsTrace({ seed, maxSteps, modelId, sourceRepo, weightsPath, pythonBin, hero })
const pyTrace = runPythonTrace({ seed, maxSteps, sourceRepo, weightsPath, pythonBin, hero })

console.log(`JS trace steps: ${jsTrace.length}`)
console.log(`PY trace steps: ${pyTrace.length}`)
const limit = Math.min(jsTrace.length, pyTrace.length)
let divergence = -1
for (let i = 0; i < limit; i += 1) {
  if (normalizeActionForCompare(jsTrace[i].action) !== normalizeActionForCompare(pyTrace[i].action)) {
    divergence = i
    break
  }
}

if (divergence === -1) {
  console.log(`No divergence in first ${limit} steps by action label.`)
} else {
  console.log(`First divergence at step ${divergence}:`)
  console.log(`  JS: ${formatTrace(jsTrace[divergence])}`)
  console.log(`  PY: ${formatTrace(pyTrace[divergence])}`)
  console.log('\nJS divergence diagnostics:')
  console.log(`  legal: ${jsTrace[divergence].legalActions.join(', ')}`)
  console.log(
    `  state: deck_len=${jsTrace[divergence].deckLen} pending=${jsTrace[divergence].pendingSpecies ?? 'null'} passed=[${jsTrace[divergence].passedSeats.join(',')}]`,
  )
  console.log(`  own_pile_counts: ${JSON.stringify(jsTrace[divergence].ownPileCounts)}`)
  console.log(`  appended_species: ${jsTrace[divergence].appendedSpecies ?? 'null'}`)
  for (const row of jsTrace[divergence].topLegal) {
    console.log(`  top idx ${String(row.index).padStart(2, ' ')} logit=${row.logit.toFixed(4)} action=${row.action}`)
  }
  console.log('\nPY divergence diagnostics:')
  console.log(`  legal: ${pyTrace[divergence].legal_actions.join(', ')}`)
  console.log(
    `  state: deck_len=${pyTrace[divergence].deck_len} pending=${pyTrace[divergence].pending_species ?? 'null'} passed=[${(pyTrace[divergence].passed_seats ?? []).join(',')}]`,
  )
  console.log(`  own_pile_counts: ${JSON.stringify(pyTrace[divergence].own_pile_counts ?? {})}`)
  console.log(`  appended_species: ${(pyTrace[divergence].appended_species ?? '').toLowerCase?.() || 'null'}`)
  for (const row of pyTrace[divergence].top_legal) {
    console.log(`  top idx ${String(row.index).padStart(2, ' ')} logit=${row.logit.toFixed(4)}`)
  }
  const obsDiff = diffObservation(jsTrace[divergence].observation, pyTrace[divergence].observation)
  console.log(`\nObservation diff @ step ${divergence}:`)
  console.log(`  max abs diff: ${obsDiff.maxAbs.toFixed(6)}`)
  console.log(`  changed dims (>1e-6): ${obsDiff.changedCount}`)
  console.log('  top differing dims:')
  for (const row of obsDiff.topRows) {
    console.log(`    idx ${String(row.index).padStart(2, ' ')} | js=${row.js.toFixed(6)} | py=${row.py.toFixed(6)} | abs=${row.abs.toFixed(6)}`)
  }
  console.log('\nDungeon parity (obs idx 69-86 = 8 species + hp + rem + 4 sub + poly + axe + 2 inplay):')
  console.log(formatDungeonCompare(jsTrace[divergence], pyTrace[divergence]))
}

if (logSteps?.size) {
  console.log('\n--log-steps dungeon snapshots:')
  for (const step of [...logSteps].sort((a, b) => a - b)) {
    if (step < 0 || step >= limit) continue
    console.log(`\nStep ${step}:`)
    console.log(formatDungeonCompare(jsTrace[step], pyTrace[step]))
  }
}

console.log('\nFirst 12-step comparison:')
for (let i = 0; i < Math.min(12, limit); i += 1) {
  console.log(`${String(i).padStart(2, '0')} | JS ${pad(jsTrace[i].action, 28)} | PY ${pyTrace[i].action}`)
}
console.log('\nOwn-pile append events (first 30 steps):')
for (let i = 0; i < Math.min(30, limit); i += 1) {
  const ja = jsTrace[i].appendedSpecies
  const pa = (pyTrace[i].appended_species ?? '').toLowerCase?.() || null
  if (!ja && !pa) continue
  console.log(`${String(i).padStart(2, '0')} | JS append=${ja ?? 'null'} | PY append=${pa ?? 'null'}`)
}

function runJsTrace({ seed, maxSteps, modelId, sourceRepo, weightsPath, pythonBin, hero }) {
  let state = createInitialMatchState(
    {
      totalSeats: 4,
      opponents: [{ type: 'nn', modelId }, { type: 'nn', modelId }, { type: 'nn', modelId }],
    },
    { seed },
  )
  state = applyHeroToState(state, hero)
  const trace = []
  const previousOwnAddLengths = Object.fromEntries(state.seats.map((seat) => [seat.id, (state.playerOwnPileAdds?.[seat.id] ?? []).length]))
  const initialSeatRoles = state.seats.map((seat) => ({ id: seat.id, role: seat.role.type, modelId: seat.role.modelId ?? null }))
  console.log('JS initial seat order:', JSON.stringify(initialSeatRoles))
  console.log('JS initial active seat:', state.turn.activeSeatId)
  for (let step = 0; step < maxSteps; step += 1) {
    if (state.phase === 'match-over') break
    const seatId = state.turn.activeSeatId
    if (!seatId) break
    const legal = getLegalActions(state, { seatId })
    if (!legal.length) break
    const features = buildPolicyObservation(state, { seatId })
    const legalMask = buildPolicyLegalMask(state, { seatId }, legal)
    const probe = argmaxMaskedFromPython({ sourceRepo, weightsPath, pythonBin, features, legalMask })
    const pickedIndex = probe.argmaxMaskedIndex
    const action = decodePolicyIndexToAction(pickedIndex, legal, state, { seatId }) ?? legal[0]
    const appendedSpecies = getAppendedSpecies(state, seatId, previousOwnAddLengths)
    trace.push({
      step,
      phase: state.phase,
      seat: seatId,
      pickedIndex,
      action: formatAction(action),
      observation: features,
      dungeonSnapshot: buildJsDungeonSnapshot(state, seatId, features),
      legalActions: legal.map(formatAction),
      topLegal: (probe.topLegalIndices ?? []).map((index) => ({
        index,
        logit: probe.maskedLogits[index] ?? Number.NaN,
        action: formatAction(decodePolicyIndexToAction(index, legal, state, { seatId }) ?? null),
      })),
      deckLen: state.bidding?.monsterDeck?.length ?? 0,
      pendingSpecies: state.bidding?.revealedMonsterCard ?? null,
      appendedSpecies,
      passedSeats: [...(state.bidding?.passedSeatIds ?? [])],
      ownPileCounts: ownPileCounts(state, seatId),
    })
    const next = applyAction(state, action, { seatId })
    if (!next.ok) break
    state = next.state
  }
  return trace
}

function runPythonTrace({ seed, maxSteps, sourceRepo, weightsPath, pythonBin, hero }) {
  const script = path.join(process.cwd(), 'scripts', 'trace_dungeon_runner_source.py')
  const run = spawnSync(
    pythonBin,
    [
      '--',
      script,
      '--repo-root',
      sourceRepo,
      '--weights',
      weightsPath,
      '--seed',
      String(seed),
      '--players',
      '4',
      '--max-steps',
      String(maxSteps),
      '--hero',
      hero,
    ],
    { encoding: 'utf8' },
  )
  if (run.status !== 0) {
    throw new Error(`python trace failed\n${run.stdout}\n${run.stderr}`)
  }
  const parsed = JSON.parse(run.stdout)
  if (parsed.initial_seat_order) {
    console.log('PY initial seat order:', JSON.stringify(parsed.initial_seat_order))
  }
  if (typeof parsed.initial_active_seat === 'number') {
    console.log('PY initial active seat:', parsed.initial_active_seat)
  }
  return parsed.trace
}

function argmaxMaskedFromPython({ sourceRepo, weightsPath, pythonBin, features, legalMask }) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'dungeon-runner-argmax-'))
  const inputPath = path.join(tempDir, 'input.json')
  writeFileSync(
    inputPath,
    JSON.stringify({
      repoRoot: sourceRepo,
      weightsPath,
      cases: [{ features, legalMask }],
    }),
  )
  const script = path.join(process.cwd(), 'scripts', 'probe_dungeon_runner_source.py')
  const run = spawnSync(pythonBin, ['--', script, '--input', inputPath], { encoding: 'utf8' })
  rmSync(tempDir, { recursive: true, force: true })
  if (run.status !== 0) {
    throw new Error(`python argmax failed\n${run.stdout}\n${run.stderr}`)
  }
  const result = JSON.parse(run.stdout).results[0]
  return {
    argmaxMaskedIndex: result.argmax_masked_index,
    maskedLogits: result.masked_logits ?? [],
    topLegalIndices: result.top_legal_indices ?? [],
  }
}

function getArgValue(argList, name) {
  const index = argList.indexOf(name)
  if (index === -1) return null
  return argList[index + 1] ?? null
}

function formatAction(action) {
  if (!action) return 'null'
  if (action.equipmentId) return `SACRIFICE(${action.equipmentId})`
  if (action.species) return `DECLARE_VORPAL(${action.species})`
  if (action.hero) return `CHOOSE_NEXT_ADVENTURER(${action.hero})`
  return action.type
}

function formatTrace(entry) {
  return `phase=${entry.phase} seat=${entry.seat} idx=${entry.pickedIndex} action=${entry.action}`
}

/** Ignore Python Title Case vs JS lowercase in SACRIFICE/DECLARE_VORPAL labels. */
function normalizeActionForCompare(label) {
  if (typeof label !== 'string') return String(label)
  const m = label.match(/^(SACRIFICE|DECLARE_VORPAL)\((.+)\)$/)
  if (m) return `${m[1]}(${m[2].toLowerCase()})`
  return label
}

function pad(value, width) {
  return `${value}${' '.repeat(Math.max(0, width - value.length))}`
}

function diffObservation(jsObs, pyObs) {
  const rows = []
  let maxAbs = 0
  for (let i = 0; i < Math.min(jsObs.length, pyObs.length); i += 1) {
    const js = Number(jsObs[i] ?? 0)
    const py = Number(pyObs[i] ?? 0)
    const abs = Math.abs(js - py)
    if (abs > maxAbs) maxAbs = abs
    if (abs > 1e-6) rows.push({ index: i, js, py, abs })
  }
  rows.sort((a, b) => b.abs - a.abs)
  return {
    maxAbs,
    changedCount: rows.length,
    topRows: rows.slice(0, 15),
  }
}

function ownPileCounts(state, seatId) {
  const order = ['goblin', 'skeleton', 'orc', 'vampire', 'golem', 'lich', 'demon', 'dragon']
  const counts = Object.fromEntries(order.map((item) => [item, 0]))
  const pile = state.playerOwnPileAdds?.[seatId] ?? []
  for (const species of pile) {
    if (!(species in counts)) continue
    counts[species] = Math.min(2, counts[species] + 1)
  }
  return counts
}

function applyHeroToState(state, hero) {
  const slotsByHero = {
    WARRIOR: ['W_PLATE', 'W_SHIELD', 'W_VORPAL', 'W_TORCH', 'W_HOLY', 'W_SPEAR'],
    BARBARIAN: ['B_HEAL', 'B_SHIELD', 'B_CHAIN', 'B_AXE', 'B_TORCH', 'B_HAMMER'],
    MAGE: ['M_WALL', 'M_HOLY', 'M_OMNI', 'M_BRACE', 'M_POLY', 'M_PACT'],
    ROGUE: ['R_ARMOR', 'R_HEAL', 'R_RING', 'R_BUCK', 'R_VORP', 'R_CLOAK'],
  }
  const heroKey = slotsByHero[hero] ? hero : 'WARRIOR'
  const loadout = slotsByHero[heroKey]
  return {
    ...state,
    hero: heroKey,
    centerEquipment: [...loadout],
    heroLoadout: Object.fromEntries(state.seats.map((seat) => [seat.id, [...loadout]])),
  }
}

function getAppendedSpecies(state, seatId, previousOwnAddLengths) {
  const current = state.playerOwnPileAdds?.[seatId] ?? []
  const previous = previousOwnAddLengths[seatId] ?? 0
  previousOwnAddLengths[seatId] = current.length
  if (current.length > previous) return current[current.length - 1]
  return null
}

/** Mirrors Python Match fields used in rl/observation._dungeon_block for debugging. */
function buildJsDungeonSnapshot(state, seatId, features) {
  const slice = features.length >= 87 ? features.slice(69, 87) : []
  return {
    phase: state.phase,
    activeSeatId: state.turn?.activeSeatId ?? null,
    runnerSeatId: state.bidding?.runnerSeatId ?? null,
    dungeonSubphase: state.dungeon?.subphase ?? null,
    currentMonster: state.dungeon?.currentMonster ?? null,
    policyAdapterFallbackMonster: state.bidding?.dungeonMonsters?.[0] ?? null,
    hp: state.dungeon?.hp ?? null,
    remainingMonstersLen: state.dungeon?.remainingMonsters?.length ?? null,
    dungeonMonstersLen: state.bidding?.dungeonMonsters?.length ?? null,
    polySpent: state.dungeon?.polySpent ?? null,
    axeSpent: state.dungeon?.axeSpent ?? null,
    inPlayEquipmentIds: [...(state.dungeon?.inPlayEquipmentIds ?? [])],
    centerEquipmentIds: [...(state.centerEquipment ?? [])],
    obsDungeonSlice69to86: slice,
  }
}

function formatDungeonCompare(jsRow, pyRow) {
  const js = jsRow.dungeonSnapshot ?? {}
  const py = pyRow.dungeon_snapshot ?? {}
  const lines = []
  lines.push(`  phase: js=${js.phase ?? 'n/a'} py=${py.phase ?? 'n/a'}`)
  lines.push(`  runner: js=${js.runnerSeatId ?? 'n/a'} py=${py.runner_seat ?? 'n/a'}`)
  lines.push(`  active: js=${js.activeSeatId ?? 'n/a'} py=${py.active_seat ?? 'n/a'}`)
  lines.push(`  dungeon_sub: js=${js.dungeonSubphase ?? 'null'} py=${py.dungeon_sub ?? 'null'}`)
  lines.push(`  current_monster: js=${js.currentMonster ?? 'null'} py=${py.d_current_species ?? 'null'}`)
  lines.push(`  js_fallback_first_pile=${js.policyAdapterFallbackMonster ?? 'null'} (policyAdapter uses this when currentMonster null)`)
  lines.push(`  hp: js=${js.hp} py=${py.d_hp}`)
  lines.push(`  remaining_len: js=${js.remainingMonstersLen} py=${py.d_remaining_len}`)
  lines.push(`  dungeon_pile_len(py): ${py.dungeon_pile_len ?? 'n/a'} | dungeonMonsters(js): ${js.dungeonMonstersLen}`)
  lines.push(`  poly_spent: js=${js.polySpent} py=${py.d_poly_spent}`)
  lines.push(`  axe_spent: js=${js.axeSpent} py=${py.d_axe_spent}`)
  lines.push(`  in_play: js=${JSON.stringify(js.inPlayEquipmentIds)} py=${JSON.stringify(py.d_in_play_sorted ?? py.d_in_play)}`)
  lines.push(`  center_equipment(js len): ${js.centerEquipmentIds?.length} py count: ${py.center_equipment_count}`)
  lines.push(`  obs[69:87] js: [${(js.obsDungeonSlice69to86 ?? []).map((x) => Number(x).toFixed(4)).join(', ')}]`)
  lines.push(`  obs[69:87] py: [${(py.obs_dungeon_slice ?? []).map((x) => Number(x).toFixed(4)).join(', ')}]`)
  return lines.join('\n')
}
