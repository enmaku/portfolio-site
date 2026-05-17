import assert from 'node:assert/strict'
import test from 'node:test'
import {
  viewerMaySeeAddToDungeonFlipDown,
  viewerMaySeeBiddingDrawFace,
} from './biddingPresentationVisibility.js'

test('draw face flip only for seated viewer matching actor', () => {
  assert.equal(viewerMaySeeBiddingDrawFace({ viewerSeatId: null, actorSeatId: 'a' }), false)
  assert.equal(viewerMaySeeBiddingDrawFace({ viewerSeatId: '', actorSeatId: 'a' }), false)
  assert.equal(viewerMaySeeBiddingDrawFace({ viewerSeatId: 'a', actorSeatId: null }), false)
  assert.equal(viewerMaySeeBiddingDrawFace({ viewerSeatId: 'a', actorSeatId: 'b' }), false)
  assert.equal(viewerMaySeeBiddingDrawFace({ viewerSeatId: 'a', actorSeatId: 'a' }), true)
})

test('add-to-dungeon flip down only for human actor who matches viewer seat', () => {
  assert.equal(
    viewerMaySeeAddToDungeonFlipDown({
      viewerSeatId: 's1',
      actorSeatId: 's1',
      actorRoleType: 'human',
    }),
    true,
  )
  assert.equal(
    viewerMaySeeAddToDungeonFlipDown({
      viewerSeatId: 's1',
      actorSeatId: 's2',
      actorRoleType: 'human',
    }),
    false,
  )
  assert.equal(
    viewerMaySeeAddToDungeonFlipDown({
      viewerSeatId: 's1',
      actorSeatId: 's1',
      actorRoleType: 'randombot',
    }),
    false,
  )
})
