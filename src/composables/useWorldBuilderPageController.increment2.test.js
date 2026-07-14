import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope } from 'vue'
import { applyEpochStep } from '../../world-builder/core/colonization/runColonizationEpochStep.js'
import { beginColonizationCommit } from '../../world-builder/core/colonization/beginColonizationCommit.js'
import {
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
} from '../../world-builder/core/colonization/createDefaultColonizationSlice.js'
import { BIOMES } from '../../world-builder/core/biomeIds.js'

function richDoc() {
  const cellCount = 16
  return {
    geographySeed: 99,
    gridWidth: 4,
    gridHeight: 4,
    arableRaster: new Float32Array(cellCount).fill(2),
    timberRaster: new Float32Array(cellCount).fill(2),
    fields: {
      elevation: new Float32Array(cellCount).fill(0.5),
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.6),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: Uint8Array.from({ length: cellCount }, (_, i) => (i === 5 ? 1 : 0)),
    saltNodes: [],
    metalNodes: [],
    coastalNodes: [],
  }
}

test('epoch step updates sim status fields after epoch 0', async () => {
  const scope = effectScope(true)
  try {
    const { useWorldBuilderPageController } = await import('./useWorldBuilderPageController.js')
    const doc = richDoc()
    let colonizationSlice = createDefaultColonizationSlice()
    colonizationSlice.colonizationPhase = COLONIZATION_PHASE_SETUP
    colonizationSlice.foundingLanding = { x: 1, y: 1 }
    colonizationSlice = await beginColonizationCommit(colonizationSlice, doc)
    colonizationSlice = await applyEpochStep(colonizationSlice, doc)

    const controller = scope.run(() =>
      useWorldBuilderPageController({
        getMapHostElement: () => null,
        settingsStore: {
          geographySeed: 99,
          generationOptions: {},
          overlayDisplaySettings: {},
          colonizationSession: colonizationSlice,
          setColonizationSession: () => {},
          resetToDefaults: () => {},
          setOverlayDisplaySetting: () => {},
        },
        runDerivedGeographyInWorker: async () => ({ worldDocument: doc, cancelled: false }),
        loadLockedTerrain: async () => doc,
        saveLockedTerrain: async () => {},
        clearLockedTerrain: async () => {},
        loadColonizationSession: async () => colonizationSlice,
        saveColonizationSession: async () => {},
        clearColonizationSession: async () => {},
      }),
    )

    assert.strictEqual(controller.showSimStatusPanel.value, true)
    assert.ok(controller.simStatus.value.epoch >= 1)
    assert.ok(controller.simStatus.value.livingSettlementCount >= 1)
    assert.ok(Array.isArray(controller.foundingChronicle.value))
  } finally {
    scope.stop()
  }
})
