import { acceptHMRUpdate, defineStore } from 'pinia'
import { resolveWorldGenerationOptions } from '@world-builder/core/worldGenerationOptions.js'
import {
  createControlsStateForSeed,
  createDefaultGenerationSettings,
  createDefaultGenerationOptions,
  createRandomGeographySeed,
  normalizeGeographySeed,
  normalizeWindDegrees,
  parseGeographySeedInput,
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

function ensureGeographySeedInitialized(store) {
  if (store.geographySeed !== null) {
    return
  }
  const initial = createControlsStateForSeed(createRandomGeographySeed())
  store.geographySeed = initial.geographySeed
  store.prevailingWindDegrees = initial.prevailingWindDegrees
}

export const useWorldBuilderSettingsStore = defineStore('worldBuilderSettings', {
  state: () => ({
    geographySeed: null,
    prevailingWindDegrees: 0,
    generationOptions: createDefaultGenerationOptions(),
    overlayDisplaySettings: createDefaultOverlayDisplaySettings(),
  }),

  persist: {
    key: 'portfolio-world-builder-settings',
    pick: ['geographySeed', 'prevailingWindDegrees', 'generationOptions', 'overlayDisplaySettings'],
    afterHydrate: ({ store }) => {
      store.geographySeed = parseStoredGeographySeed(store.geographySeed)
      store.prevailingWindDegrees = normalizeWindDegrees(store.prevailingWindDegrees)
      store.generationOptions = resolveWorldGenerationOptions(store.generationOptions)
      store.overlayDisplaySettings = {
        ...createDefaultOverlayDisplaySettings(),
        ...store.overlayDisplaySettings,
      }
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
      const initial = createControlsStateForSeed(parsed)
      this.geographySeed = initial.geographySeed
      this.prevailingWindDegrees = initial.prevailingWindDegrees
    },

    setControl(key, value) {
      if (key === 'prevailingWindDegrees') {
        this.prevailingWindDegrees = normalizeWindDegrees(value)
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

    resetToDefaults() {
      ensureGeographySeedInitialized(this)
      const defaults = createDefaultGenerationSettings(this.geographySeed)
      this.prevailingWindDegrees = defaults.prevailingWindDegrees
      this.generationOptions = defaults.generationOptions
      this.overlayDisplaySettings = createDefaultOverlayDisplaySettings()
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorldBuilderSettingsStore, import.meta.hot))
}
