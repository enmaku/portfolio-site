import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope } from 'vue'
import { useWorldBuilderLlmSettlementNames } from './useWorldBuilderLlmSettlementNames.js'
import { createDefaultColonizationSlice } from '../../world-builder/core/colonization/createDefaultColonizationSlice.js'

function createViewportSpy() {
  /** @type {Record<string, string>} */
  let settlements = {}
  /** @type {Record<string, string>} */
  let factions = {}
  let regionName = ''
  let visible = false
  /** @type {Function | null} */
  let editHandler = null
  return {
    get settlements() {
      return settlements
    },
    get factions() {
      return factions
    },
    get regionName() {
      return regionName
    },
    get visible() {
      return visible
    },
    get editHandler() {
      return editHandler
    },
    onCustomNameEdit(handler) {
      editHandler = handler
    },
    setCustomSettlementNames(namesById) {
      settlements = { ...namesById }
    },
    setCustomFactionNames(namesById) {
      factions = { ...namesById }
    },
    setCustomRegionName(name) {
      regionName = name
    },
    setCustomSettlementNameHighlights() {},
    setCustomSettlementNamesVisible(next) {
      visible = next === true
    },
  }
}

function mountNames(scope, overrides = {}) {
  const viewport = overrides.viewport ?? createViewportSpy()
  const slice = createDefaultColonizationSlice()
  slice.settlements = [
    { id: 's1', mapNumber: 1, x: 1, y: 1, status: 'living', population: 10 },
  ]
  const generateCalls = []
  const ctx = scope.run(() =>
    useWorldBuilderLlmSettlementNames({
      getSlice: () => slice,
      getWorldDocument: () => ({
        gridWidth: 8,
        gridHeight: 8,
        settlements: slice.settlements,
        factions: [],
      }),
      getViewport: () => viewport,
      canGenerate: () => true,
      isOtherWorkBusy: () => false,
      generateNames: async (options) => {
        generateCalls.push(options)
        return {
          settlements: { s1: 'Valen', ...(options.catalog?.settlements ?? {}) },
          factions: { ...(options.catalog?.factions ?? {}) },
          regionName: options.catalog?.regionName || 'The Reach',
          overview: 'Overview.',
          notableSettlements: [],
          factionProfiles: [],
          writeupSettlementIds: ['s1'],
          regionWriteup: 'Writeup',
          generationMode: 'empty',
        }
      },
      buildContextMapJpegs: async () => [],
      ...overrides,
    }),
  )
  return { ctx, viewport, generateCalls }
}

test('saveNameEditor writes a settlement name and syncs the viewport', () => {
  const scope = effectScope(true)
  try {
    const { ctx, viewport } = mountNames(scope)
    ctx.openNameEditor({ kind: 'settlement', id: 's1' })
    ctx.nameEditorDraft.value = 'Valen'
    ctx.saveNameEditor()
    assert.equal(ctx.namesBySettlementId.value.s1, 'Valen')
    assert.equal(viewport.settlements.s1, 'Valen')
    assert.equal(ctx.nameEditorOpen.value, false)
  } finally {
    scope.stop()
  }
})

test('clearNameEditor removes a name and leaves the overlay visible', () => {
  const scope = effectScope(true)
  try {
    const { ctx, viewport } = mountNames(scope)
    ctx.namesBySettlementId.value = { s1: 'Valen' }
    ctx.namesOverlayVisible.value = true
    ctx.openNameEditor({ kind: 'settlement', id: 's1' })
    ctx.clearNameEditor()
    assert.equal(ctx.namesBySettlementId.value.s1, undefined)
    assert.equal(viewport.settlements.s1, undefined)
    assert.equal(ctx.namesOverlayVisible.value, true)
  } finally {
    scope.stop()
  }
})

test('resetAllNames clears catalog, writeup, and viewport names', () => {
  const scope = effectScope(true)
  try {
    const { ctx, viewport } = mountNames(scope)
    ctx.namesBySettlementId.value = { s1: 'Valen' }
    ctx.namesByFactionId.value = { f1: 'House Karn' }
    ctx.regionName.value = 'The Reach'
    ctx.regionWriteup.value = 'Writeup'
    ctx.namesOverlayVisible.value = true
    ctx.syncNamesToViewport()
    ctx.resetAllNames()
    assert.deepEqual(ctx.namesBySettlementId.value, {})
    assert.deepEqual(ctx.namesByFactionId.value, {})
    assert.equal(ctx.regionName.value, '')
    assert.equal(ctx.regionWriteup.value, '')
    assert.deepEqual(viewport.settlements, {})
    assert.equal(viewport.regionName, '')
  } finally {
    scope.stop()
  }
})

test('generateSettlementNames passes the current catalog and keeps provided names', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, generateCalls } = mountNames(scope)
    ctx.namesBySettlementId.value = { s1: 'KeepMe' }
    ctx.regionName.value = 'The Reach'
    await ctx.generateSettlementNames()
    assert.equal(generateCalls.length, 1)
    assert.equal(generateCalls[0].catalog.settlements.s1, 'KeepMe')
    assert.equal(ctx.namesBySettlementId.value.s1, 'KeepMe')
    assert.equal(ctx.regionName.value, 'The Reach')
    assert.equal(ctx.regionWriteup.value, 'Writeup')
  } finally {
    scope.stop()
  }
})
