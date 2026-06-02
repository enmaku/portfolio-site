import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { ACTION_TYPES, MATCH_PHASES } from '../engine/kernel.js'
import { MATCH_OVER_END_VARIANTS } from '../ui/humanEliminationCompletionPolicy.js'
import { buildMatchOutcomeRecord, MATCH_OUTCOME_SCHEMA_VERSION } from './buildMatchOutcomeRecord.js'
import { countEquipmentSacrifices, parseMatchIdEpochMs } from './matchOutcomeRollups.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, 'fixtures')

const CREATED_AT = '2026-05-27T12:00:00.000Z'

const REQUIRED_OUTCOME_KEYS = [
  'outcomeSchemaVersion',
  'matchId',
  'createdAt',
  'setup',
  'seats',
  'humanWon',
  'endVariant',
  'humanPlayerSeatId',
  'matchWinnerSeatId',
  'humanEliminated',
  'winnerRole',
  'scoreboard',
  'opponentModelIds',
  'opponentCountByType',
  'historyStepCount',
  'historyActionStepCount',
  'historyStepsBySeatRole',
  'historyModelIds',
  'finalRngStep',
  'equipmentSacrificeCount',
  'matchIdEpochMs',
]

const GOLDEN_FIXTURE_NAMES = [
  'outcome-victory.json',
  'outcome-defeat-not-eliminated.json',
  'outcome-elimination-end-human.json',
]

const BASE_SETUP = {
  totalSeats: 4,
  opponents: [
    { type: 'nn', modelId: 'nn-v1.0.0' },
    { type: 'randombot' },
    { type: 'nn', modelId: 'nn-v2.0.0' },
  ],
}

const BASE_SEATS = [
  { id: 'seat-1', label: 'You', role: { type: 'human' } },
  { id: 'seat-2', label: 'Bot A', role: { type: 'nn', modelId: 'nn-v1.0.0' } },
  { id: 'seat-3', label: 'Bot B', role: { type: 'randombot' } },
  { id: 'seat-4', label: 'Bot C', role: { type: 'nn', modelId: 'nn-v2.0.0' } },
]

function historyWithSacrifices(sacrificeCount, extra = []) {
  const sacrifices = Array.from({ length: sacrificeCount }, (_, index) => ({
    action: { type: ACTION_TYPES.SACRIFICE, equipmentId: `W_EQ_${index}` },
    actorSeatId: 'seat-1',
    rngStepBefore: index,
    rngStepAfter: index + 1,
  }))
  let step = sacrificeCount
  return [
    ...sacrifices,
    ...extra.map((entry) => {
      const before = step
      step += 1
      return {
        rngStepBefore: before,
        rngStepAfter: step,
        ...entry,
      }
    }),
  ]
}

function buildFixtureInput(variantKey) {
  if (variantKey === 'victory') {
    return {
      matchId: 'match-1716811200000',
      createdAt: CREATED_AT,
      setup: BASE_SETUP,
      seats: BASE_SEATS,
      humanPlayerSeatId: 'seat-1',
      presentationSpeedProfile: 'brisk',
      state: {
        phase: MATCH_PHASES.MATCH_OVER,
        matchWinnerSeatId: 'seat-1',
        scoreboard: {
          'seat-1': { successes: 2, lives: 2, eliminated: false },
          'seat-2': { successes: 0, lives: 1, eliminated: false },
          'seat-3': { successes: 1, lives: 0, eliminated: true },
          'seat-4': { successes: 0, lives: 2, eliminated: false },
        },
        history: historyWithSacrifices(2, [
          {
            action: { type: ACTION_TYPES.PASS, modelId: 'nn-v1.0.0' },
            actorSeatId: 'seat-2',
          },
          {
            action: { type: ACTION_TYPES.DRAW },
            actorSeatId: 'seat-3',
          },
          {
            action: { type: ACTION_TYPES.PASS },
            actorSeatId: 'seat-1',
          },
        ]),
      },
    }
  }

  if (variantKey === 'defeat-not-eliminated') {
    return {
      matchId: 'match-not-numeric',
      createdAt: CREATED_AT,
      setup: BASE_SETUP,
      seats: BASE_SEATS,
      humanPlayerSeatId: 'seat-1',
      state: {
        phase: MATCH_PHASES.MATCH_OVER,
        matchWinnerSeatId: 'seat-2',
        scoreboard: {
          'seat-1': { successes: 1, lives: 1, eliminated: false },
          'seat-2': { successes: 2, lives: 2, eliminated: false },
          'seat-3': { successes: 0, lives: 0, eliminated: true },
          'seat-4': { successes: 0, lives: 2, eliminated: false },
        },
        history: historyWithSacrifices(1, [
          {
            action: { type: ACTION_TYPES.PASS },
            actorSeatId: 'seat-2',
          },
          {
            action: { type: ACTION_TYPES.PASS },
            actorSeatId: 'seat-4',
          },
        ]),
      },
    }
  }

  return {
    matchId: 'match-1716900000000',
    createdAt: CREATED_AT,
    setup: BASE_SETUP,
    seats: BASE_SEATS,
    humanPlayerSeatId: 'seat-1',
    state: {
      phase: MATCH_PHASES.MATCH_OVER,
      matchWinnerSeatId: 'seat-2',
      scoreboard: {
        'seat-1': { successes: 0, lives: 0, eliminated: true },
        'seat-2': { successes: 2, lives: 2, eliminated: false },
        'seat-3': { successes: 1, lives: 1, eliminated: false },
        'seat-4': { successes: 0, lives: 2, eliminated: false },
      },
      history: historyWithSacrifices(3, [
        {
          action: { type: ACTION_TYPES.PASS },
          actorSeatId: 'seat-2',
        },
      ]),
    },
  }
}

