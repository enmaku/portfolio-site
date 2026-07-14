import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildColonizationSimStatus,
  buildFoundingChronicle,
  shouldShowSimStatusPanel,
  shouldShowValidationAdvisory,
} from './buildColonizationSimStatus.js'
import { createDefaultColonizationSlice } from './createDefaultColonizationSlice.js'

test('buildColonizationSimStatus reports epoch, settlements, expeditions, frontier flag', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 3
  slice.settlements = [
    { id: 'a', status: 'living', population: 10 },
    { id: 'b', status: 'ruin', population: 0 },
  ]
  slice.expeditions = [{ id: 'e1', settlementId: 'a', status: 'active', mode: 'land', route: [], progressIndex: 0, target: { x: 0, y: 0 } }]
  slice.frontierExhausted = true

  const status = buildColonizationSimStatus(slice)
  assert.strictEqual(status.epoch, 3)
  assert.strictEqual(status.livingSettlementCount, 1)
  assert.strictEqual(status.activeExpeditionCount, 1)
  assert.strictEqual(status.frontierExhausted, true)
})

test('buildFoundingChronicle filters founding-related history kinds', () => {
  const slice = createDefaultColonizationSlice()
  slice.historyLog = [
    { kind: 'founding', epoch: 0 },
    { kind: 'settlement_founded', epoch: 2, settlementId: 's2' },
    { kind: 'settlement_abandoned', epoch: 3, settlementId: 's3' },
    { kind: 'settlement_merged', epoch: 4, settlementId: 'survivor' },
    { kind: 'other', epoch: 1 },
  ]
  const chronicle = buildFoundingChronicle(slice)
  assert.strictEqual(chronicle.length, 3)
  assert.strictEqual(chronicle[1].settlementId, 's2')
  assert.strictEqual(chronicle[2].kind, 'settlement_abandoned')
})

test('shouldShowSimStatusPanel after epoch 0 only in running phase', () => {
  assert.strictEqual(shouldShowSimStatusPanel('running', 1), true)
  assert.strictEqual(shouldShowSimStatusPanel('running', 0), false)
  assert.strictEqual(shouldShowSimStatusPanel('setup', 0), false)
})

test('shouldShowValidationAdvisory hides after epoch 0 in running', () => {
  assert.strictEqual(shouldShowValidationAdvisory('running', 0, 1), true)
  assert.strictEqual(shouldShowValidationAdvisory('running', 1, 1), false)
})
