import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ALL_MAP_LAYER_IDS,
  createMapLayerRefreshRunner,
  isFullMapLayerRefresh,
  shouldRefreshMapLayer,
} from './mapLayerRefresh.js'

test('isFullMapLayerRefresh treats null and undefined as full rebuild', () => {
  assert.strictEqual(isFullMapLayerRefresh(null), true)
  assert.strictEqual(isFullMapLayerRefresh(undefined), true)
})

test('isFullMapLayerRefresh treats an explicit changed-layer set as partial rebuild', () => {
  assert.strictEqual(isFullMapLayerRefresh([]), false)
  assert.strictEqual(isFullMapLayerRefresh(['terrain']), false)
})

test('shouldRefreshMapLayer refreshes every layer on full rebuild', () => {
  for (const layerId of ALL_MAP_LAYER_IDS) {
    assert.strictEqual(shouldRefreshMapLayer(undefined, layerId), true)
  }
})

test('shouldRefreshMapLayer refreshes only listed layers on partial rebuild', () => {
  const changedLayers = ['timber', 'vectorOverlays']
  assert.strictEqual(shouldRefreshMapLayer(changedLayers, 'timber'), true)
  assert.strictEqual(shouldRefreshMapLayer(changedLayers, 'vectorOverlays'), true)
  assert.strictEqual(shouldRefreshMapLayer(changedLayers, 'arable'), false)
  assert.strictEqual(shouldRefreshMapLayer(changedLayers, 'terrain'), false)
})

test('createMapLayerRefreshRunner invokes every handler on full rebuild', () => {
  /** @type {Record<string, number>} */
  const calls = Object.fromEntries(ALL_MAP_LAYER_IDS.map((id) => [id, 0]))
  const runner = createMapLayerRefreshRunner(
    Object.fromEntries(
      ALL_MAP_LAYER_IDS.map((id) => [id, () => {
        calls[id] += 1
      }]),
    ),
  )

  runner.refresh()
  for (const layerId of ALL_MAP_LAYER_IDS) {
    assert.strictEqual(calls[layerId], 1)
  }
})

test('createMapLayerRefreshRunner invokes only changed handlers on partial rebuild', () => {
  /** @type {Record<string, number>} */
  const calls = Object.fromEntries(ALL_MAP_LAYER_IDS.map((id) => [id, 0]))
  const runner = createMapLayerRefreshRunner(
    Object.fromEntries(
      ALL_MAP_LAYER_IDS.map((id) => [id, () => {
        calls[id] += 1
      }]),
    ),
  )

  runner.refresh(['arable', 'metals'])
  assert.strictEqual(calls.arable, 1)
  assert.strictEqual(calls.metals, 1)
  assert.strictEqual(calls.timber, 0)
  assert.strictEqual(calls.terrain, 0)
  assert.strictEqual(calls.vectorOverlays, 0)
})

test('createMapLayerRefreshRunner hides unrefreshed layers when requested', () => {
  /** @type {string[]} */
  const hidden = []
  /** @type {string[]} */
  const refreshed = []
  const runner = createMapLayerRefreshRunner(
    Object.fromEntries(
      ALL_MAP_LAYER_IDS.map((id) => [
        id,
        () => {
          refreshed.push(id)
        },
      ]),
    ),
    {
      hideLayer(layerId) {
        hidden.push(layerId)
      },
    },
  )

  runner.refresh(['terrain', 'contours'], { hideUnrefreshedLayers: true })
  assert.deepStrictEqual(refreshed, ['terrain', 'contours'])
  assert.ok(hidden.includes('arable'))
  assert.ok(hidden.includes('rivers'))
  assert.ok(!hidden.includes('terrain'))
})
