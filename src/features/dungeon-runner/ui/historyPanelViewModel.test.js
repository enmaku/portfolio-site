import assert from 'node:assert/strict'
import test from 'node:test'
import { buildHistoryPanelViewModel } from './historyPanelViewModel.js'

test('history panel stays hidden by default', () => {
  const viewModel = buildHistoryPanelViewModel({
    historyEntries: [],
    seats: [],
    isOpen: false,
  })

  assert.equal(viewModel.isOpen, false)
})
