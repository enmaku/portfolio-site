export function createBiddingBoardViewModel({ state, visibleState, activeAnimation, viewerSeatId, settings }) {
  const revealedMonsterCard = visibleState?.bidding?.revealedMonsterCard ?? null
  const consumedSet = new Set(activeAnimation?.payload?.consumedEquipmentIds ?? [])
  const equipment = (state?.centerEquipment ?? []).map((equipmentId) => ({
    equipmentId,
    consumed: consumedSet.has(equipmentId),
  }))
  const heroCue = getHeroCue(state?.hero)
  const memoryAidEnabled = settings?.memoryAidEnabled === true
  const ownAdds = (visibleState?.playerOwnPileAdds ?? {})[viewerSeatId ?? ''] ?? []
  const knownDeckCountHint = memoryAidEnabled ? Math.min(state?.bidding?.monsterDeck?.length ?? 0, ownAdds.length) : null
  const deckSplayCards = memoryAidEnabled ? new Array(state?.bidding?.monsterDeck?.length ?? 0).fill({ kind: 'unknown' }) : []

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

function getHeroCue(hero) {
  if (hero === 'BARBARIAN') return { hero, accentClass: 'dr-hero--barbarian', badgeColor: 'deep-orange', buttonColor: 'deep-orange' }
  if (hero === 'MAGE') return { hero, accentClass: 'dr-hero--mage', badgeColor: 'deep-purple', buttonColor: 'deep-purple' }
  if (hero === 'ROGUE') return { hero, accentClass: 'dr-hero--rogue', badgeColor: 'teal', buttonColor: 'teal' }
  return { hero: hero ?? 'WARRIOR', accentClass: 'dr-hero--warrior', badgeColor: 'indigo', buttonColor: 'primary' }
}
