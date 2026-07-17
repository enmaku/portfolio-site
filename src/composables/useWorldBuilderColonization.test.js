import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope } from 'vue'
import {
  COLONIZATION_PHASE_RUNNING,
  COLONIZATION_PHASE_SETUP,
  COLONIZATION_PHASE_TERRAIN,
  createDefaultColonistSettings,
  createDefaultColonizationSlice,
  resolveColonizationSlice,
} from '../../world-builder/core/colonization/createDefaultColonizationSlice.js'
import { useWorldBuilderColonization } from './useWorldBuilderColonization.js'
import { coastalLandmassDocument, rejectingLandmassDocument } from './worldBuilderColonizationTestFixtures.js'

function createFakeSettingsStore(initial = {}) {
  const store = {
    colonizationSession: createDefaultColonizationSlice(),
    setColonizationSession(slice) {
      this.colonizationSession = resolveColonizationSlice(slice)
    },
    ...initial,
  }
  return store
}

/** Captures viewport interactions so tests can assert map wiring without a real renderer. */
function createFakeViewport() {
  const landingMarkers = []
  const haulShedPreviews = []
  const placementModes = []
  /** @type {((cell: { x: number, y: number }) => void) | null} */
  let cellPickHandler = null
  /** @type {((payload: { settlementId: string, clientX: number, clientY: number } | null) => void) | null} */
  let settlementHoverHandler = null
  return {
    landingMarkers,
    haulShedPreviews,
    placementModes,
    triggerCellPick(cell) {
      cellPickHandler?.(cell)
    },
    triggerSettlementHover(payload) {
      settlementHoverHandler?.(payload)
    },
    handle: {
      setLandingPlacementMode(enabled) {
        placementModes.push(enabled)
      },
      setFoundingLandingMarker(marker) {
        landingMarkers.push(marker)
      },
      setHaulShedPreviewCells(cells) {
        haulShedPreviews.push(cells)
      },
      onCellPick(handler) {
        cellPickHandler = handler
      },
      onSettlementHover(handler) {
        settlementHoverHandler = handler
      },
    },
  }
}

/**
 * @param {import('vue').EffectScope} scope
 */
function mountColonization(scope, overrides = {}) {
  const settingsStore = overrides.settingsStore ?? createFakeSettingsStore()
  const viewport = overrides.viewport ?? createFakeViewport()
  const confirmCalls = []
  const sliceChangedCalls = []
  const sessionPersistCalls = []
  let geographyDocument = overrides.geographyDocument ?? null

  const ctx = scope.run(() =>
    useWorldBuilderColonization({
      settingsStore,
      requestConfirm:
        overrides.requestConfirm ??
        (async () => {
          confirmCalls.push(true)
          return true
        }),
      getViewport: overrides.getViewport ?? (() => viewport.handle),
      getGeographyDocument: () => geographyDocument,
      onSliceChanged: () => sliceChangedCalls.push(true),
      colonizationMapPorts: overrides.colonizationMapPorts,
      onSessionPersistRequested: () => sessionPersistCalls.push(true),
      getSessionRestorePending: overrides.getSessionRestorePending,
    }),
  )

  return {
    ctx,
    settingsStore,
    viewport,
    confirmCalls,
    sliceChangedCalls,
    sessionPersistCalls,
    setGeographyDocument(doc) {
      geographyDocument = doc
    },
  }
}

test('enterColonizationSetup moves to setup when a landmass exists', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, settingsStore, viewport } = mountColonization(scope)

    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_TERRAIN)

    const entered = await ctx.enterColonizationSetup(true)

    assert.strictEqual(entered, true)
    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_SETUP)
    assert.strictEqual(ctx.showTerrainAuthoringControls.value, false)
    assert.strictEqual(ctx.isTerrainLocked.value, true)
    assert.strictEqual(ctx.showColonistSettingsPanel.value, true)
    assert.strictEqual(settingsStore.colonizationSession.colonizationPhase, COLONIZATION_PHASE_SETUP)
    assert.ok(viewport.placementModes.includes(true))
  } finally {
    scope.stop()
  }
})

