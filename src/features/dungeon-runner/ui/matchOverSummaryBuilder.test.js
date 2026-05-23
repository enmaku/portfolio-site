import assert from 'node:assert/strict'
import test from 'node:test'
import { MATCH_PHASES } from '../engine/kernel.js'
import { MATCH_OVER_END_VARIANTS } from './humanEliminationCompletionPolicy.js'
import { buildMatchOverSummary } from './matchOverSummaryBuilder.js'

test('buildMatchOverSummary uses victory variant with winner row for human winner', () => {
  const summary = buildMatchOverSummary({
    state: {
      phase: MATCH_PHASES.MATCH_OVER,
      matchWinnerSeatId: 'seat-1',
      scoreboard: { 'seat-1': { eliminated: false } },
    },
    humanPlayerSeatId: 'seat-1',
    seats: [{ id: 'seat-1', label: 'You' }],
  })

  assert.equal(summary.variant, MATCH_OVER_END_VARIANTS.VICTORY)
  assert.equal(summary.showWinner, true)
  assert.equal(summary.winnerLabel, 'You')
})

test('buildMatchOverSummary uses defeat-not-eliminated variant with opponent winner label', () => {
  const summary = buildMatchOverSummary({
    state: {
      phase: MATCH_PHASES.MATCH_OVER,
      matchWinnerSeatId: 'seat-2',
      scoreboard: {
        'seat-1': { eliminated: false, lives: 1 },
        'seat-2': { eliminated: false },
      },
    },
    humanPlayerSeatId: 'seat-1',
    seats: [
      { id: 'seat-1', label: 'You' },
      { id: 'seat-2', label: 'Bot A' },
    ],
  })

  assert.equal(summary.variant, MATCH_OVER_END_VARIANTS.DEFEAT_NOT_ELIMINATED)
  assert.equal(summary.showWinner, true)
  assert.equal(summary.winnerLabel, 'Bot A')
})

test('buildMatchOverSummary uses elimination-end-human variant without winner row', () => {
  const summary = buildMatchOverSummary({
    state: {
      phase: MATCH_PHASES.MATCH_OVER,
      matchWinnerSeatId: 'seat-2',
      scoreboard: {
        'seat-1': { eliminated: true },
        'seat-2': { eliminated: false },
      },
    },
    humanPlayerSeatId: 'seat-1',
    seats: [
      { id: 'seat-1', label: 'You' },
      { id: 'seat-2', label: 'Bot A' },
    ],
  })

  assert.equal(summary.variant, MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN)
  assert.equal(summary.showWinner, false)
  assert.equal(summary.winnerLabel, null)
  assert.equal(typeof summary.title, 'string')
  assert.equal(typeof summary.message, 'string')
})
