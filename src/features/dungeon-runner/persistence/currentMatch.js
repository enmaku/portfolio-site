export const CURRENT_MATCH_SCHEMA_VERSION = 1

const STORAGE_KEY = 'dungeon-runner/current-match'

export function persistCurrentMatch(storage, match) {
  storage.setItem(STORAGE_KEY, JSON.stringify(match))
}

export function loadCurrentMatch(storage) {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return { ok: false, errorCode: 'EMPTY' }
  try {
    const match = JSON.parse(raw)
    if (match.schemaVersion !== CURRENT_MATCH_SCHEMA_VERSION) {
      storage.removeItem(STORAGE_KEY)
      return { ok: false, errorCode: 'SCHEMA_MISMATCH' }
    }
    if (!isValidMatchShape(match)) {
      storage.removeItem(STORAGE_KEY)
      return { ok: false, errorCode: 'INVALID_SHAPE' }
    }
    return { ok: true, match }
  } catch {
    storage.removeItem(STORAGE_KEY)
    return { ok: false, errorCode: 'CORRUPT' }
  }
}

export function clearCurrentMatch(storage) {
  storage.removeItem(STORAGE_KEY)
}

export function decideResumeFlow(storage) {
  const loaded = loadCurrentMatch(storage)
  if (loaded.ok) return { mode: 'resume-or-start-new' }
  return { mode: 'start-new' }
}

function isValidMatchShape(match) {
  if (!match || typeof match !== 'object') return false
  if (typeof match.id !== 'string' || !match.id) return false
  if (!('setup' in match) || typeof match.setup !== 'object' || match.setup == null) return false
  if (!('state' in match) || typeof match.state !== 'object' || match.state == null) return false
  if (!Array.isArray(match.history)) return false
  return true
}