test('enterColonizationSetup is a no-op without a landmass', async () => {
  const scope = effectScope(true)
  try {
    const { ctx } = mountColonization(scope)

    assert.strictEqual(await ctx.enterColonizationSetup(false), false)
    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_TERRAIN)
  } finally {
    scope.stop()
  }
})

test('enterColonizationSetup requires confirm when advisory has fail rows', async () => {
  const scope = effectScope(true)
  try {
    const confirmCalls = []
    const { ctx } = mountColonization(scope, {
      requestConfirm: async () => {
        confirmCalls.push(true)
        return false
      },
    })

    assert.strictEqual(await ctx.enterColonizationSetup(true, { requiresConfirm: true }), false)
    assert.strictEqual(confirmCalls.length, 1)
    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_TERRAIN)
  } finally {
    scope.stop()
  }
})

test('enterColonizationSetup skips confirm when advisory is warn-only', async () => {
  const scope = effectScope(true)
  try {
    const confirmCalls = []
    const { ctx } = mountColonization(scope, {
      requestConfirm: async () => {
        confirmCalls.push(true)
        return false
      },
    })

    assert.strictEqual(await ctx.enterColonizationSetup(true, { requiresConfirm: false }), true)
    assert.strictEqual(confirmCalls.length, 0)
    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_SETUP)
  } finally {
    scope.stop()
  }
})

test('backToTerrain returns to terrain and discards setup progress', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, settingsStore } = mountColonization(scope)

    await ctx.enterColonizationSetup(true)
    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_SETUP)

    const discarded = ctx.backToTerrain()

    assert.strictEqual(discarded, true)
    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_TERRAIN)
    assert.strictEqual(ctx.showTerrainAuthoringControls.value, true)
    assert.strictEqual(ctx.isTerrainLocked.value, false)
    assert.strictEqual(ctx.showColonistSettingsPanel.value, false)
    assert.deepStrictEqual(settingsStore.colonizationSession, createDefaultColonizationSlice())
  } finally {
    scope.stop()
  }
})

test('pickFoundingLanding accepts a valid coastal cell and updates haul-shed preview', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, viewport, settingsStore, setGeographyDocument } = mountColonization(scope)
    setGeographyDocument(coastalLandmassDocument())
    await ctx.enterColonizationSetup(true)

    assert.strictEqual(ctx.pickFoundingLanding(3, 3), true)
    assert.deepStrictEqual(ctx.foundingLanding.value, { x: 3, y: 3 })
    assert.deepStrictEqual(settingsStore.colonizationSession.foundingLanding, { x: 3, y: 3 })
    assert.ok(viewport.landingMarkers.some((marker) => marker?.x === 3 && marker?.y === 3))
    assert.ok(viewport.haulShedPreviews.at(-1)?.length > 0)
  } finally {
    scope.stop()
  }
})

test('pickFoundingLanding updates the pin without requesting a map sync', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, setGeographyDocument, sliceChangedCalls, sessionPersistCalls } =
      mountColonization(scope)
    setGeographyDocument(coastalLandmassDocument())
    await ctx.enterColonizationSetup(true)
    const sliceChangesBeforePick = sliceChangedCalls.length

    assert.strictEqual(ctx.pickFoundingLanding(3, 3), true)

    assert.strictEqual(sliceChangedCalls.length, sliceChangesBeforePick)
    assert.ok(sessionPersistCalls.length > 0)
  } finally {
    scope.stop()
  }
})

test('pickFoundingLanding snaps a nearby click to the nearest valid landing', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, settingsStore, setGeographyDocument } = mountColonization(scope)
    setGeographyDocument(coastalLandmassDocument())
    await ctx.enterColonizationSetup(true)

    assert.strictEqual(ctx.pickFoundingLanding(4, 3), true)
    assert.deepStrictEqual(ctx.foundingLanding.value, { x: 3, y: 3 })
    assert.deepStrictEqual(settingsStore.colonizationSession.foundingLanding, { x: 3, y: 3 })
  } finally {
    scope.stop()
  }
})

