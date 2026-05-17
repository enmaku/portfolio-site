import { equipmentShortName, sacrificeActionLabel } from './equipmentDisplayCatalog.js'

/** @type {Record<string, string>} */
const PHASE_LABELS = {
  bidding: 'Bidding',
  dungeon: 'Dungeon',
  'pick-adventurer': 'Choose adventurer',
  'match-over': 'Match over',
}

/** @type {Record<string, string>} */
const HERO_LABELS = {
  WARRIOR: 'Warrior',
  BARBARIAN: 'Barbarian',
  MAGE: 'Mage',
  ROGUE: 'Rogue',
}

/**
 * @param {string} actorLabel
 * @param {string} hero
 * @returns {string}
 */
export function adventurerChoiceHeadline(actorLabel, hero) {
  const label = HERO_LABELS[hero] ?? hero
  return `${actorLabel} chose ${label}`
}

/**
 * @param {string | null | undefined} phase
 * @returns {string}
 */
export function matchPhaseBoardLabel(phase) {
  if (phase == null || phase === '') return ''
  return PHASE_LABELS[phase] ?? phase
}

/**
 * @param {{ type?: string, equipmentId?: string, species?: string, hero?: string } | null | undefined} action
 * @returns {string}
 */
export function legalActionBoardLabel(action) {
  if (!action || typeof action.type !== 'string') return ''
  switch (action.type) {
    case 'PASS':
      return 'Pass'
    case 'DRAW':
      return 'Draw from deck'
    case 'ADD_TO_DUNGEON':
      return 'Add card to dungeon'
    case 'SACRIFICE':
      return sacrificeActionLabel(action.equipmentId ?? '')
    case 'DECLARE_VORPAL':
      return `Declare ${action.species ?? 'species'}`
    case 'CHOOSE_NEXT_ADVENTURER': {
      const hero = action.hero ?? ''
      const label = HERO_LABELS[hero] ?? hero
      return `Play as ${label}`
    }
    case 'REVEAL_OR_CONTINUE':
      return 'Reveal / continue'
    case 'USE_FIRE_AXE':
      return 'Use Fire Axe'
    case 'DECLINE_FIRE_AXE':
      return 'Continue (skip Fire Axe)'
    case 'USE_POLYMORPH':
      return 'Use Polymorph'
    case 'DECLINE_POLYMORPH':
      return 'Continue (skip Polymorph)'
    case 'ADVANCE_DUNGEON':
      return 'Run dungeon'
    default:
      return action.type
  }
}

/**
 * @param {string} actor
 * @param {{ action?: { type?: string, equipmentId?: string, species?: string, hero?: string } | null, dungeonRunResult?: string | null }} entry
 * @returns {string}
 */
export function historyHeadlineForHistoryEntry(actor, entry) {
  if (entry.dungeonRunResult) {
    return `${actor} resolved the dungeon run (${entry.dungeonRunResult}).`
  }
  const action = entry.action ?? {}
  const type = action.type
  switch (type) {
    case 'PASS':
      return `${actor} passed.`
    case 'DRAW':
      return `${actor} drew from the deck.`
    case 'ADD_TO_DUNGEON':
      return `${actor} added a card to the dungeon.`
    case 'SACRIFICE': {
      const name = equipmentShortName(action.equipmentId ?? '')
      return `${actor} sacrificed ${name}.`
    }
    case 'DECLARE_VORPAL':
      return `${actor} declared ${action.species ?? 'species'}.`
    case 'CHOOSE_NEXT_ADVENTURER': {
      const hero = action.hero ?? ''
      const label = HERO_LABELS[hero] ?? hero
      return `${actor} chose to play as ${label}.`
    }
    case 'REVEAL_OR_CONTINUE':
      return `${actor} revealed / continued.`
    case 'USE_FIRE_AXE':
      return `${actor} used Fire Axe.`
    case 'DECLINE_FIRE_AXE':
      return `${actor} continued without using Fire Axe.`
    case 'USE_POLYMORPH':
      return `${actor} used Polymorph.`
    case 'DECLINE_POLYMORPH':
      return `${actor} continued without using Polymorph.`
    case 'ADVANCE_DUNGEON':
      return `${actor} ran the dungeon.`
    default:
      return `${actor} performed ${type ?? 'UNKNOWN_ACTION'}.`
  }
}

/**
 * @param {string} phaseBefore
 * @param {string} phaseAfter
 * @param {number} rngStepBefore
 * @param {number} rngStepAfter
 * @returns {string}
 */
export function formatHistoryProvenanceLine(phaseBefore, phaseAfter, rngStepBefore, rngStepAfter) {
  const a = matchPhaseBoardLabel(phaseBefore)
  const b = matchPhaseBoardLabel(phaseAfter)
  return `${a} → ${b} | rng ${rngStepBefore}->${rngStepAfter}`
}
