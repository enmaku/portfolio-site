import assert from 'node:assert/strict'
import test from 'node:test'
import { derivePrevailingWindFromSeed } from '../derivePrevailingWindFromSeed.js'
import { buildWindRoseSchedule } from './buildWindRoseSchedule.js'

function countKinds(kinds) {
  const counts = { prevailing: 0, secondary: 0, scatter: 0 }
  for (const kind of kinds) {
    counts[kind] += 1
  }
  return counts
}

test('buildWindRoseSchedule is deterministic for the same inputs', () => {
  const params = {
    geographySeed: 1370491305,
    prevailingWindDegrees: 295,
    secondaryMaximumDegrees: 25,
  }
  const a = buildWindRoseSchedule(params)
  const b = buildWindRoseSchedule(params)
  assert.deepEqual(a.bearings, b.bearings)
  assert.deepEqual(a.kinds, b.kinds)
})

test('buildWindRoseSchedule realizes locked lobe counts for N=20', () => {
  const { kinds, bearings } = buildWindRoseSchedule({
    geographySeed: 42,
    prevailingWindDegrees: 90,
    secondaryMaximumDegrees: 180,
  })
  assert.equal(bearings.length, 20)
  assert.equal(kinds.length, 20)
  assert.deepEqual(countKinds(kinds), { prevailing: 7, secondary: 4, scatter: 9 })
})

test('buildWindRoseSchedule places prevailing and secondary at their absolute bearings', () => {
  const prevailing = 40
  const secondary = 200
  const { bearings, kinds } = buildWindRoseSchedule({
    geographySeed: 99,
    prevailingWindDegrees: prevailing,
    secondaryMaximumDegrees: secondary,
  })
  for (let i = 0; i < kinds.length; i += 1) {
    if (kinds[i] === 'prevailing') {
      assert.equal(bearings[i], prevailing)
    }
    if (kinds[i] === 'secondary') {
      assert.equal(bearings[i], secondary)
    }
  }
})

test('buildWindRoseSchedule rotates scatter with prevailing relative to seed frame', () => {
  const geographySeed = 12345
  const frame = derivePrevailingWindFromSeed(geographySeed)
  const secondary = (frame + 90) % 360
  const atFrame = buildWindRoseSchedule({
    geographySeed,
    prevailingWindDegrees: frame,
    secondaryMaximumDegrees: secondary,
  })
  const rotated = buildWindRoseSchedule({
    geographySeed,
    prevailingWindDegrees: (frame + 45) % 360,
    secondaryMaximumDegrees: (secondary + 45) % 360,
  })

  for (let i = 0; i < atFrame.kinds.length; i += 1) {
    if (atFrame.kinds[i] !== 'scatter') {
      continue
    }
    const expected = (((atFrame.bearings[i] + 45) % 360) + 360) % 360
    assert.equal(rotated.bearings[i], expected)
    assert.equal(rotated.kinds[i], 'scatter')
  }
})
