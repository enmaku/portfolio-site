import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, it } from 'node:test'
import { applyAction, MATCH_PHASES } from '../engine/kernel.js'
import { bootstrapMatchStateForReplay } from '../debug/replayBootstrap.js'
import { encodeActionIndex } from '../nn/policyAdapter.js'
import { buildMatchOutcomeRecord } from './buildMatchOutcomeRecord.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, 'fixtures')
const PORTFOLIO_SITE_ROOT = resolve(__dirname, '../../../..')

const DUNGEON_RUNNER_ROOT = process.env.DUNGEON_RUNNER_ROOT?.trim() ?? ''
const DERIVE_HARNESS = join(
  DUNGEON_RUNNER_ROOT,
  'src/dungeon_runner/replay/harness/derive_match_outcome.mjs',
)
const REPLAY_TO_MATCH_OVER = join(
  DUNGEON_RUNNER_ROOT,
  'src/dungeon_runner/replay/harness/replay_to_match_over.mjs',
)

const HAS_DUNGEON_RUNNER =
  DUNGEON_RUNNER_ROOT.length > 0 &&
  (() => {
    try {
      readFileSync(DERIVE_HARNESS)
      readFileSync(REPLAY_TO_MATCH_OVER)
      return true
    } catch {
      return false
    }
  })()

const REPLAY_OUTCOME_FIXTURES = readdirSync(FIXTURES_DIR)
  .filter((name) => name.startsWith('replay-envelope-outcome-') && name.endsWith('.json'))
  .sort()

function outcomeVariantFromFixture(name) {
  return name.slice('replay-envelope-outcome-'.length, -'.json'.length)
}

function resolveMatchId(envelope, envelopePath) {
  if (typeof envelope.matchId === 'string' && envelope.matchId.length > 0) {
    return envelope.matchId
  }
  const base = envelopePath.replace(/\\/g, '/').split('/').pop() ?? ''
  const stem = base.replace(/\.json$/i, '')
  if (stem) return stem
  throw new Error('matchId required on envelope or fixture filename')
}

function resolveHumanPlayerSeatId(seats) {
  return seats?.find((seat) => seat.role?.type === 'human')?.id ?? ''
}

async function loadReplayToMatchOver() {
  const mod = await import(pathToFileURL(REPLAY_TO_MATCH_OVER).href)
  return mod.replayEnvelopeToMatchOver
}

function buildLiveOutcomeFromEnvelope(envelope, envelopePath, replayEnvelopeToMatchOver) {
  let state
  try {
    state = bootstrapMatchStateForReplay(envelope.setup, envelope.seed)
  } catch (err) {
    throw new Error(`bootstrap failed: ${err.message}`)
  }

  const replayed = replayEnvelopeToMatchOver(state, envelope, {
    applyAction,
    encodeActionIndex,
    MATCH_PHASES,
  })
  if (!replayed.ok) {
    const { failure } = replayed
    throw new Error(
      `replay failed: ${failure.code}${failure.step !== undefined ? ` step ${failure.step}` : ''}${
        failure.detail ? ` (${failure.detail})` : ''
      }`,
    )
  }

  state = replayed.state
  const seats = state.seats ?? []
  const humanPlayerSeatId = resolveHumanPlayerSeatId(seats)
  if (!humanPlayerSeatId) {
    throw new Error('no human seat in terminal state')
  }

  const createdAt =
    typeof envelope.createdAt === 'string' && envelope.createdAt.length > 0
      ? envelope.createdAt
      : undefined

  return buildMatchOutcomeRecord({
    matchId: resolveMatchId(envelope, envelopePath),
    createdAt,
    setup: envelope.setup,
    state,
    seats,
    humanPlayerSeatId,
    presentationSpeedProfile: envelope.presentationSpeedProfile,
  })
}

function runDeriveHarness(envelopePath) {
  return spawnSync(process.execPath, [DERIVE_HARNESS, envelopePath], {
    encoding: 'utf8',
    env: { ...process.env, PORTFOLIO_SITE_ROOT },
    cwd: DUNGEON_RUNNER_ROOT,
  })
}

describe('match outcome derive parity (portfolio live vs dungeon-runner harness)', {
  skip: HAS_DUNGEON_RUNNER ? false : 'DUNGEON_RUNNER_ROOT unset or invalid',
}, () => {
  for (const fixtureName of REPLAY_OUTCOME_FIXTURES) {
    const variant = outcomeVariantFromFixture(fixtureName)
    const envelopePath = join(FIXTURES_DIR, fixtureName)
    const goldenPath = join(FIXTURES_DIR, `outcome-${variant}.json`)

    it(`live buildMatchOutcomeRecord matches derive_match_outcome for ${variant}`, async () => {
      const envelope = JSON.parse(readFileSync(envelopePath, 'utf8'))
      const replayEnvelopeToMatchOver = await loadReplayToMatchOver()
      const live = buildLiveOutcomeFromEnvelope(envelope, envelopePath, replayEnvelopeToMatchOver)

      const proc = runDeriveHarness(envelopePath)
      assert.equal(proc.status, 0, proc.stderr || proc.stdout)
      const derived = JSON.parse(proc.stdout.trim())
      assert.deepEqual(live, derived)

      const golden = JSON.parse(readFileSync(goldenPath, 'utf8'))
      assert.deepEqual(live, golden)
    })
  }
})
