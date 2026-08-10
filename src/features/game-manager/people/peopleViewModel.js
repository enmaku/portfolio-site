import { createRecordedPlayer, pinSavedPlayer, suggestPersonMatches, unpinSavedPlayer } from '../domain/people.js'

/** @type {readonly string[]} */
export const PERSON_DEFAULT_COLORS = [
  '#5c6bc0',
  '#26a69a',
  '#ef5350',
  '#ffa726',
  '#ab47bc',
  '#42a5f5',
  '#66bb6a',
  '#ec407a',
]

/**
 * @param {object[]} people
 * @param {string} typedName
 */
export function personMatchSuggestionsForTypedName(people, typedName) {
  return suggestPersonMatches(people, typedName)
}

/**
 * @param {{ name: string, color?: string, persistToRoster?: boolean, id?: string }} input
 */
export function buildNewPersonDraft(input) {
  const id = input.id || `person_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  let person = createRecordedPlayer({
    id,
    name: input.name,
    color: input.color,
    saved: false,
  })
  if (input.persistToRoster) person = pinSavedPlayer(person)
  return person
}

/**
 * @param {object} person
 * @param {boolean} saved
 */
export function withSavedFlag(person, saved) {
  return saved ? pinSavedPlayer(person) : unpinSavedPlayer(person)
}

/**
 * @param {Array<{ color?: string }>} people
 * @returns {string}
 */
export function nextPersonDefaultColor(people) {
  const used = new Set(
    (people || [])
      .map((p) => String(p.color || '').toLowerCase())
      .filter(Boolean),
  )
  for (const c of PERSON_DEFAULT_COLORS) {
    if (!used.has(c.toLowerCase())) return c
  }
  return PERSON_DEFAULT_COLORS[(people || []).length % PERSON_DEFAULT_COLORS.length]
}

/**
 * @param {object} person
 * @param {{ name?: string, color?: string }} patch
 */
export function withPersonIdentity(person, patch) {
  const name = patch.name !== undefined ? String(patch.name || '').trim() : person.name
  const color =
    patch.color !== undefined && /^#[0-9a-fA-F]{6}$/.test(patch.color)
      ? patch.color
      : person.color
  return { ...person, name, color }
}

/**
 * @param {object[]} people
 */
export function peopleWithHistoryForStatsList(people) {
  return [...people].sort((a, b) => String(a.name).localeCompare(String(b.name)))
}
