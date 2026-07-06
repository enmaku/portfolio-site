import { computed, ref } from 'vue'
import {
  commitResourceOverlayState,
  createResourceOverlayPageState,
  resetResourceOverlayVisibilityState,
  toggleResourceOverlayVisibility,
  updateOverlayDisplaySetting,
} from '../../world-builder/resourceOverlayState.js'
import {
  loadPersistedResourceOverlayVisibility,
  persistResourceOverlayVisibility,
} from '../../world-builder/resourceOverlayVisibilityStorage.js'

/** @typedef {import('../../world-builder/resourceOverlayState.js').ResourceOverlayPageState} ResourceOverlayPageState */
/** @typedef {import('../../world-builder/resourceOverlays.js').OverlayDisplaySettings} OverlayDisplaySettings */

/**
 * @typedef {Object} WorldBuilderOverlaySettingsStore
 * @property {OverlayDisplaySettings} overlayDisplaySettings
 * @property {(key: keyof OverlayDisplaySettings, value: number) => void} setOverlayDisplaySetting
 */

/**
 * @param {ResourceOverlayPageState} previousState
 * @param {ResourceOverlayPageState} nextState
 * @param {WorldBuilderOverlaySettingsStore} settingsStore
 */
function persistOverlayDisplaySettings(previousState, nextState, settingsStore) {
  for (const key of /** @type {(keyof OverlayDisplaySettings)[]} */ (
    Object.keys(nextState.displaySettings)
  )) {
    if (nextState.displaySettings[key] !== previousState.displaySettings[key]) {
      settingsStore.setOverlayDisplaySetting(key, nextState.displaySettings[key])
    }
  }
}

/**
 * Single owner for World Builder overlay visibility and display settings.
 * Display settings persist via Pinia; visibility booleans persist in isolated localStorage.
 *
 * @param {{
 *   getViewport: () => {
 *     syncOverlayRenderCache?: (state: ResourceOverlayPageState) => void,
 *   } | null | undefined,
 *   settingsStore: WorldBuilderOverlaySettingsStore,
 *   visibilityStorage?: Pick<Storage, 'getItem' | 'setItem'>,
 * }} options
 */
export function useWorldBuilderOverlayState(options) {
  const { getViewport, settingsStore, visibilityStorage } = options
  /** @type {import('vue').Ref<ResourceOverlayPageState>} */
  const state = ref(
    createResourceOverlayPageState(
      settingsStore.overlayDisplaySettings,
      loadPersistedResourceOverlayVisibility(visibilityStorage),
    ),
  )

  /** Destructure at setup top level so SFC templates auto-unwrap this ref. */
  const visibility = computed(() => state.value.visibility)

  /**
   * @param {ResourceOverlayPageState} nextState
   * @param {{ persistDisplaySettings?: boolean, persistVisibility?: boolean }} [commitOptions]
   */
  function commit(nextState, commitOptions = {}) {
    const { persistDisplaySettings = false, persistVisibility = false } = commitOptions
    if (persistDisplaySettings) {
      persistOverlayDisplaySettings(state.value, nextState, settingsStore)
    }
    if (persistVisibility) {
      persistResourceOverlayVisibility(nextState.visibility, visibilityStorage)
    }
    state.value = commitResourceOverlayState(getViewport(), nextState)
  }

  /**
   * @param {string} resourceId
   * @param {boolean | null | undefined} visible
   */
  function toggleVisibility(resourceId, visible) {
    commit(toggleResourceOverlayVisibility(state.value, resourceId, visible === true), {
      persistVisibility: true,
    })
  }

  /**
   * @param {keyof OverlayDisplaySettings} key
   * @param {number} value
   */
  function setDisplaySetting(key, value) {
    commit(updateOverlayDisplaySetting(state.value, key, value), {
      persistDisplaySettings: true,
    })
  }

  /**
   * @param {{ persist?: boolean }} [options]
   */
  function resetVisibility(options = {}) {
    const { persist = false } = options
    commit(resetResourceOverlayVisibilityState(state.value), { persistVisibility: persist })
  }

  function syncToViewport() {
    commit(state.value)
  }

  function hydrateFromPersistedSettings() {
    state.value = createResourceOverlayPageState(
      settingsStore.overlayDisplaySettings,
      loadPersistedResourceOverlayVisibility(visibilityStorage),
    )
  }

  function applyPersistedDefaults() {
    commit(
      createResourceOverlayPageState(
        settingsStore.overlayDisplaySettings,
        loadPersistedResourceOverlayVisibility(visibilityStorage),
      ),
    )
  }

  /**
   * @param {keyof OverlayDisplaySettings} key
   */
  function overlayDisplaySetting(key) {
    return state.value.displaySettings[key]
  }

  return {
    visibility,
    overlayDisplaySetting,
    toggleVisibility,
    setDisplaySetting,
    resetVisibility,
    syncToViewport,
    hydrateFromPersistedSettings,
    applyPersistedDefaults,
  }
}
