import { ACTION_TYPES } from '../engine/kernel.js'
import { equipment, getEquipmentShortName } from '../data/gameDataCatalog.js'
import { createDungeonEquipmentModalView } from './dungeonEquipmentInteractions.js'

export function legalSacrificeEquipmentIds(legalActions = []) {
  return legalActions
    .filter((action) => action.type === ACTION_TYPES.SACRIFICE && typeof action.equipmentId === 'string')
    .map((action) => action.equipmentId)
}

export function isBiddingPostDrawContext({ phase, revealedMonsterCard, legalActions = [] }) {
  if (phase !== 'bidding' || revealedMonsterCard == null) return false
  return legalSacrificeEquipmentIds(legalActions).length > 0
}

export function canEnterBiddingSacrificeMode({
  isHumanTurn = false,
  phase = null,
  revealedMonsterCard = null,
  legalActions = [],
  humanGameplayBlocked = false,
} = {}) {
  if (humanGameplayBlocked || !isHumanTurn) return false
  return isBiddingPostDrawContext({ phase, revealedMonsterCard, legalActions })
}

export function buildBiddingPostDrawActionPane({
  sacrificeModeActive = false,
  phase = null,
  revealedMonsterCard = null,
  legalActions = [],
  humanGameplayBlocked = false,
} = {}) {
  if (!isBiddingPostDrawContext({ phase, revealedMonsterCard, legalActions })) {
    return []
  }
  if (sacrificeModeActive) {
    return [{ kind: 'cancelSacrificeMode' }]
  }
  const items = legalActions
    .filter((action) => action.type === ACTION_TYPES.ADD_TO_DUNGEON)
    .map((action) => ({ kind: 'engine', action }))
  if (!humanGameplayBlocked) {
    items.push({ kind: 'enterSacrificeMode' })
  }
  return items
}

export function buildBiddingSacrificeTokenFlags({
  sacrificeModeActive = false,
  equipmentId = '',
  removed = false,
  legalSacrificeEquipmentIds: sacrificableIds = [],
} = {}) {
  const sacrificable = new Set(sacrificableIds)
  const highlight =
    sacrificeModeActive && !removed && sacrificable.has(equipmentId)
  return {
    sacrificeHighlight: highlight,
    sacrificePulse: highlight,
  }
}

export function createBiddingSacrificeEquipmentModalView({
  equipmentId,
  legalActions = [],
  sacrificeModeActive = false,
} = {}) {
  const entry = equipment[equipmentId]
  const sacrificableIds = new Set(legalSacrificeEquipmentIds(legalActions))
  const showSacrificeButton =
    sacrificeModeActive && sacrificableIds.has(equipmentId)
  const base = createDungeonEquipmentModalView({ equipmentId, legalActions: [] })
  return {
    equipmentId,
    title: entry?.ui?.label ?? getEquipmentShortName(equipmentId),
    details: entry?.ui?.details ?? base.details,
    showUseButton: false,
    useAction: null,
    continueAction: null,
    showSacrificeButton,
    sacrificeAction: showSacrificeButton
      ? { type: ACTION_TYPES.SACRIFICE, equipmentId }
      : null,
  }
}

export function shouldUseBiddingSacrificeEquipmentModalView({
  phase = null,
  sacrificeModeActive = false,
} = {}) {
  return phase === 'bidding' && sacrificeModeActive
}
