import assert from 'node:assert/strict'
import test from 'node:test'
import { createPresentationOrchestrator } from './presentationOrchestrator.js'
import { runPresentationIntervalTick } from './dungeonRunnerPresentationInterval.js'

test('presentation interval tick runs hooks after advance in order', () => {
  const orchestrator = createPresentationOrchestrator()
  const log = []
  runPresentationIntervalTick(orchestrator, 50, {
    syncPresentationLabel: () => log.push('sync'),
    scheduleAiTurnIfReady: () => log.push('ai'),
    scheduleHumanAutoResolveIfReady: () => log.push('human'),
  })
  assert.deepEqual(log, ['sync', 'ai', 'human'])
})

test('human auto-resolve hook can run when gameplay lock clears after queue drains', () => {
  const orchestrator = createPresentationOrchestrator()
  orchestrator.enqueueEngineTransition({
    phaseBefore: 'bidding',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-a',
    turnAfterSeatId: 'seat-b',
    dungeonRunResult: null,
  })
  let armed = false
  function scheduleHumanAutoResolveIfReady() {
    if (orchestrator.isGameplayInputLocked()) return
    armed = true
  }
  runPresentationIntervalTick(orchestrator, 50, {
    syncPresentationLabel: () => {},
    scheduleAiTurnIfReady: () => {},
    scheduleHumanAutoResolveIfReady,
  })
  assert.equal(armed, false)
  const totalRemaining = orchestrator.getQueueSnapshot().reduce((sum, item) => sum + item.remainingMs, 0)
  orchestrator.advance(totalRemaining)
  assert.equal(orchestrator.isGameplayInputLocked(), false)
  armed = false
  runPresentationIntervalTick(orchestrator, 50, {
    syncPresentationLabel: () => {},
    scheduleAiTurnIfReady: () => {},
    scheduleHumanAutoResolveIfReady,
  })
  assert.equal(armed, true)
})
