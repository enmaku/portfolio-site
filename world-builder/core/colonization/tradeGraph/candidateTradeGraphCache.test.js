import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCandidateTradeGraphCache,
  fingerprintCandidateTradeGraphParams,
  getOrBuildCandidateTradeGraph,
} from './candidateTradeGraphCache.js'
import { buildCandidateTradeGraph } from './buildCandidateRoutes.js'

test('candidate trade graph cache returns identical edges and skips rebuild on hit', () => {
  let builds = 0
  const cache = createCandidateTradeGraphCache()
  const params = {
    settlements: [
      { id: 'a', x: 1, y: 1, population: 100 },
      { id: 'b', x: 4, y: 1, population: 100 },
    ],
    gridWidth: 12,
    gridHeight: 4,
    threeDayHaulDistance: 8,
    modes: /** @type {'land'} */ ('land'),
  }

  const original = buildCandidateTradeGraph
  // Fingerprint stability
  assert.strictEqual(
    fingerprintCandidateTradeGraphParams(params),
    fingerprintCandidateTradeGraphParams({ ...params }),
  )

  const first = cache.getOrBuild(params)
  const second = cache.getOrBuild(params)
  assert.strictEqual(first, second)
  assert.strictEqual(cache.size(), 1)

  const viaHelper = getOrBuildCandidateTradeGraph(cache, params)
  assert.strictEqual(viaHelper, first)

  const land = getOrBuildCandidateTradeGraph(null, params)
  assert.deepStrictEqual(
    land.edges.map((e) => e.id),
    original(params).edges.map((e) => e.id),
  )

  // Second call with same cache key must not grow the store.
  builds = cache.size()
  cache.getOrBuild(params)
  assert.strictEqual(cache.size(), builds)
})
