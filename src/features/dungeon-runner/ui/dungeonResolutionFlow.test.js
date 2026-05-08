import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDungeonOutcomeTransitionControls,
  dungeonStageClassForKind,
  shouldExecuteScheduledAutoResolve,
  shouldAutoResolveDungeonAdvance,
} from './dungeonResolutionFlow.js'

test('maps dungeon orchestrator kinds to stage animation classes', () => {
  assert.equal(dungeonStageClassForKind('DUNGEON_REVEAL'), 'dr-dungeon-stage--reveal')
  assert.equal(dungeonStageClassForKind('DUNGEON_NEUTRALIZE'), 'dr-dungeon-stage--strike dr-dungeon-stage--consume')
  assert.equal(dungeonStageClassForKind('DUNGEON_DAMAGE'), 'dr-dungeon-stage--hit')
  assert.equal(dungeonStageClassForKind('DUNGEON_CONTINUE'), 'dr-dungeon-stage--consume')
  assert.equal(dungeonStageClassForKind('TURN_ADVANCE'), '')
})

test('reveal/continue is never timer auto-advanced so each step stays player-paced', () => {
  assert.equal(
    shouldAutoResolveDungeonAdvance({
      phase: 'dungeon',
      isHumanTurn: true,
      gameplayInputLocked: false,
      legalActions: [{ type: 'REVEAL_OR_CONTINUE' }],
      autoAdvanceAction: { type: 'REVEAL_OR_CONTINUE' },
      resolutionStatus: 'auto-resolved',
      activeAnimationKind: null,
    }),
    false,
  )

  assert.equal(
    shouldAutoResolveDungeonAdvance({
      phase: 'dungeon',
      isHumanTurn: true,
      gameplayInputLocked: false,
      legalActions: [{ type: 'REVEAL_OR_CONTINUE' }],
      autoAdvanceAction: { type: 'REVEAL_OR_CONTINUE' },
      resolutionStatus: 'waiting-for-choice',
      activeAnimationKind: null,
    }),
    false,
  )

  assert.equal(
    shouldAutoResolveDungeonAdvance({
      phase: 'dungeon',
      isHumanTurn: true,
      gameplayInputLocked: false,
      legalActions: [{ type: 'REVEAL_OR_CONTINUE' }],
      autoAdvanceAction: { type: 'REVEAL_OR_CONTINUE' },
      resolutionStatus: 'auto-resolved',
      activeAnimationKind: 'DUNGEON_OUTCOME',
    }),
    false,
  )
})

test('scheduled auto-resolve callback re-checks readiness and legal action', () => {
  assert.equal(
    shouldExecuteScheduledAutoResolve({
      phase: 'dungeon',
      isHumanTurn: true,
      gameplayInputLocked: false,
      equipmentModalOpen: false,
      autoAdvanceAction: { type: 'REVEAL_OR_CONTINUE' },
      legalActions: [{ type: 'REVEAL_OR_CONTINUE' }],
      resolutionStatus: 'auto-resolved',
      activeAnimationKind: null,
    }),
    false,
  )

  assert.equal(
    shouldExecuteScheduledAutoResolve({
      phase: 'dungeon',
      isHumanTurn: true,
      gameplayInputLocked: false,
      equipmentModalOpen: true,
      autoAdvanceAction: { type: 'REVEAL_OR_CONTINUE' },
      legalActions: [{ type: 'REVEAL_OR_CONTINUE' }],
      resolutionStatus: 'auto-resolved',
      activeAnimationKind: null,
    }),
    false,
  )

  assert.equal(
    shouldExecuteScheduledAutoResolve({
      phase: 'dungeon',
      isHumanTurn: true,
      gameplayInputLocked: false,
      equipmentModalOpen: false,
      autoAdvanceAction: { type: 'REVEAL_OR_CONTINUE' },
      legalActions: [{ type: 'DECLINE_FIRE_AXE' }],
      resolutionStatus: 'auto-resolved',
      activeAnimationKind: null,
    }),
    false,
  )
})

test('renders explicit outcome transition control only when dungeon auto-resolves', () => {
  assert.deepEqual(
    buildDungeonOutcomeTransitionControls({
      phase: 'dungeon',
      gameplayInputLocked: false,
      resolutionStatus: 'auto-resolved',
      autoAdvanceAction: { type: 'REVEAL_OR_CONTINUE' },
    }),
    [
      {
        key: 'transition-REVEAL_OR_CONTINUE',
        label: 'Continue',
        action: { type: 'REVEAL_OR_CONTINUE' },
      },
    ],
  )

  assert.deepEqual(
    buildDungeonOutcomeTransitionControls({
      phase: 'dungeon',
      gameplayInputLocked: true,
      resolutionStatus: 'auto-resolved',
      autoAdvanceAction: { type: 'REVEAL_OR_CONTINUE' },
    }),
    [],
  )
})
