import assert from 'node:assert/strict'
import test from 'node:test'
import { applySettlementMergeTransitions } from './applySettlementMerge.js'
import { createDefaultColonizationSlice } from './createDefaultColonizationSlice.js'

test('applySettlementMergeTransitions transfers population cancels expeditions and logs merge', () => {
  const slice = createDefaultColonizationSlice()
  slice.settlements = [
    { id: 'survivor', status: 'living', tier: 'hamlet', population: 80 },
    { id: 'absorbed', status: 'living', tier: 'outpost', population: 25 },
  ]
  slice.expeditions = [
    {
      id: 'exp-1',
      settlementId: 'absorbed',
      mode: 'land',
      bearing: 0,
      route: [{ x: 1, y: 1 }],
      progressIndex: 0,
      status: 'active',
    },
  ]
  slice.notableFigures = [{ id: 'dyn-1', kind: 'dynasty', settlementId: 'absorbed' }]

  const { slice: merged, events } = applySettlementMergeTransitions({
    slice,
    candidates: [
      {
        survivorSettlementId: 'survivor',
        absorbedSettlementId: 'absorbed',
        path: 'outpost_reabsorption',
      },
    ],
    survivalBySettlementId: {
      survivor: { populationCeiling: 200 },
    },
    epoch: 4,
  })

  assert.strictEqual(merged.settlements[0].population, 105)
  assert.strictEqual(merged.settlements[1].status, 'ruin')
  assert.strictEqual(merged.expeditions[0].status, 'completed')
  assert.strictEqual(merged.notableFigures[0].status, 'absorbed')
  assert.strictEqual(
    merged.historyLog.some((entry) => entry.kind === 'settlement_merged'),
    true,
  )
  assert.strictEqual(
    merged.historyLog.some((entry) => entry.kind === 'settlement_abandoned'),
    false,
  )
  assert.strictEqual(events.length, 1)
})
