import assert from 'node:assert/strict'
import test from 'node:test'
import { MATCH_PHASES } from '../engine/kernel.js'
import { createNeuralRuntimeRecoveryCoordinator } from '../nn/recovery.js'
import {
  buildLiveAiTurnPipelineGateInputs,
  evaluateLiveAiTurnPipelineGateForContext,
} from './liveAiTurnPipelineGateContext.js'

const matchState = {
  phase: MATCH_PHASES.BIDDING,
  turn: { activeSeatId: 'seat-2' },
  seats: [
    { id: 'seat-1', role: { type: 'human' } },
    { id: 'seat-2', role: { type: 'nn', modelId: 'latest' } },
  ],
}

test('buildLiveAiTurnPipelineGateInputs derives active seat recovery blockers', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  recovery.beginRecovery('latest')

  const inputs = buildLiveAiTurnPipelineGateInputs({
    matchState,
    humanSeatId: 'seat-1',
    hasMatch: true,
    isHumanTurn: false,
    recovery,
    runToken: 'token-1',
  })

  assert.equal(inputs.blockForRecovery, true)
  assert.equal(inputs.modelRecovering, true)
  assert.equal(inputs.seatId, 'seat-2')
  assert.equal(inputs.roleType, 'nn')
})

test('evaluateLiveAiTurnPipelineGateForContext allows prefetch while schedule blocked for recovery', () => {
  const recovery = createNeuralRuntimeRecoveryCoordinator()
  recovery.beginRecovery('latest')

  const gate = evaluateLiveAiTurnPipelineGateForContext({
    matchState,
    humanSeatId: 'seat-1',
    hasMatch: true,
    isHumanTurn: false,
    recovery,
    runToken: 'token-1',
  })

  assert.equal(gate.maySchedule, false)
  assert.equal(gate.scheduleSkipReason, 'model-recovering')
  assert.equal(gate.mayPrefetch, true)
  assert.equal(gate.prefetchSkipReason, null)
})
