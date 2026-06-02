import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDungeonRunnerStatsPageModel } from './dungeonRunnerStatsPageModel.js'

test('buildDungeonRunnerStatsPageModel shows dashboard error when Firebase is not configured', () => {
  const model = buildDungeonRunnerStatsPageModel({ isFirebaseConfigured: false })
  assert.equal(model.showDashboardError, true)
  assert.equal(model.showTileGrid, false)
})

test('buildDungeonRunnerStatsPageModel shows tile grid with registry when Firebase is configured', () => {
  const model = buildDungeonRunnerStatsPageModel({ isFirebaseConfigured: true })
  assert.equal(model.showDashboardError, false)
  assert.equal(model.showTileGrid, true)
  assert.equal(model.tiles.some((tile) => tile.id === 'total-matches'), true)
  assert.equal(model.tiles.some((tile) => tile.id === 'human-win-rate'), true)
  assert.equal(model.tiles.some((tile) => tile.id === 'human-eliminated-rate'), true)
  assert.equal(model.tiles.some((tile) => tile.id === 'end-variant-breakdown'), true)
  assert.equal(model.tiles.some((tile) => tile.id === 'winner-role-breakdown'), true)
})
