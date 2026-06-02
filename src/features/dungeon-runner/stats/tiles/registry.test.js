import assert from 'node:assert/strict'
import test from 'node:test'
import { DUNGEON_RUNNER_STATS_TILE_REGISTRY } from './registry.js'

const EXPECTED_TILE_IDS = [
  'total-matches',
  'human-win-rate',
  'human-eliminated-rate',
  'rolling-human-win-rate',
  'end-variant-breakdown',
  'winner-role-breakdown',
]

test('dungeon runner stats tile registry includes all v1 tile ids', () => {
  const ids = DUNGEON_RUNNER_STATS_TILE_REGISTRY.map((tile) => tile.id)
  for (const id of EXPECTED_TILE_IDS) {
    assert.equal(ids.includes(id), true, `missing tile id: ${id}`)
  }
  assert.equal(ids.length, EXPECTED_TILE_IDS.length)
})

test('registry tiles expose id, title, presentation, and loadQuery', () => {
  for (const tile of DUNGEON_RUNNER_STATS_TILE_REGISTRY) {
    assert.equal(typeof tile.id, 'string')
    assert.equal(typeof tile.title, 'string')
    assert.equal(typeof tile.presentation, 'string')
    assert.equal(typeof tile.loadQuery, 'function')
  }
})

test('rate tiles use rate presentation', () => {
  const rateTileIds = ['human-win-rate', 'human-eliminated-rate']
  for (const id of rateTileIds) {
    const tile = DUNGEON_RUNNER_STATS_TILE_REGISTRY.find((entry) => entry.id === id)
    assert.ok(tile)
    assert.equal(tile.presentation, 'rate')
  }
})

test('breakdown tiles use breakdown-chart presentation', () => {
  const breakdownTileIds = ['end-variant-breakdown', 'winner-role-breakdown']
  for (const id of breakdownTileIds) {
    const tile = DUNGEON_RUNNER_STATS_TILE_REGISTRY.find((entry) => entry.id === id)
    assert.ok(tile)
    assert.equal(tile.presentation, 'breakdown-chart')
  }
})

test('rolling human win rate tile is fourth with timeseries presentation and full span', () => {
  const tile = DUNGEON_RUNNER_STATS_TILE_REGISTRY[3]
  assert.equal(tile.id, 'rolling-human-win-rate')
  assert.equal(tile.presentation, 'timeseries')
  assert.equal(tile.span, 'full')
})
