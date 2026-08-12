import assert from 'node:assert/strict'
import test from 'node:test'
import {
  captureSecondaryLinkOffset,
  normalizeWindDegrees,
  resolveLinkedSecondaryMaximum,
  windStateAfterPrevailingChange,
  windStateAfterSeedApply,
  windStateAfterSetSecondaryLinked,
} from './worldBuilderPageModel.js'

test('resolveLinkedSecondaryMaximum defaults to plus 90', () => {
  assert.equal(resolveLinkedSecondaryMaximum(10), 100)
  assert.equal(resolveLinkedSecondaryMaximum(300), 30)
})

test('captureSecondaryLinkOffset wraps to 0-359', () => {
  assert.equal(captureSecondaryLinkOffset(10, 100), 90)
  assert.equal(captureSecondaryLinkOffset(10, 5), 355)
})

test('windStateAfterPrevailingChange tracks secondary while linked', () => {
  const next = windStateAfterPrevailingChange(
    {
      prevailingWindDegrees: 10,
      secondaryMaximumDegrees: 100,
      secondaryMaximumLinked: true,
    },
    40,
  )
  assert.equal(next.prevailingWindDegrees, 40)
  assert.equal(next.secondaryMaximumDegrees, 130)
  assert.equal(next.secondaryMaximumLinked, true)
})

test('windStateAfterPrevailingChange leaves secondary alone when unlinked', () => {
  const next = windStateAfterPrevailingChange(
    {
      prevailingWindDegrees: 10,
      secondaryMaximumDegrees: 200,
      secondaryMaximumLinked: false,
    },
    40,
  )
  assert.equal(next.prevailingWindDegrees, 40)
  assert.equal(next.secondaryMaximumDegrees, 200)
})

test('windStateAfterSetSecondaryLinked captures offset on link', () => {
  const next = windStateAfterSetSecondaryLinked(
    {
      prevailingWindDegrees: 20,
      secondaryMaximumDegrees: 50,
      secondaryMaximumLinked: false,
    },
    true,
  )
  assert.equal(next.secondaryMaximumLinked, true)
  assert.equal(next.secondaryMaximumDegrees, 50)
  assert.equal(captureSecondaryLinkOffset(20, 50), 30)
})

test('windStateAfterSeedApply re-derives prevailing and linked secondary', () => {
  const next = windStateAfterSeedApply(424242, {
    prevailingWindDegrees: 1,
    secondaryMaximumDegrees: 2,
    secondaryMaximumLinked: true,
  })
  assert.equal(next.prevailingWindDegrees, normalizeWindDegrees(next.prevailingWindDegrees))
  assert.equal(next.secondaryMaximumLinked, true)
  assert.equal(next.secondaryMaximumDegrees, resolveLinkedSecondaryMaximum(next.prevailingWindDegrees))
})

test('windStateAfterSeedApply keeps absolute secondary when unlinked', () => {
  const next = windStateAfterSeedApply(424242, {
    prevailingWindDegrees: 1,
    secondaryMaximumDegrees: 222,
    secondaryMaximumLinked: false,
  })
  assert.equal(next.secondaryMaximumLinked, false)
  assert.equal(next.secondaryMaximumDegrees, 222)
})