function readGoldenFixture(name) {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8'))
}

test('parseMatchIdEpochMs parses match-{digits} ids', () => {
  assert.equal(parseMatchIdEpochMs('match-1716811200000'), 1716811200000)
  assert.equal(parseMatchIdEpochMs('match-not-numeric'), null)
  assert.equal(parseMatchIdEpochMs('other-123'), null)
})

test('countEquipmentSacrifices counts SACRIFICE actions only', () => {
  const history = historyWithSacrifices(2, [{ action: { type: ACTION_TYPES.PASS }, actorSeatId: 'seat-1' }])
  assert.equal(countEquipmentSacrifices(history), 2)
})

test('outcome-victory golden fixture', () => {
  const golden = readGoldenFixture('outcome-victory.json')

  assert.equal(golden.humanWon, true)
  assert.equal(golden.endVariant, MATCH_OVER_END_VARIANTS.VICTORY)
  assert.equal(golden.matchIdEpochMs, 1716811200000)
  assert.equal(golden.presentationSpeedProfile, 'brisk')
  assert.equal(golden.outcomeSchemaVersion, MATCH_OUTCOME_SCHEMA_VERSION)
  assert.equal(golden.matchWinnerSeatId, golden.humanPlayerSeatId)
})

test('outcome-defeat-not-eliminated golden fixture', () => {
  const golden = readGoldenFixture('outcome-defeat-not-eliminated.json')

  assert.equal(golden.humanWon, false)
  assert.equal(golden.endVariant, MATCH_OVER_END_VARIANTS.DEFEAT_NOT_ELIMINATED)
  assert.equal(golden.matchIdEpochMs, null)
  assert.equal('presentationSpeedProfile' in golden, false)
  assert.equal(golden.humanEliminated, false)
})

test('outcome-elimination-end-human golden fixture', () => {
  const golden = readGoldenFixture('outcome-elimination-end-human.json')

  assert.equal(golden.humanWon, false)
  assert.equal(golden.endVariant, MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN)
  assert.equal(golden.humanEliminated, true)
  assert.equal(golden.winnerRole.type, 'nn')
  assert.equal(golden.winnerRole.modelId, 'nn-v1.0.0')
})

test('humanWon is true only when endVariant is victory', () => {
  for (const key of ['victory', 'defeat-not-eliminated', 'elimination-end-human']) {
    const outcome = buildMatchOutcomeRecord(buildFixtureInput(key))
    assert.equal(outcome.humanWon, outcome.endVariant === MATCH_OVER_END_VARIANTS.VICTORY)
  }
})

test('buildMatchOutcomeRecord uses caller createdAt without inventing timestamp', () => {
  const createdAt = '2020-01-01T00:00:00.000Z'
  const outcome = buildMatchOutcomeRecord({
    ...buildFixtureInput('victory'),
    createdAt,
  })
  assert.equal(outcome.createdAt, createdAt)
})

test('buildMatchOutcomeRecord omits replay envelope seed and version', () => {
  for (const key of ['victory', 'defeat-not-eliminated', 'elimination-end-human']) {
    const outcome = buildMatchOutcomeRecord(buildFixtureInput(key))
    assert.equal('seed' in outcome, false)
    assert.equal('version' in outcome, false)
  }
})

test('golden fixtures document CONTRACT v1 required fields without replay envelope keys', () => {
  for (const name of GOLDEN_FIXTURE_NAMES) {
    const golden = readGoldenFixture(name)
    for (const key of REQUIRED_OUTCOME_KEYS) {
      assert.ok(key in golden, `${name} missing ${key}`)
    }
    assert.equal('seed' in golden, false)
    assert.equal('version' in golden, false)
  }
})