test('pickFoundingLanding rejects an invalid cell', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, setGeographyDocument } = mountColonization(scope)
    setGeographyDocument(rejectingLandmassDocument())
    await ctx.enterColonizationSetup(true)

    assert.strictEqual(ctx.pickFoundingLanding(24, 24), false)
    assert.strictEqual(ctx.foundingLanding.value, null)
  } finally {
    scope.stop()
  }
})

test('resetColonistSettings restores colonist setting defaults in setup', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, settingsStore, setGeographyDocument } = mountColonization(scope)
    setGeographyDocument(coastalLandmassDocument())
    await ctx.enterColonizationSetup(true)
    ctx.setColonistSetting('threeDayHaulDistance', 1)
    ctx.setColonistSetting('startingPopulation', 50)
    ctx.setColonistSetting('yieldModifier', 'marginal')

    ctx.resetColonistSettings()

    assert.deepStrictEqual(ctx.colonistSettings.value, createDefaultColonistSettings())
    assert.deepStrictEqual(
      settingsStore.colonizationSession.colonistSettings,
      createDefaultColonistSettings(),
    )
  } finally {
    scope.stop()
  }
})

test('setColonistSetting updates three-day haul distance and rescales preview', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, viewport, setGeographyDocument } = mountColonization(scope)
    setGeographyDocument(coastalLandmassDocument())
    await ctx.enterColonizationSetup(true)
    ctx.pickFoundingLanding(3, 3)
    ctx.setColonistSetting('threeDayHaulDistance', 1)
    const smallPreview = viewport.haulShedPreviews.at(-1)?.length ?? 0

    ctx.setColonistSetting('threeDayHaulDistance', 4)
    const largePreview = viewport.haulShedPreviews.at(-1)?.length ?? 0

    assert.strictEqual(ctx.colonistSettings.value.threeDayHaulDistance, 4)
    assert.ok(largePreview > smallPreview)
  } finally {
    scope.stop()
  }
})

test('setColonistSetting locks off-map shipping cost after begin colonization', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, settingsStore, setGeographyDocument } = mountColonization(scope)
    setGeographyDocument(coastalLandmassDocument())
    await ctx.enterColonizationSetup(true)
    ctx.setColonistSetting('offMapShippingCost', 3)
    ctx.pickFoundingLanding(3, 3)

    assert.strictEqual(await ctx.beginColonization(), true)
    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_RUNNING)

    ctx.setColonistSetting('offMapShippingCost', 1)

    assert.strictEqual(ctx.colonistSettings.value.offMapShippingCost, 3)
    assert.strictEqual(settingsStore.colonizationSession.colonistSettings.offMapShippingCost, 3)
  } finally {
    scope.stop()
  }
})

test('beginColonization commits founding settlement tip and locks terrain', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, settingsStore, setGeographyDocument } = mountColonization(scope)
    setGeographyDocument(coastalLandmassDocument())
    await ctx.enterColonizationSetup(true)
    assert.strictEqual(ctx.canBeginColonization.value, false)
    ctx.pickFoundingLanding(3, 3)
    assert.strictEqual(ctx.canBeginColonization.value, true)

    assert.strictEqual(await ctx.beginColonization(), true)

    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_RUNNING)
    assert.strictEqual(ctx.settlements.value?.length, 1)
    assert.ok(ctx.slice.value.realmId)
    assert.strictEqual(ctx.slice.value.historyLog?.[0]?.kind, 'founding')
    assert.strictEqual(ctx.isTerrainLocked.value, true)
    assert.strictEqual(ctx.timeControlsActive.value, true)
    assert.strictEqual(ctx.showResetColonization.value, true)
    assert.strictEqual(settingsStore.colonizationSession.colonizationPhase, COLONIZATION_PHASE_RUNNING)
  } finally {
    scope.stop()
  }
})

test('beginColonization is disabled without a founding landing', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, setGeographyDocument } = mountColonization(scope)
    setGeographyDocument(coastalLandmassDocument())
    await ctx.enterColonizationSetup(true)

    assert.strictEqual(await ctx.beginColonization(), false)
    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_SETUP)
  } finally {
    scope.stop()
  }
})

