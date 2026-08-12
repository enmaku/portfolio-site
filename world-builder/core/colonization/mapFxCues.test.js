import assert from 'node:assert/strict'
import test from 'node:test'
import { createControlOverlayRefreshCue, isControlOverlayRefreshCue } from './mapFxCues.js'

test('createControlOverlayRefreshCue and type guard', () => {
  const cue = createControlOverlayRefreshCue({
    epoch: 3,
    phaseId: 'politics',
    primaryClaim: { a: [{ x: 0, y: 0 }] },
  })
  assert.ok(isControlOverlayRefreshCue(cue))
  assert.deepEqual(cue.layers, [
    'factionTerritory',
    'settlementNodes',
    'recentConquestMarkers',
  ])
  assert.equal(isControlOverlayRefreshCue({ type: 'settlement_founded' }), false)
})
