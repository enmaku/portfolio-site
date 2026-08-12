import { acceptHMRUpdate, defineStore } from 'pinia'
import {
  createDefaultColonizationSlice,
  resolveColonizationSlice,
  serializeColonizationSessionForStorage,
} from '@world-builder/core/colonization/createDefaultColonizationSlice.js'
import { resolveWorldGenerationOptions } from '@world-builder/core/worldGenerationOptions.js'
import {
  createControlsStateForSeed,
  createDefaultGenerationSettings,
  createDefaultGenerationOptions,
  createRandomGeographySeed,
  normalizeGeographySeed,
  normalizeWindDegrees,
  parseGeographySeedInput,
  windStateAfterPrevailingChange,
  windStateAfterSeedApply,
  windStateAfterSetSecondaryLinked,
} from '@world-builder/worldBuilderPageModel.js'
import { createDefaultOverlayDisplaySettings } from '@world-builder/worldBuilderOverlayControls.js'

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function parseStoredGeographySeed(value) {
  if (value === null || value === undefined) {
    return null
  }
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return normalizeGeographySeed(parsed)
}

/**
 * @param {import('pinia').Store<'worldBuilderSettings'>} store
 */
function ensureGeographySeedInitialized(store) {
  if (store.geographySeed !== null) {
    return
  }
  const initial = createControlsStateForSeed(createRandomGeographySeed())
  store.geographySeed = initial.geographySeed
  store.prevailingWindDegrees = initial.prevailingWindDegrees
  store.secondaryMaximumDegrees = initial.secondaryMaximumDegrees
  store.secondaryMaximumLinked = initial.secondaryMaximumLinked
}

/**
 * @param {import('pinia').Store<'worldBuilderSettings'>} store
 * @param {{
 *   prevailingWindDegrees: number,
 *   secondaryMaximumDegrees: number,
 *   secondaryMaximumLinked: boolean,
 * }} wind
 */
function applyWindState(store, wind) {
  store.prevailingWindDegrees = wind.prevailingWindDegrees
  store.secondaryMaximumDegrees = wind.secondaryMaximumDegrees
  store.secondaryMaximumLinked = wind.secondaryMaximumLinked
}

export const useWorldBuilderSettingsStore = defineStore('worldBuilderSettings', {
  state: () => ({
    geographySeed: null,
    prevailingWindDegrees: 0,
    secondaryMaximumDegrees: 90,
    secondaryMaximumLinked: true,
    generationOptions: createDefaultGenerationOptions(),
    overlayDisplaySettings: createDefaultOverlayDisplaySettings(),
    colonizationSession: createDefaultColonizationSlice(),
  }),

  persist: {
    key: 'portfolio-world-builder-settings',
    pick: [
      'geographySeed',
      'prevailingWindDegrees',
      'secondaryMaximumDegrees',
      'secondaryMaximumLinked',
      'generationOptions',
      'overlayDisplaySettings',
      'colonizationSession',
    ],
    omit: [
      'colonizationSession.populationCollapseRaster',
      'colonizationSession.visitedCells',
    ],
    afterHydrate: ({ store }) => {
      store.geographySeed = parseStoredGeographySeed(store.geographySeed)
      store.prevailingWindDegrees = normalizeWindDegrees(store.prevailingWindDegrees)
      store.secondaryMaximumDegrees = normalizeWindDegrees(
        store.secondaryMaximumDegrees ?? store.prevailingWindDegrees + 90,
      )
      store.secondaryMaximumLinked =
        store.secondaryMaximumLinked === undefined ? true : Boolean(store.secondaryMaximumLinked)
      store.generationOptions = resolveWorldGenerationOptions(store.generationOptions)
      store.overlayDisplaySettings = {
        ...createDefaultOverlayDisplaySettings(),
        ...store.overlayDisplaySettings,
      }
      store.colonizationSession = resolveColonizationSlice(store.colonizationSession)
      ensureGeographySeedInitialized(store)
    },
  },

  actions: {
    ensureInitialized() {
      ensureGeographySeedInitialized(this)
    },

    applySeed(rawSeed) {
      const parsed = parseGeographySeedInput(String(rawSeed))
      if (parsed === null) {
        return
      }
      const wind = windStateAfterSeedApply(parsed, {
        prevailingWindDegrees: this.prevailingWindDegrees,
        secondaryMaximumDegrees: this.secondaryMaximumDegrees,
        secondaryMaximumLinked: this.secondaryMaximumLinked,
      })
      this.geographySeed = createControlsStateForSeed(parsed).geographySeed
      applyWindState(this, wind)
    },

    setControl(key, value) {
      if (key === 'prevailingWindDegrees') {
        applyWindState(
          this,
          windStateAfterPrevailingChange(
            {
              prevailingWindDegrees: this.prevailingWindDegrees,
              secondaryMaximumDegrees: this.secondaryMaximumDegrees,
              secondaryMaximumLinked: this.secondaryMaximumLinked,
            },
            value,
          ),
        )
        return
      }
      if (key === 'secondaryMaximumDegrees') {
        if (this.secondaryMaximumLinked) {
          return
        }
        this.secondaryMaximumDegrees = normalizeWindDegrees(value)
        return
      }
      if (key === 'secondaryMaximumLinked') {
        applyWindState(
          this,
          windStateAfterSetSecondaryLinked(
            {
              prevailingWindDegrees: this.prevailingWindDegrees,
              secondaryMaximumDegrees: this.secondaryMaximumDegrees,
              secondaryMaximumLinked: this.secondaryMaximumLinked,
            },
            Boolean(value),
          ),
        )
        return
      }
      this.generationOptions = {
        ...this.generationOptions,
        [key]: value,
      }
    },

    setOverlayDisplaySetting(key, value) {
      this.overlayDisplaySettings = {
        ...this.overlayDisplaySettings,
        [key]: value,
      }
    },

    setColonizationSession(slice) {
      const persistable = serializeColonizationSessionForStorage(slice)
      this.colonizationSession = resolveColonizationSlice(persistable)
    },

    resetToDefaults() {
      ensureGeographySeedInitialized(this)
      const defaults = createDefaultGenerationSettings(this.geographySeed)
      applyWindState(this, {
        prevailingWindDegrees: defaults.prevailingWindDegrees,
        secondaryMaximumDegrees: defaults.secondaryMaximumDegrees,
        secondaryMaximumLinked: defaults.secondaryMaximumLinked,
      })
      this.generationOptions = defaults.generationOptions
      this.overlayDisplaySettings = createDefaultOverlayDisplaySettings()
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorldBuilderSettingsStore, import.meta.hot))
}
