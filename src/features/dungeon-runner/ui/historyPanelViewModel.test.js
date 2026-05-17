import assert from 'node:assert/strict'
import test from 'node:test'
import { buildHistoryPanelViewModel } from './historyPanelViewModel.js'

test('history panel stays hidden by default and provides mobile-first controls', () => {
  const viewModel = buildHistoryPanelViewModel({
    historyEntries: [],
    seats: [],
    isOpen: false,
  })

  assert.equal(viewModel.isOpen, false)
  assert.equal(viewModel.openLabel, 'Open history')
  assert.equal(viewModel.closeLabel, 'Close history')
  assert.equal(viewModel.emptyStateLabel, 'No actions yet.')
})

test('history panel renders human-readable provenance for bidding and dungeon actions', () => {
  const viewModel = buildHistoryPanelViewModel({
    isOpen: true,
    seats: [
      { id: 'seat-1', label: 'Player' },
      { id: 'seat-2', label: 'Alice' },
    ],
    historyEntries: [
      {
        actorSeatId: 'seat-2',
        action: { type: 'DRAW' },
        phaseBefore: 'bidding',
        phaseAfter: 'bidding',
        rngStepBefore: 10,
        rngStepAfter: 11,
        dungeonRunResult: null,
      },
      {
        actorSeatId: 'seat-1',
        action: { type: 'ADVANCE_DUNGEON' },
        phaseBefore: 'dungeon',
        phaseAfter: 'pick-adventurer',
        rngStepBefore: 44,
        rngStepAfter: 45,
        dungeonRunResult: 'success',
      },
    ],
  })

  assert.equal(viewModel.entries.length, 2)
  assert.equal(viewModel.entries[0].headline, 'Alice drew from the deck.')
  assert.equal(viewModel.entries[0].provenance, 'Bidding → Bidding | rng 10->11')
  assert.equal(viewModel.entries[1].headline, 'Player resolved the dungeon run (success).')
  assert.equal(viewModel.entries[1].provenance, 'Dungeon → Choose adventurer | rng 44->45')
})

test('history panel describes vorpal declaration with species', () => {
  const viewModel = buildHistoryPanelViewModel({
    isOpen: true,
    seats: [{ id: 'seat-1', label: 'Player' }],
    historyEntries: [
      {
        actorSeatId: 'seat-1',
        action: { type: 'DECLARE_VORPAL', species: 'dragon' },
        phaseBefore: 'dungeon',
        phaseAfter: 'dungeon',
        rngStepBefore: 20,
        rngStepAfter: 21,
        dungeonRunResult: null,
      },
    ],
  })

  assert.equal(viewModel.entries.length, 1)
  assert.equal(viewModel.entries[0].headline, 'Player declared dragon.')
  assert.equal(viewModel.entries[0].provenance, 'Dungeon → Dungeon | rng 20->21')
})