test('epochStep advances epoch by one and updates settlements', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, settingsStore, setGeographyDocument } = mountColonization(scope)
    setGeographyDocument(coastalLandmassDocument())
    await ctx.enterColonizationSetup(true)
    ctx.pickFoundingLanding(3, 3)
    await ctx.beginColonization()
    const populationBefore = ctx.settlements.value?.[0]?.population ?? 0

    assert.strictEqual(await ctx.epochStep(), true)

    assert.strictEqual(ctx.epoch.value, 1)
    assert.strictEqual(settingsStore.colonizationSession.epoch, 1)
    assert.ok(ctx.settlements.value?.[0]?.population >= populationBefore)
    assert.strictEqual(ctx.timeControlsActive.value, true)
  } finally {
    scope.stop()
  }
})

test('epochStep is inactive outside running phase', async () => {
  const scope = effectScope(true)
  try {
    const { ctx } = mountColonization(scope)

    assert.strictEqual(await ctx.epochStep(), false)
    assert.strictEqual(ctx.timeControlsActive.value, false)
  } finally {
    scope.stop()
  }
})

test('resetColonization clears tips and returns to terrain when confirmed', async () => {
  const scope = effectScope(true)
  try {
    const confirmOptions = []
    const { ctx, settingsStore, setGeographyDocument } = mountColonization(scope, {
      requestConfirm: async (options) => {
        confirmOptions.push(options)
        return true
      },
    })
    setGeographyDocument(coastalLandmassDocument())
    await ctx.enterColonizationSetup(true)
    ctx.pickFoundingLanding(3, 3)
    await ctx.beginColonization()

    assert.strictEqual(await ctx.resetColonization(), true)

    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_TERRAIN)
    assert.strictEqual(ctx.isTerrainLocked.value, false)
    assert.deepStrictEqual(settingsStore.colonizationSession, createDefaultColonizationSlice())
    assert.ok(confirmOptions.some((options) => options?.title))
  } finally {
    scope.stop()
  }
})

test('resetColonization stays in running when confirm is declined', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, settingsStore, setGeographyDocument } = mountColonization(scope, {
      requestConfirm: async () => false,
    })
    setGeographyDocument(coastalLandmassDocument())
    await ctx.enterColonizationSetup(true)
    ctx.pickFoundingLanding(3, 3)
    await ctx.beginColonization()

    assert.strictEqual(await ctx.resetColonization(), false)

    assert.strictEqual(ctx.colonizationPhase.value, COLONIZATION_PHASE_RUNNING)
    assert.strictEqual(settingsStore.colonizationSession.colonizationPhase, COLONIZATION_PHASE_RUNNING)
  } finally {
    scope.stop()
  }
})

test('settlement trade tooltip model is null when no settlement is hovered', async () => {
  const scope = effectScope(true)
  try {
    const { ctx, viewport, setGeographyDocument } = mountColonization(scope)
    setGeographyDocument(coastalLandmassDocument())
    await ctx.enterColonizationSetup(true)
    ctx.pickFoundingLanding(3, 3)
    await ctx.beginColonization()

    assert.strictEqual(ctx.hoveredSettlementId.value, null)
    assert.strictEqual(ctx.settlementTradeTooltip.value, null)

    const settlementId = ctx.settlements.value?.[0]?.id
    assert.ok(settlementId)
    viewport.triggerSettlementHover({
      settlementId,
      clientX: 40,
      clientY: 80,
    })
    assert.strictEqual(ctx.hoveredSettlementId.value, settlementId)
    assert.ok(ctx.settlementTradeTooltip.value)
    assert.strictEqual(ctx.settlementTradeTooltip.value.settlementId, settlementId)

    viewport.triggerSettlementHover(null)
    assert.strictEqual(ctx.hoveredSettlementId.value, null)
    assert.strictEqual(ctx.settlementTradeTooltip.value, null)
  } finally {
    scope.stop()
  }
})
