/**
 * @param {unknown} raw
 * @returns {boolean}
 */
export function parseNnAdventurerPickEnabled(raw) {
  const v = raw != null ? String(raw).trim().toLowerCase() : ''
  return v === '1' || v === 'true' || v === 'yes'
}

/** When false (default), pick-adventurer uses match RNG instead of NN inference. */
export function isNnAdventurerPickEnabled() {
  return parseNnAdventurerPickEnabled(import.meta.env?.VITE_DUNGEON_RUNNER_NN_PICK_ADVENTURER)
}
