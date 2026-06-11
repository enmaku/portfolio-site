const KEY_PREFIX = 'mv-results-replay-seq:'

/**
 * @param {string | null | undefined} roomSuffix
 * @param {Storage | { getItem: (k: string) => string | null } | null | undefined} [storage]
 * @returns {number | null}
 */
export function readLastReplayedSeq(roomSuffix, storage = globalThis.sessionStorage) {
  if (!roomSuffix || !storage) return null
  const raw = storage.getItem(KEY_PREFIX + roomSuffix)
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {string | null | undefined} roomSuffix
 * @param {number} seq
 * @param {Storage | { setItem: (k: string, v: string) => void } | null | undefined} [storage]
 * @returns {void}
 */
export function rememberReplayedSeq(roomSuffix, seq, storage = globalThis.sessionStorage) {
  if (!roomSuffix || !storage || typeof seq !== 'number' || seq <= 0) return
  storage.setItem(KEY_PREFIX + roomSuffix, String(seq))
}
