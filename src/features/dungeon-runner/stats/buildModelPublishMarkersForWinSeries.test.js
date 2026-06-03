import assert from 'node:assert/strict'
import test from 'node:test'
import {
  attachLabelIndexToModelPublishMarkers,
  buildModelPublishMarkersForWinSeries,
} from './buildModelPublishMarkersForWinSeries.js'

test('buildModelPublishMarkersForWinSeries skips models published before first match in series', () => {
  const series = [
    { humanWon: true, createdAt: '2026-05-21T00:00:00.000Z' },
    { humanWon: false, createdAt: '2026-05-22T00:00:00.000Z' },
    { humanWon: true, createdAt: '2026-05-23T00:00:00.000Z' },
  ]
  const markers = buildModelPublishMarkersForWinSeries({
    series,
    publishedAtByModelId: {
      'v0.1.29a': '2026-04-28T21:18:57.000Z',
      'v0.2.01': '2026-05-20T05:04:06.000Z',
      latest: '2026-05-25T19:07:34.055Z',
    },
    chartSequenceMin: 2,
    chartSequenceMax: 3,
  })
  assert.equal(markers.length, 0)
})

test('buildModelPublishMarkersForWinSeries maps in-window publish to first match at or after publish time', () => {
  const series = [
    { humanWon: true, createdAt: '2026-05-20T00:00:00.000Z' },
    { humanWon: false, createdAt: '2026-05-21T18:00:00.000Z' },
    { humanWon: true, createdAt: '2026-05-23T00:00:00.000Z' },
  ]
  const markers = buildModelPublishMarkersForWinSeries({
    series,
    publishedAtByModelId: { 'v0.2.02': '2026-05-21T12:00:00.000Z' },
    chartSequenceMin: 2,
    chartSequenceMax: 3,
  })
  assert.equal(markers.length, 1)
  assert.equal(markers[0].modelId, 'v0.2.02')
  assert.equal(markers[0].sequence, 2)
})

test('buildModelPublishMarkersForWinSeries omits markers outside rolling chart sequence range', () => {
  const series = [
    { humanWon: true, createdAt: '2026-05-20T00:00:00.000Z' },
    { humanWon: false, createdAt: '2026-05-21T00:00:00.000Z' },
    { humanWon: true, createdAt: '2026-05-22T00:00:00.000Z' },
    { humanWon: true, createdAt: '2026-05-23T00:00:00.000Z' },
    { humanWon: false, createdAt: '2026-05-24T00:00:00.000Z' },
  ]
  const markers = buildModelPublishMarkersForWinSeries({
    series,
    publishedAtByModelId: { 'v0.2.01': '2026-05-20T05:04:06.000Z' },
    chartSequenceMin: 4,
    chartSequenceMax: 5,
  })
  assert.equal(markers.length, 0)
})

test('attachLabelIndexToModelPublishMarkers maps sequence to chart label index', () => {
  const attached = attachLabelIndexToModelPublishMarkers(
    ['3', '4', '5'],
    [{ sequence: 4, modelId: 'v0.2.01', publishedAtMs: 1 }],
  )
  assert.equal(attached.length, 1)
  assert.equal(attached[0].labelIndex, 1)
})
