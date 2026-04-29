#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyAction, createInitialMatchState, getLegalActions } from '../src/features/dungeon-runner/engine/kernel.js'
import { buildPolicyLegalMask, buildPolicyObservation, decodePolicyIndexToAction } from '../src/features/dungeon-runner/nn/policyAdapter.js'

const args = process.argv.slice(2)
const modelId = getArgValue(args, '--model-id') ?? 'latest'
const repoRoot = getArgValue(args, '--repo-root') ?? '/tmp/dungeon-runner-src'
const weightsPath = getArgValue(args, '--weights') ?? path.join(repoRoot, 'models', modelId, 'policy.weights.h5')
const pythonBin = process.env.PYTHON_BIN ?? './.venv-tfjs312/bin/python'

const scenarios = buildProbeScenarios(modelId)
const probeCases = scenarios.map((scenario) => {
  const legalActions = getLegalActions(scenario.state, { seatId: scenario.seatId })
  return {
    name: scenario.name,
    seatId: scenario.seatId,
    legalActions,
    features: buildPolicyObservation(scenario.state, { seatId: scenario.seatId }),
    legalMask: buildPolicyLegalMask(scenario.state, { seatId: scenario.seatId }, legalActions),
  }
})

const tempDir = mkdtempSync(path.join(tmpdir(), 'dungeon-runner-parity-probe-'))
const payloadPath = path.join(tempDir, 'payload.json')
writeFileSync(
  payloadPath,
  JSON.stringify({
    repoRoot,
    weightsPath,
    cases: probeCases.map((testCase) => ({ features: testCase.features, legalMask: testCase.legalMask })),
  }),
)

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const helperPath = path.join(scriptDir, 'probe_dungeon_runner_source.py')
const run = spawnSync(pythonBin, [helperPath, '--input', payloadPath], {
  encoding: 'utf8',
})
if (run.status !== 0) {
  console.error(run.stdout)
  console.error(run.stderr)
  cleanup(tempDir)
  process.exit(run.status ?? 1)
}

const source = JSON.parse(run.stdout)
for (let i = 0; i < probeCases.length; i += 1) {
  const testCase = probeCases[i]
  const result = source.results[i]
  const legalIndices = testCase.legalMask
    .map((value, index) => (value > 0 ? index : -1))
    .filter((index) => index >= 0)
  const topLegal = [...legalIndices]
    .sort((a, b) => result.masked_logits[b] - result.masked_logits[a])
    .slice(0, 5)
    .map((index) => ({
      index,
      logit: Number(result.masked_logits[index].toFixed(4)),
      action: decodePolicyIndexToAction(index, testCase.legalActions),
    }))
  const pickedIndex = result.argmax_masked_index
  const pickedAction = decodePolicyIndexToAction(pickedIndex, testCase.legalActions)
  console.log(`\n[${testCase.name}] seat=${testCase.seatId}`)
  console.log(`legal actions: ${testCase.legalActions.map(formatAction).join(', ')}`)
  console.log(`argmax masked index: ${pickedIndex} -> ${formatAction(pickedAction)}`)
  console.log(`top legal logits:`)
  for (const row of topLegal) {
    console.log(`  - idx ${row.index.toString().padStart(2, ' ')} | ${row.logit.toString().padStart(8, ' ')} | ${formatAction(row.action)}`)
  }
}

cleanup(tempDir)

function buildProbeScenarios(modelId) {
  const setup = {
    totalSeats: 4,
    opponents: [{ type: 'nn', modelId }, { type: 'nn', modelId }, { type: 'nn', modelId }],
  }
  const initial = createInitialMatchState(setup, { seed: 4242 })
  const seatId = initial.turn.activeSeatId
  const draw = applyAction(initial, { type: 'DRAW' }, { seatId })
  if (!draw.ok) throw new Error('failed to build pending scenario')
  const pending = draw.state
  const dungeon = {
    ...initial,
    phase: 'dungeon',
    turn: { ...initial.turn, activeSeatId: seatId },
    bidding: { ...initial.bidding, runnerSeatId: seatId, dungeonMonsters: ['goblin'] },
    dungeon: {
      ...initial.dungeon,
      subphase: 'pick-fire-axe',
      currentMonster: 'goblin',
      remainingMonsters: ['goblin'],
      hp: 10,
      inPlayEquipmentIds: ['torch', 'sword'],
      axeSpent: false,
      polySpent: false,
    },
  }
  return [
    { name: 'bidding-turn', state: initial, seatId },
    { name: 'bidding-pending', state: pending, seatId },
    { name: 'dungeon-fire-axe-choice', state: dungeon, seatId },
  ]
}

function formatAction(action) {
  if (!action) return 'null'
  if (action.equipmentId) return `${action.type}(${action.equipmentId})`
  if (action.species) return `${action.type}(${action.species})`
  if (action.hero) return `${action.type}(${action.hero})`
  return action.type
}

function getArgValue(argList, name) {
  const index = argList.indexOf(name)
  if (index === -1) return null
  return argList[index + 1] ?? null
}

function cleanup(targetPath) {
  rmSync(targetPath, { recursive: true, force: true })
}
