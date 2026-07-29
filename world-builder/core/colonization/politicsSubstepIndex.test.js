import assert from 'node:assert/strict'
import test from 'node:test'
import { COLONIZATION_POLITICS_SUBSTEPS } from './colonizationEpochSteps.js'
import {
  politicsSubstepIndexForId,
  wrapPoliticsHooksWithEpochIndices,
} from './politicsSubstepIndex.js'

test('politicsSubstepIndexForId matches COLONIZATION_POLITICS_SUBSTEPS order', () => {
  for (let index = 0; index < COLONIZATION_POLITICS_SUBSTEPS.length; index += 1) {
    assert.equal(politicsSubstepIndexForId(COLONIZATION_POLITICS_SUBSTEPS[index].id), index)
  }
})

test('wrapPoliticsHooksWithEpochIndices adds catalog indices', () => {
  /** @type {Array<{ type: string, substepId: string, substepIndex?: number }>} */
  const events = []
  const wrapped = wrapPoliticsHooksWithEpochIndices({
    onPoliticsSubstep(payload) {
      events.push(payload)
    },
  })
  wrapped?.onPoliticsSubstep?.({ type: 'substep-start', substepId: 'conflict' })
  wrapped?.onPoliticsSubstep?.({
    type: 'substep-item',
    substepId: 'conflict',
    itemIndex: 3,
    itemCount: 12,
  })
  assert.equal(events[0].substepIndex, politicsSubstepIndexForId('conflict'))
  assert.equal(events[1].substepIndex, politicsSubstepIndexForId('conflict'))
  assert.equal(events[1].itemIndex, 3)
})
