import { BIDDING_SUBPHASES, MATCH_PHASES } from '../engine/kernel.js'
import { viewerMaySeeBiddingDrawFace } from './biddingPresentationVisibility.js'
import { getAdventurerIdentity, getAdventurerTypeChipLabel } from '../data/gameDataCatalog.js'

const BIDDING_CARD_BEATS = new Set(['BIDDING_DRAW', 'BIDDING_ADD', 'BIDDING_SACRIFICE'])

export function createBiddingBoardViewModel({ state, visibleState, activeAnimation, viewerSeatId, settings }) {
  const revealedMonsterCard = visibleState?.bidding?.revealedMonsterCard ?? null
  const consumedSet = new Set(
    activeAnimation?.payload?.expendedEquipmentIds ?? activeAnimation?.payload?.consumedEquipmentIds ?? [],
  )
  const centerEquipment = state?.centerEquipment ?? []
  const centerSet = new Set(centerEquipment)
  const displayOrder =
    state?.bidding?.equipmentDisplayOrder?.length > 0 ? state.bidding.equipmentDisplayOrder : [...centerEquipment]
  const equipment = displayOrder.map((equipmentId) => ({
    equipmentId,
    removed: !centerSet.has(equipmentId),
    consumed: consumedSet.has(equipmentId),
  }))
  const heroIdentity = getAdventurerIdentity(state?.hero)
  const heroCue = {
    ...heroIdentity,
    typeChipLabel: getAdventurerTypeChipLabel(state?.hero),
  }
  const memoryAidEnabled = settings?.memoryAidEnabled === true
  const ownAdds = (visibleState?.playerOwnPileAdds ?? {})[viewerSeatId ?? ''] ?? []
  const monsterDeck = state?.bidding?.monsterDeck ?? []
  const knownDeckCountHint = memoryAidEnabled ? Math.min(monsterDeck.length, ownAdds.length) : null
  const faceUpDeckSlots = memoryAidEnabled ? Math.min(monsterDeck.length, ownAdds.length) : 0
  const deckSplayCards = memoryAidEnabled
    ? monsterDeck.map((species, index) =>
        index < faceUpDeckSlots
          ? { visibility: 'face', species }
          : { visibility: 'back', species: null },
      )
    : []

  let primaryVariant = 'empty'
  let primaryMonster = revealedMonsterCard

  if (revealedMonsterCard) {
    primaryVariant = 'revealed'
  } else if (
    state?.bidding?.subphase === BIDDING_SUBPHASES.PENDING &&
    state?.bidding?.revealedMonsterCard != null
  ) {
    primaryVariant = 'hidden'
    primaryMonster = null
  } else if (activeAnimation?.kind === 'BIDDING_SACRIFICE') {
    const p = activeAnimation.payload ?? {}
    const eliminated = p.eliminatedMonsterCard ?? null
    const revealedTo = p.revealedToSeatId ?? null
    if (eliminated && viewerMaySeeBiddingDrawFace({ viewerSeatId, actorSeatId: revealedTo })) {
      primaryVariant = 'revealed'
      primaryMonster = eliminated
    } else {
      primaryVariant = 'hidden'
    }
  } else if (activeAnimation?.kind && BIDDING_CARD_BEATS.has(activeAnimation.kind)) {
    primaryVariant = 'hidden'
  }

  return {
    heroCue,
    primaryCard: {
      variant: primaryVariant,
      monsterCard: primaryMonster,
    },
    secondary: {
      deckCount: state?.bidding?.monsterDeck?.length ?? 0,
      dungeonCount: secondaryDungeonCount(state),
      activeSeatId: state?.turn?.activeSeatId ?? null,
      activeSeatLabel: resolveActiveSeatLabel(state),
      seats: buildSeatSummaries(state),
      equipment,
    },
    memoryAid: {
      enabled: memoryAidEnabled,
      deckTapEnabled: memoryAidEnabled,
      knownDeckCountHint,
      deckSplayCards,
    },
  }
}

function secondaryDungeonCount(state) {
  if (state?.phase === MATCH_PHASES.DUNGEON && state.dungeon) {
    const d = state.dungeon
    const rem = Array.isArray(d.remainingMonsters) ? d.remainingMonsters.length : 0
    const cur = d.currentMonster != null ? 1 : 0
    return rem + cur
  }
  return state?.bidding?.dungeonMonsters?.length ?? 0
}

function resolveActiveSeatLabel(state) {
  const id = state?.turn?.activeSeatId
  if (!id) return null
  const seat = (state?.seats ?? []).find((s) => s.id === id)
  return seat?.label ?? null
}

function buildSeatSummaries(state) {
  const seats = state?.seats ?? []
  const passedSeatIds = state?.bidding?.passedSeatIds ?? []
  const activeSeatId = state?.turn?.activeSeatId ?? null
  return seats.map((seat) => ({
    seatId: seat.id,
    label: seat.label ?? seat.id,
    passed: passedSeatIds.includes(seat.id),
    isActive: activeSeatId === seat.id,
  }))
}

