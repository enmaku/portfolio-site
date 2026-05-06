/**
 * Host-side debounce for duplicate guest action intents (same kind + playerId).
 * Uses host receive time only; guest `sentAt` is wire metadata for debugging / future use.
 */

/** @typedef {{ kind: 'selectPlayer' | 'registerHardPass', playerId: string }} GuestIntentKey */

export const GUEST_INTENT_DEBOUNCE_MS = 250

/** @type {Set<string>} */
const DEBOUNCED_KINDS = new Set(['selectPlayer', 'registerHardPass'])

/**
 * @param {unknown} intent
 * @returns {intent is { kind: string, playerId: string, sentAt: number }}
 */
export function isWellFormedGuestIntent(intent) {
  if (intent == null || typeof intent !== 'object' || Array.isArray(intent)) return false
  const k = /** @type {{ kind?: unknown, playerId?: unknown, sentAt?: unknown }} */ (intent)
  if (k.kind !== 'selectPlayer' && k.kind !== 'registerHardPass') return false
  if (typeof k.playerId !== 'string' || !k.playerId) return false
  if (typeof k.sentAt !== 'number') return false
  return true
}

/**
 * @param {unknown} intent
 * @returns {boolean}
 */
export function isDebouncedGuestIntentKind(intent) {
  return isWellFormedGuestIntent(intent) && DEBOUNCED_KINDS.has(/** @type {{ kind: string }} */ (intent).kind)
}

/**
 * @param {{ debounceMs?: number }} [opts]
 */
export function createGuestIntentDeduper(opts = {}) {
  const windowMs = typeof opts.debounceMs === 'number' ? opts.debounceMs : GUEST_INTENT_DEBOUNCE_MS
  /** @type {Map<string, number>} */
  const lastAcceptedAt = new Map()

  /**
   * @param {GuestIntentKey} intent
   * @param {number} nowMs
   * @returns {boolean} true if this message should be suppressed (duplicate inside window)
   */
  function shouldSuppress(intent, nowMs) {
    const key = `${intent.kind}:${intent.playerId}`
    const prev = lastAcceptedAt.get(key)
    if (prev != null && nowMs - prev < windowMs) {
      return true
    }
    lastAcceptedAt.set(key, nowMs)
    return false
  }

  return { shouldSuppress }
}

/**
 * @param {{ intent?: unknown }} parsed
 * @param {{ shouldSuppress: (intent: GuestIntentKey, nowMs: number) => boolean }} deduper
 * @param {number} nowMs
 * @returns {boolean} whether the host should apply `parsed.snapshot`
 */
export function hostShouldApplyGuestSnapshot(parsed, deduper, nowMs) {
  const intent = parsed.intent
  if (!isDebouncedGuestIntentKind(intent)) return true
  return !deduper.shouldSuppress(
    { kind: /** @type {'selectPlayer' | 'registerHardPass'} */ (intent.kind), playerId: intent.playerId },
    nowMs,
  )
}

/**
 * @param {{ snapshot: import('../types.js').GameTimerSyncPayload, intent?: unknown }} parsed
 * @param {{ shouldSuppress: (intent: GuestIntentKey, nowMs: number) => boolean }} deduper
 * @param {number} nowMs
 * @param {(snap: import('../types.js').GameTimerSyncPayload) => void} applySnapshot
 * @param {() => import('../types.js').GameTimerSyncPayload} getSnapshot
 * @returns {{ broadcastSnapshot: import('../types.js').GameTimerSyncPayload, appliedGuestSnapshot: boolean }}
 */
export function authoritativeSnapshotAfterGuestMessage(parsed, deduper, nowMs, applySnapshot, getSnapshot) {
  const appliedGuestSnapshot = hostShouldApplyGuestSnapshot(parsed, deduper, nowMs)
  if (appliedGuestSnapshot) {
    applySnapshot(parsed.snapshot)
  }
  return { broadcastSnapshot: getSnapshot(), appliedGuestSnapshot }
}
