import assert from 'node:assert/strict'
import test from 'node:test'
import { finalizeColonizationMutation } from './finalizeColonizationMutation.js'
import { createInitialEpochStepProgress } from './colonizationEpochProgress.js'

function createFakePorts(overrides = {}) {
  const calls = []
  const baseDocument = 'baseDocument' in overrides ? overrides.baseDocument : { gridWidth: 1, gridHeight: 1 }
  const mergedDocument =
    'mergedDocument' in overrides ? overrides.mergedDocument : { ...baseDocument, merged: true }
  return {
    calls,
    persistSession: () => calls.push('persistSession'),
    getBaseDocument: () => baseDocument,
    rehydrate: () => calls.push('rehydrate'),
    mergeDocument: () => {
      calls.push('mergeDocument')
      return mergedDocument
    },
    applyLayer: (_doc, layerId) => calls.push(`applyLayer:${layerId}`),
    onComplete: () => calls.push('onComplete'),
  }
}

function createProgressHandlers() {
  let progress = createInitialEpochStepProgress()
  return {
    getProgress: () => progress,
    onProgress: (next) => {
      progress = next
    },
    yieldToUi: async () => {},
  }
}

test('finalizeColonizationMutation applies map layers including wealth before settlement pins', async () => {
  const ports = createFakePorts()

  await finalizeColonizationMutation({
    ports,
    reportFinalizeProgress: false,
  })

  assert.deepStrictEqual(ports.calls, [
    'persistSession',
    'rehydrate',
    'mergeDocument',
    'applyLayer:population',
    'applyLayer:routes',
    'applyLayer:wealth',
    'applyLayer:factionTerritory',
    'applyLayer:settlementNodes',
    'applyLayer:settlementIdLabels',
    'applyLayer:recentConquestMarkers',
    'onComplete',
  ])
})

test('finalizeColonizationMutation does not double-persist when both ports and a fallback are supplied', async () => {
  const ports = createFakePorts()
  const fallbackCalls = []

  await finalizeColonizationMutation({
    ports,
    fallbackPersist: () => fallbackCalls.push(true),
    reportFinalizeProgress: false,
  })

  assert.strictEqual(ports.calls.filter((call) => call === 'persistSession').length, 1)
  assert.strictEqual(fallbackCalls.length, 0)
})

test('finalizeColonizationMutation reports finalize progress through handlers when requested', async () => {
  const ports = createFakePorts()
  const handlers = createProgressHandlers()

  await finalizeColonizationMutation({ ports, handlers, reportFinalizeProgress: true })

  assert.strictEqual(ports.calls.filter((call) => call === 'onComplete').length, 1)
  assert.strictEqual(handlers.getProgress().completedFinalizeStepIndex >= 0, true)
})

test('finalizeColonizationMutation uses fallbackPersist exactly once when ports are absent', async () => {
  const fallbackCalls = []

  await finalizeColonizationMutation({
    ports: null,
    fallbackPersist: () => fallbackCalls.push(true),
  })

  assert.strictEqual(fallbackCalls.length, 1)
})

test('finalizeColonizationMutation skips map substeps when no base document is available', async () => {
  const ports = createFakePorts({ baseDocument: null })

  await finalizeColonizationMutation({ ports, reportFinalizeProgress: false })

  assert.deepStrictEqual(ports.calls, ['persistSession'])
})

test('finalizeColonizationMutation skips remaining substeps when merge yields no document', async () => {
  const ports = createFakePorts({ mergedDocument: null })

  await finalizeColonizationMutation({ ports, reportFinalizeProgress: false })

  assert.deepStrictEqual(ports.calls, ['persistSession', 'rehydrate', 'mergeDocument'])
})
