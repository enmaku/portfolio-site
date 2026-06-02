import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isEquipmentModalActionsDisabled,
  isHumanGameplayBlocked,
  shouldRejectEquipmentTokenTap,
} from './humanGameplayGate.js'

test('human gameplay is blocked while outcome dialog, headless completion, or refresh terminal is open', () => {
  assert.equal(
    isHumanGameplayBlocked({
      dungeonOutcomeDialogOpen: true,
    }),
    true,
  )
  assert.equal(
    isHumanGameplayBlocked({
      headlessCompletionInFlight: true,
    }),
    true,
  )
  assert.equal(
    isHumanGameplayBlocked({
      neuralRefreshTerminalOpen: true,
    }),
    true,
  )
  assert.equal(isHumanGameplayBlocked({}), false)
})

test('human gameplay is not blocked by nn recovery coordinator state alone', () => {
  assert.equal(
    isHumanGameplayBlocked({
      gameplayInputLocked: false,
      dungeonOutcomeDialogOpen: false,
      headlessCompletionInFlight: false,
      neuralRefreshTerminalOpen: false,
    }),
    false,
  )
})

test('equipment modal actions respect human gameplay block and turn ownership', () => {
  assert.equal(
    isEquipmentModalActionsDisabled({ humanGameplayBlocked: true, isHumanTurn: true }),
    true,
  )
  assert.equal(
    isEquipmentModalActionsDisabled({ humanGameplayBlocked: false, isHumanTurn: false }),
    true,
  )
  assert.equal(
    isEquipmentModalActionsDisabled({ humanGameplayBlocked: false, isHumanTurn: true }),
    false,
  )
})

test('equipment token tap is rejected when gameplay is blocked', () => {
  assert.equal(shouldRejectEquipmentTokenTap({ hasModal: true, humanGameplayBlocked: true }), true)
  assert.equal(shouldRejectEquipmentTokenTap({ hasModal: false, humanGameplayBlocked: false }), true)
  assert.equal(shouldRejectEquipmentTokenTap({ hasModal: true, humanGameplayBlocked: false }), false)
})
