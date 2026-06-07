/**
 * Presence-agnostic helpers for host inbox contract tests at the RTDB seam.
 */

import assert from 'node:assert/strict'

/**
 * @param {ReturnType<import('./rtdbLifecycleHarness.js').installRtdbLifecycleMocks> extends Promise<infer T> ? T : never} harness
 * @param {string} roomsCollection e.g. `movieVoteRooms` or `gameTimerRooms`
 * @param {string} suffix
 * @param {string} guestStableId
 * @param {unknown} payload
 */
export function simulateHostInboxMessage(harness, roomsCollection, suffix, guestStableId, payload) {
  const inboxParent = `${roomsCollection}/${suffix}/inbox`
  const childPath = `${inboxParent}/${guestStableId}`
  assert.ok(
    harness.childAddedParentPaths().some((p) => p === inboxParent || p.endsWith('/inbox')),
    `host should wire inbox listener (${harness.childAddedParentPaths().join(', ')})`,
  )
  harness.emitChildAdded(inboxParent, guestStableId)
  assert.ok(
    harness.listeners.has(childPath),
    `host should subscribe to inbox child (${[...harness.listeners.keys()].join(', ')})`,
  )
  harness.emitValue(childPath, payload)
}

/**
 * @template {string} K
 * @param {Array<{ path: string, value: unknown }>} sets
 * @param {(raw: unknown) => { seq: number } & Record<K, unknown> | null} parseFn
 * @param {K} valueKey
 * @returns {Array<{ seq: number } & Record<K, unknown>>}
 */
export function parseStateBroadcasts(sets, parseFn, valueKey) {
  return sets
    .filter((entry) => entry.path.endsWith('/state'))
    .map((entry) => {
      const parsed = parseFn(entry.value)
      assert.ok(parsed, 'state write must be a host snapshot message')
      return { seq: parsed.seq, [valueKey]: parsed[valueKey] }
    })
}

/**
 * @template {string} K
 * @param {Array<{ path: string, value: unknown }>} sets
 * @param {(raw: unknown) => { seq: number } & Record<K, unknown> | null} parseFn
 * @param {K} valueKey
 * @returns {number}
 */
export function maxStateSeq(sets, parseFn, valueKey) {
  return parseStateBroadcasts(sets, parseFn, valueKey).reduce((max, entry) => Math.max(max, entry.seq), 0)
}
