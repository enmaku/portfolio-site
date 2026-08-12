import assert from 'node:assert/strict'
import test from 'node:test'
import { derivePrevailingWindFromSeed } from '../derivePrevailingWindFromSeed.js'
import {
  buildWindRoseSchedule,
  WIND_ROSE_MIX,
  WIND_ROSE_SAMPLE_COUNT,
} from './buildWindRoseSchedule.js'

/**
 * @param {import('./buildWindRoseSchedule.js').WindRoseLobe[]} lobes
 */
function countKinds(lobes) {
  const counts = { prevailing: 0, secondary: 0, scatter: 0 }
  for (const lobe of lobes) {
    counts[lobe.kind] += 1
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
  assert.deepEqual(a.lobes, b.lobes)
})

test('buildWindRoseSchedule returns one prevailing, one secondary, and locked scatter count', () => {
  const { lobes } = buildWindRoseSchedule({
    geographySeed: 42,
    prevailingWindDegrees: 90,
    secondaryMaximumDegrees: 180,
  })
  const kinds = countKinds(lobes)
  assert.deepEqual(kinds, { prevailing: 1, secondary: 1, scatter: 9 })
  assert.equal(kinds.prevailing + kinds.secondary + kinds.scatter, 11)
  assert.equal(WIND_ROSE_SAMPLE_COUNT, 20)
})

test('buildWindRoseSchedule lobe weights match locked mix and sum to 1', () => {
  const { lobes } = buildWindRoseSchedule({
    geographySeed: 42,
    prevailingWindDegrees: 90,
    secondaryMaximumDegrees: 180,
  })
  const byKind = Object.fromEntries(lobes.map((lobe) => [lobe.kind, lobe]))
  assert.equal(byKind.prevailing.weight, WIND_ROSE_MIX.prevailing)
  assert.equal(byKind.secondary.weight, WIND_ROSE_MIX.secondary)
  const scatterWeight = lobes
    .filter((lobe) => lobe.kind === 'scatter')
    .reduce((sum, lobe) => sum + lobe.weight, 0)
  assert.ok(Math.abs(scatterWeight - WIND_ROSE_MIX.scatter) < 1e-12)
  const total = lobes.reduce((sum, lobe) => sum + lobe.weight, 0)
  assert.ok(Math.abs(total - 1) < 1e-12)
})

test('buildWindRoseSchedule places prevailing and secondary at their absolute bearings', () => {
  const prevailing = 40
  const secondary = 200
  const { lobes } = buildWindRoseSchedule({
    geographySeed: 99,
    prevailingWindDegrees: prevailing,
    secondaryMaximumDegrees: secondary,
  })
  for (const lobe of lobes) {
    if (lobe.kind === 'prevailing') {
      assert.equal(lobe.bearing, prevailing)
    }
    if (lobe.kind === 'secondary') {
      assert.equal(lobe.bearing, secondary)
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

  const atScatter = atFrame.lobes.filter((lobe) => lobe.kind === 'scatter')
  const rotatedScatter = rotated.lobes.filter((lobe) => lobe.kind === 'scatter')
  assert.equal(atScatter.length, rotatedScatter.length)
  for (let i = 0; i < atScatter.length; i += 1) {
    const expected = (((atScatter[i].bearing + 45) % 360) + 360) % 360
    assert.equal(rotatedScatter[i].bearing, expected)
  }
})
