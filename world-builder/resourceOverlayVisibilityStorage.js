import {
  createDefaultResourceOverlayVisibility,
} from './resourceOverlays.js'
import { normalizeResourceOverlayVisibility } from './resourceOverlayState.js'

export const RESOURCE_OVERLAY_VISIBILITY_STORAGE_KEY = 'portfolio-world-builder-overlay-visibility'

const LEGACY_SETTINGS_STORAGE_KEY = 'portfolio-world-builder-settings'

/**
 * @returns {Storage | null}
 */
function defaultStorage() {
  return typeof localStorage !== 'undefined' ? localStorage : null
}

/**
 * @param {Pick<Storage, 'getItem'> | null | undefined} storage
 * @param {string} key
 * @returns {Record<string, boolean> | null}
 */
function readVisibilityBlob(storage, key) {
  if (!storage) {
    return null
  }
  try {
    const raw = storage.getItem(key)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    return normalizeResourceOverlayVisibility(parsed)
  } catch {
    return null
  }
}

/**
 * @param {Pick<Storage, 'getItem'> | null | undefined} storage
 * @returns {Record<string, boolean> | null}
 */
function readLegacyVisibilityFromSettingsBlob(storage) {
  if (!storage) {
    return null
  }
  try {
    const raw = storage.getItem(LEGACY_SETTINGS_STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw)
    if (!parsed?.resourceOverlayVisibility || typeof parsed.resourceOverlayVisibility !== 'object') {
      return null
    }
    return normalizeResourceOverlayVisibility(parsed.resourceOverlayVisibility)
  } catch {
    return null
  }
}

/**
 * @param {Pick<Storage, 'getItem'> | null | undefined} [storage]
 * @returns {Record<string, boolean>}
 */
export function loadPersistedResourceOverlayVisibility(storage = defaultStorage()) {
  const fromDedicated = readVisibilityBlob(storage, RESOURCE_OVERLAY_VISIBILITY_STORAGE_KEY)
  if (fromDedicated) {
    return fromDedicated
  }

  const fromLegacy = readLegacyVisibilityFromSettingsBlob(storage)
  if (fromLegacy) {
    return fromLegacy
  }

  return createDefaultResourceOverlayVisibility()
}

/**
 * @param {Record<string, boolean | null | undefined>} visibility
 * @param {Pick<Storage, 'setItem'> | null | undefined} [storage]
 */
export function persistResourceOverlayVisibility(visibility, storage = defaultStorage()) {
  if (!storage) {
    return
  }
  const normalized = normalizeResourceOverlayVisibility(visibility)
  storage.setItem(RESOURCE_OVERLAY_VISIBILITY_STORAGE_KEY, JSON.stringify(normalized))
}

/**
 * @param {Pick<Storage, 'setItem'> | null | undefined} [storage]
 */
export function clearPersistedResourceOverlayVisibility(storage = defaultStorage()) {
  if (!storage) {
    return
  }
  storage.setItem(
    RESOURCE_OVERLAY_VISIBILITY_STORAGE_KEY,
    JSON.stringify(createDefaultResourceOverlayVisibility()),
  )
}
