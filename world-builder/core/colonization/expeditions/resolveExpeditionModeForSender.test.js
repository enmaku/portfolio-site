import assert from 'node:assert/strict'
import test from 'node:test'
import {
  listAvailableExpeditionModes,
  resolveExpeditionModeForSender,
} from './resolveExpeditionModeForSender.js'

test('listAvailableExpeditionModes exposes land only for inland settlements', () => {
  assert.deepStrictEqual(
    listAvailableExpeditionModes({
      settlementId: 'inland',
      population: 100,
      maritimeRole: 'none',
      canDispatchLand: true,
      canDispatchMaritime: false,
    }),
    ['land'],
  )
})

test('listAvailableExpeditionModes exposes land and inland sail for river towns', () => {
  assert.deepStrictEqual(
    listAvailableExpeditionModes({
      settlementId: 'river',
      population: 100,
      maritimeRole: 'inland_sail',
      canDispatchLand: true,
      canDispatchMaritime: true,
    }),
    ['land', 'inland_sail'],
  )
})

test('listAvailableExpeditionModes exposes all three modes for port settlements', () => {
  assert.deepStrictEqual(
    listAvailableExpeditionModes({
      settlementId: 'port',
      population: 100,
      maritimeRole: 'port',
      canDispatchLand: true,
      canDispatchMaritime: true,
    }),
    ['land', 'inland_sail', 'open_sea'],
  )
})

test('resolveExpeditionModeForSender uses land when only land is available', () => {
  assert.strictEqual(
    resolveExpeditionModeForSender(
      {
        settlementId: 'inland',
        population: 100,
        maritimeRole: 'none',
        canDispatchLand: true,
        canDispatchMaritime: false,
      },
      () => 0.99,
    ),
    'land',
  )
})

test('resolveExpeditionModeForSender uses inland sail when only maritime is available for river towns', () => {
  assert.strictEqual(
    resolveExpeditionModeForSender(
      {
        settlementId: 'river',
        population: 100,
        maritimeRole: 'inland_sail',
        canDispatchLand: false,
        canDispatchMaritime: true,
      },
      () => 0,
    ),
    'inland_sail',
  )
})

test('resolveExpeditionModeForSender weights open sea more heavily for ports', () => {
  const assignment = {
    settlementId: 'port',
    population: 100,
    maritimeRole: 'port',
    canDispatchLand: true,
    canDispatchMaritime: true,
  }

  assert.strictEqual(resolveExpeditionModeForSender(assignment, () => 0), 'land')
  assert.strictEqual(resolveExpeditionModeForSender(assignment, () => 0.2), 'inland_sail')
  assert.strictEqual(resolveExpeditionModeForSender(assignment, () => 0.4), 'open_sea')
})

test('resolveExpeditionModeForSender weights open sea over inland sail for maritime-only ports', () => {
  const assignment = {
    settlementId: 'port',
    population: 100,
    maritimeRole: 'port',
    canDispatchLand: false,
    canDispatchMaritime: true,
  }

  assert.strictEqual(resolveExpeditionModeForSender(assignment, () => 0.2), 'inland_sail')
  assert.strictEqual(resolveExpeditionModeForSender(assignment, () => 0.5), 'open_sea')
})
