import assert from 'node:assert/strict'
import test from 'node:test'
import { COLONIZATION_TRADE_SUBSTEPS } from './colonizationEpochSteps.js'
import {
  tradeSubstepIndexForId,
  wrapTradeClearingHooksWithEpochIndices,
} from './tradeSubstepIndex.js'

test('tradeSubstepIndexForId matches COLONIZATION_TRADE_SUBSTEPS order', () => {
  for (let index = 0; index < COLONIZATION_TRADE_SUBSTEPS.length; index += 1) {
    assert.equal(tradeSubstepIndexForId(COLONIZATION_TRADE_SUBSTEPS[index].id), index)
  }
})

test('wrapTradeClearingHooksWithEpochIndices adds catalog indices', () => {
  /** @type {Array<{ type: string, substepId: string, substepIndex?: number }>} */
  const events = []
  const wrapped = wrapTradeClearingHooksWithEpochIndices({
    onTradeSubstep(payload) {
      events.push(payload)
    },
  })
  wrapped?.onTradeSubstep?.({ type: 'substep-start', substepId: 'prosperity' })
  wrapped?.onTradeSubstep?.({
    type: 'substep-item',
    substepId: 'offMap',
    itemIndex: 1,
    itemCount: 2,
  })
  assert.equal(events[0].substepIndex, tradeSubstepIndexForId('prosperity'))
  assert.equal(events[1].substepIndex, tradeSubstepIndexForId('offMap'))
  assert.equal(events[1].itemIndex, 1)
})
