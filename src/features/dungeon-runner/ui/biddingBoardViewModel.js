import { getHeroIdentity } from './heroIdentity.js'

export function createBiddingBoardViewModel({ state, visibleState, activeAnimation, viewerSeatId, settings }) {
  const revealedMonsterCard = visibleState?.bidding?.revealedMonsterCard ?? null
  const consumedSet = new Set(activeAnimation?.payload?.consumedEquipmentIds ?? [])
  const centerEquipment = state?.centerEquipment ?? []
  const centerSet = new Set(centerEquipment)
  const displayOrder =
    state?.bidding?.equipmentDisplayOrder?.length > 0 ? state.bidding.equipmentDisplayOrder : [...centerEquipment]
  const equipment = displayOrder.map((equipmentId) => ({
    equipmentId,
    removed: !centerSet.has(equipmentId),
    consumed: consumedSet.has(equipmentId),
  }))
  const heroCue = getHeroIdentity(state?.hero)
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

  return {
    heroCue,
    primaryCard: {
      variant: revealedMonsterCard ? 'revealed' : 'hidden',
      monsterCard: revealedMonsterCard,
    },
    secondary: {
      deckCount: state?.bidding?.monsterDeck?.length ?? 0,
      dungeonCount: state?.bidding?.dungeonMonsters?.length ?? 0,
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

