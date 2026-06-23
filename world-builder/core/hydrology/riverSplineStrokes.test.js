import assert from 'node:assert/strict'
import test from 'node:test'
import { generateDerivedGeography } from '../generateDerivedGeography.js'
import { DEFAULT_GEOGRAPHY_SEED } from '../../worldBuilderPageModel.js'
import {
  buildRiverSplineStrokeSegments,
  resolveRiverStrokeWidth,
  sampleRiverSpline,
} from './riverSplineStrokes.js'

test('sampleRiverSpline produces more points than control points', () => {
  const points = sampleRiverSpline(
    [
      { x: 1.5, y: 2.5 },
      { x: 3.5, y: 2.5 },
      { x: 5.5, y: 4.5 },
    ],
    [1, 3, 5],
    4,
  )

  assert.ok(points.length > 3)
  assert.ok(points[0].width >= 1)
  assert.ok(points.at(-1).width >= 1)
})

test('resolveRiverStrokeWidth grows with channel width', () => {
  const channelWidth = new Float32Array([0, 4, 10])
  const flowDirection = new Int16Array([-1, 4, 4])

  const tributary = resolveRiverStrokeWidth({
    idx: 1,
    channelWidth,
    maxChannelWidth: 10,
    flowDirection,
    width: 3,
    height: 1,
  })
  const trunk = resolveRiverStrokeWidth({
    idx: 2,
    channelWidth,
    maxChannelWidth: 10,
    flowDirection,
    width: 3,
    height: 1,
  })

  assert.ok(trunk > tributary)
})

test('buildRiverSplineStrokeSegments returns smooth chains for default seed', () => {
  const doc = generateDerivedGeography({
    geographySeed: DEFAULT_GEOGRAPHY_SEED,
    prevailingWindDegrees: 90,
    width: 128,
    height: 128,
  })

  const segments = buildRiverSplineStrokeSegments(doc)
  assert.ok(segments.length > 0)
  assert.ok(segments.some((segment) => segment.points.length > 4))
  assert.ok(segments.some((segment) => segment.points.some((point) => point.width > 1.5)))
})
