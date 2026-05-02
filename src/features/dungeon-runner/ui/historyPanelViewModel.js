const ACTION_HEADLINES = {
  DRAW: (actor) => `${actor} drew from the monster deck.`,
  PASS: (actor) => `${actor} passed bidding priority.`,
  ADD_TO_DUNGEON: (actor) => `${actor} added the revealed monster to the dungeon.`,
  SACRIFICE: (actor, action) => `${actor} sacrificed ${action.equipmentId ?? 'equipment'}.`,
}

export function buildHistoryPanelViewModel({ historyEntries, seats, isOpen }) {
  return {
    isOpen: Boolean(isOpen),
    openLabel: 'Open history',
    closeLabel: 'Close history',
    emptyStateLabel: 'No actions yet.',
    entries: (historyEntries ?? []).map((entry) => mapEntry(entry, seats ?? [])),
  }
}

function mapEntry(entry, seats) {
  const actor = seats.find((seat) => seat.id === entry.actorSeatId)?.label ?? entry.actorSeatId ?? 'Unknown seat'
  return {
    headline: toHeadline(actor, entry),
    provenance: `${entry.phaseBefore} -> ${entry.phaseAfter} | rng ${entry.rngStepBefore}->${entry.rngStepAfter}`,
  }
}

function toHeadline(actor, entry) {
  if (entry.dungeonRunResult) {
    return `${actor} resolved the dungeon run (${entry.dungeonRunResult}).`
  }
  const formatter = ACTION_HEADLINES[entry.action?.type]
  if (formatter) return formatter(actor, entry.action ?? {})
  return `${actor} performed ${entry.action?.type ?? 'UNKNOWN_ACTION'}.`
}
