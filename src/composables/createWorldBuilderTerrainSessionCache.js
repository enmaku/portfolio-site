import { mergeColonizationSessions } from '../../world-builder/core/colonization/createDefaultColonizationSlice.js'
import { buildTerrainCacheFingerprint } from '../../world-builder/core/terrainCacheFingerprint.js'
import { reportWorldBuilderError } from '../utils/worldBuilderErrorReporting.js'

/**
 * Terrain lock + colonization session cache I/O for the World Builder page controller.
 *
 * @param {{
 *   settingsStore: {
 *     geographySeed: number | null,
 *     prevailingWindDegrees: number,
 *     generationOptions: import('../../world-builder/core/types.js').WorldGenerationOptions,
 *     colonizationSession?: import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice,
 *     setColonizationSession?: (slice: import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice) => void,
 *   },
 *   onGenerationError?: (message: string) => void,
 *   getColonization: () => {
 *     isTerrainLocked: { value: boolean },
 *     slice: { value: import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice },
 *     hydrateFromPersistedSettings: () => void,
 *   },
 *   getGeneration: () => {
 *     worldDocument: { value: import('../../world-builder/core/types.js').WorldDocument | null },
 *   } | null,
 *   saveLockedTerrain: (entry: {
 *     fingerprint: string,
 *     worldDocument: import('../../world-builder/core/types.js').WorldDocument,
 *   }) => Promise<unknown>,
 *   clearLockedTerrain: () => Promise<unknown>,
 *   loadColonizationSession: (fingerprint: string) => Promise<import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice | null>,
 *   saveColonizationSession: (
 *     fingerprint: string,
 *     slice: import('../../world-builder/core/colonization/createDefaultColonizationSlice.js').ColonizationSlice,
 *   ) => Promise<unknown>,
 *   clearColonizationSession: () => Promise<unknown>,
 * }} ports
 */
export function createWorldBuilderTerrainSessionCache(ports) {
  const {
    settingsStore,
    onGenerationError,
    getColonization,
    getGeneration,
    saveLockedTerrain,
    clearLockedTerrain,
    loadColonizationSession,
    saveColonizationSession,
    clearColonizationSession,
  } = ports

  function currentTerrainFingerprint() {
    return buildTerrainCacheFingerprint({
      geographySeed: settingsStore.geographySeed ?? 0,
      prevailingWindDegrees: settingsStore.prevailingWindDegrees,
      generationOptions: settingsStore.generationOptions,
    })
  }

  function reportCacheError(context, error) {
    reportWorldBuilderError(context, error, onGenerationError)
  }

  async function persistColonizationSessionIfNeeded() {
    const colonization = getColonization()
    if (!colonization.isTerrainLocked.value) {
      return
    }
    try {
      await saveColonizationSession(currentTerrainFingerprint(), colonization.slice.value)
    } catch (error) {
      reportCacheError('Failed to save colonization session cache', error)
    }
  }

  async function persistLockedTerrainIfNeeded() {
    const colonization = getColonization()
    if (!colonization.isTerrainLocked.value) {
      return
    }
    const doc = getGeneration()?.worldDocument.value
    if (!doc) {
      return
    }
    try {
      await saveLockedTerrain({
        fingerprint: currentTerrainFingerprint(),
        worldDocument: doc,
      })
    } catch (error) {
      reportCacheError('Failed to save locked terrain cache', error)
    }
    await persistColonizationSessionIfNeeded()
  }

  async function discardLockedTerrain() {
    try {
      await clearLockedTerrain()
      await clearColonizationSession()
    } catch (error) {
      reportCacheError('Failed to clear world builder terrain caches', error)
    }
  }

  async function restoreColonizationSessionFromCaches(fingerprint, options = {}) {
    const runSubstep = options.runSubstep ?? (async (_substepIndex, work) => work())

    const fromStore = await runSubstep(0, () => settingsStore.colonizationSession)

    let fromColonizationCache = null
    await runSubstep(1, async () => {
      try {
        fromColonizationCache = await loadColonizationSession(fingerprint)
      } catch (error) {
        reportCacheError('Failed to load colonization session cache', error)
      }
    })

    const merged = await runSubstep(2, () =>
      mergeColonizationSessions(fromStore, fromColonizationCache),
    )

    await runSubstep(3, () => {
      settingsStore.setColonizationSession?.(merged)
      getColonization().hydrateFromPersistedSettings()
    })

    return merged
  }

  return {
    currentTerrainFingerprint,
    reportCacheError,
    persistColonizationSessionIfNeeded,
    persistLockedTerrainIfNeeded,
    discardLockedTerrain,
    restoreColonizationSessionFromCaches,
  }
}
