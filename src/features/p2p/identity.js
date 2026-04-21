/**
 * Stable per-browser client identity used to survive reconnects in every P2P
 * app on the site.
 *
 * WebRTC gives each new {@link Peer} a different transport-level id, so if a
 * guest refreshes or drops their connection the host sees them as a brand new
 * participant — inflating voter counts, losing votes, etc. Persisting a short
 * opaque id in `localStorage` lets the host recognize the returning client and
 * remap them onto their existing slot.
 */

const STORAGE_KEY = 'portfolio-p2p-client-id'

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

const ID_LENGTH = 16

/** @type {string | null} */
let cached = null

function generate() {
  const bytes = new Uint8Array(ID_LENGTH)
  crypto.getRandomValues(bytes)
  let s = ''
  for (let i = 0; i < ID_LENGTH; i++) s += ALPHABET[bytes[i] % ALPHABET.length]
  return s
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
function isWellFormed(raw) {
  return typeof raw === 'string' && /^[0-9A-Z]{8,64}$/.test(raw)
}

/**
 * Returns an opaque, per-browser stable identity. Generates and persists one on
 * first call. Uses an in-memory cache so repeated calls within a session are
 * cheap and stable even if storage is flaky.
 * @returns {string}
 */
export function getStableClientId() {
  if (cached) return cached

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing && isWellFormed(existing)) {
      cached = existing
      return cached
    }
  } catch {
    void 0
  }

  const fresh = generate()
  try {
    window.localStorage.setItem(STORAGE_KEY, fresh)
  } catch {
    void 0
  }
  cached = fresh
  return cached
}

/** Test-only / "forget me" helper. Not wired into any UI today. */
export function __resetStableClientIdForTests() {
  cached = null
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    void 0
  }
}

/**
 * Deterministic per-browser room suffix for hosts, so "last week's link still
 * works this week" — each device always tries to claim the same room id for a
 * given app, and only falls back to a fresh random suffix if the broker
 * reports that id is currently held by someone else.
 *
 * Uses a simple 32-bit xxhash-style mixer seeded with `stableId:app`; it is
 * not cryptographic, just stable and well-distributed over the base-32
 * alphabet used by every room id in the site.
 *
 * @param {string} app Short app tag, e.g. `'movievote'` or `'gametimer'`.
 * @param {number} [length=6]
 * @returns {string}
 */
export function deriveStableHostSuffix(app, length = 6) {
  const seed = getStableClientId() + ':' + app
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  let out = ''
  for (let i = 0; i < length; i++) {
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
    h2 = Math.imul(h2 ^ (h2 >>> 13), 3266489909)
    const idx = (h1 ^ h2) >>> 0
    out += ALPHABET[idx % ALPHABET.length]
  }
  return out
}
