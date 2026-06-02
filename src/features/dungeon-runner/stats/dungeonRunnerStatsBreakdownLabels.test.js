import assert from 'node:assert/strict'
import test from 'node:test'
import { getDungeonRunnerStatsBreakdownRowLabel } from './dungeonRunnerStatsBreakdownLabels.js'
import { END_VARIANT_BREAKDOWN_KEYS } from './tiles/endVariantBreakdownLoader.js'
import { DEFEAT_FLAVOR_BREAKDOWN_KEYS } from './tiles/defeatFlavorBreakdownLoader.js'
import { WINNER_ROLE_BREAKDOWN_TYPES } from './tiles/winnerRoleBreakdownLoader.js'

test('end variant breakdown labels cover every loader key', () => {
  for (const key of END_VARIANT_BREAKDOWN_KEYS) {
    const label = getDungeonRunnerStatsBreakdownRowLabel('end-variant-breakdown', key)
    assert.equal(typeof label, 'string')
    assert.ok(label.length > 0)
    assert.notEqual(label, key)
  }
})

test('winner role breakdown labels cover every loader key', () => {
  for (const key of WINNER_ROLE_BREAKDOWN_TYPES) {
    const label = getDungeonRunnerStatsBreakdownRowLabel('winner-role-breakdown', key)
    assert.equal(typeof label, 'string')
    assert.ok(label.length > 0)
    assert.notEqual(label, key)
  }
})

test('defeat flavor breakdown labels cover every loader key', () => {
  for (const key of DEFEAT_FLAVOR_BREAKDOWN_KEYS) {
    const label = getDungeonRunnerStatsBreakdownRowLabel('defeat-flavor-breakdown', key)
    assert.equal(typeof label, 'string')
    assert.ok(label.length > 0)
    assert.notEqual(label, key)
  }
})

test('unknown tile id falls back to row key', () => {
  assert.equal(getDungeonRunnerStatsBreakdownRowLabel('unknown-tile', 'nn'), 'nn')
})
