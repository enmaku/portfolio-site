import { formatHistoryProvenanceLine, historyHeadlineForHistoryEntry } from './dungeonRunnerPlayerPhrasing.js'

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
    headline: historyHeadlineForHistoryEntry(actor, entry),
    provenance: formatHistoryProvenanceLine(
      entry.phaseBefore,
      entry.phaseAfter,
      entry.rngStepBefore,
      entry.rngStepAfter,
    ),
  }
}
