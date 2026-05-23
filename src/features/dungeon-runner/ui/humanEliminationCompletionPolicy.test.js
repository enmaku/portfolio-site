import assert from 'node:assert/strict'
import test from 'node:test'
import { MATCH_PHASES } from '../engine/kernel.js'
import {
  getMatchOverEndDialogVariant,
  isHumanEliminated,
  MATCH_OVER_END_VARIANTS,
  needsHeadlessCompletion,
} from './humanEliminationCompletionPolicy.js'

test('isHumanEliminated is false when human seat has lives remaining', () => {
  assert.equal(
    isHumanEliminated(
      {
        scoreboard: {
          'seat-1': { lives: 2, eliminated: false },
        },
      },
      'seat-1',
    ),
    false,
  )
})

test('needsHeadlessCompletion is true when human is eliminated before match over', () => {
  assert.equal(
    needsHeadlessCompletion(
      {
        phase: MATCH_PHASES.PICK_ADVENTURER,
        scoreboard: { 'seat-1': { eliminated: true } },
      },
      'seat-1',
    ),
    true,
  )
})

test('getMatchOverEndDialogVariant is defeat-not-eliminated when human lost with lives left', () => {
  assert.equal(
    getMatchOverEndDialogVariant(
      {
        phase: MATCH_PHASES.MATCH_OVER,
        matchWinnerSeatId: 'seat-2',
        scoreboard: {
          'seat-1': { eliminated: false, lives: 1 },
          'seat-2': { eliminated: false },
        },
      },
      'seat-1',
    ),
    MATCH_OVER_END_VARIANTS.DEFEAT_NOT_ELIMINATED,
  )
})

test('getMatchOverEndDialogVariant is elimination-end-human when human was eliminated', () => {
  assert.equal(
    getMatchOverEndDialogVariant(
      {
        phase: MATCH_PHASES.MATCH_OVER,
        matchWinnerSeatId: 'seat-2',
        scoreboard: {
          'seat-1': { eliminated: true, lives: 0 },
          'seat-2': { eliminated: false },
        },
      },
      'seat-1',
    ),
    MATCH_OVER_END_VARIANTS.ELIMINATION_END_HUMAN,
  )
})

test('getMatchOverEndDialogVariant is victory when human seat won match over', () => {
  assert.equal(
    getMatchOverEndDialogVariant(
      {
        phase: MATCH_PHASES.MATCH_OVER,
        matchWinnerSeatId: 'seat-1',
        scoreboard: { 'seat-1': { eliminated: false } },
      },
      'seat-1',
    ),
    MATCH_OVER_END_VARIANTS.VICTORY,
  )
})

test('needsHeadlessCompletion is false at match over even if human was eliminated', () => {
  assert.equal(
    needsHeadlessCompletion(
      {
        phase: MATCH_PHASES.MATCH_OVER,
        scoreboard: { 'seat-1': { eliminated: true } },
      },
      'seat-1',
    ),
    false,
  )
})

test('isHumanEliminated is true when human seat scoreboard entry is eliminated', () => {
  assert.equal(
    isHumanEliminated(
      {
        scoreboard: {
          'seat-1': { lives: 0, eliminated: true },
        },
      },
      'seat-1',
    ),
    true,
  )
})
