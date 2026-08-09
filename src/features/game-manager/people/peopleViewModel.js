import { createRecordedPlayer, pinSavedPlayer, suggestPersonMatches, unpinSavedPlayer } from '../domain/people.js'

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
 * @param {object[]} people
 */
export function peopleWithHistoryForStatsList(people) {
  return [...people].sort((a, b) => String(a.name).localeCompare(String(b.name)))
}
