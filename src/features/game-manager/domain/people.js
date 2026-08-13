const DEFAULT_COLORS = ['#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#f4a261', '#457b9d']

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * @param {{ id: string, name: string, color?: string, saved?: boolean }} input
 */
export function createRecordedPlayer(input) {
  const color =
    input.color && /^#[0-9a-fA-F]{6}$/.test(input.color)
      ? input.color
      : DEFAULT_COLORS[hashToIndex(input.id || input.name, DEFAULT_COLORS.length)]
  return {
    id: input.id,
    name: String(input.name || '').trim(),
    color,
    saved: Boolean(input.saved),
  }
}

function hashToIndex(seed, modulo) {
  let h = 0
  const s = String(seed)
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % modulo
}

/**
 * @param {ReturnType<typeof createRecordedPlayer>[]} people
 * @param {string} typedName
 */
export function matchPeopleByName(people, typedName) {
  const needle = normalizeName(typedName)
  if (!needle) return []
  return people.filter((p) => normalizeName(p.name) === needle)
}

/**
 * @param {ReturnType<typeof createRecordedPlayer>[]} people
 * @param {string} typedName
 */
export function suggestPersonMatches(people, typedName) {
  return matchPeopleByName(people, typedName)
}

export function pinSavedPlayer(person) {
  return { ...person, saved: true }
}

export function unpinSavedPlayer(person) {
  return { ...person, saved: false }
}

/**
 * @param {Array<{ id: string, presentPlayers: object[] }>} sessions
 * @param {string} recordedPlayerId
 */
export function applyPersonDeletionToSessions(sessions, recordedPlayerId) {
  return sessions.map((session) => ({
    ...session,
    presentPlayers: session.presentPlayers.map((seat) => {
      if (seat.recordedPlayerId !== recordedPlayerId) return seat
      return {
        recordedPlayerId: null,
        name: null,
        color: null,
        removed: true,
      }
    }),
    score: scrubScoreForDeletedPerson(session.score, recordedPlayerId),
  }))
}

function scrubScoreForDeletedPerson(score, recordedPlayerId) {
  if (!score) return score
  if (score.perPlayer && recordedPlayerId in score.perPlayer) {
    const perPlayer = { ...score.perPlayer }
    delete perPlayer[recordedPlayerId]
    return { ...score, perPlayer }
  }
  if (score.outcomes && recordedPlayerId in score.outcomes) {
    const outcomes = { ...score.outcomes }
    delete outcomes[recordedPlayerId]
    return { ...score, outcomes }
  }
  return score
}
