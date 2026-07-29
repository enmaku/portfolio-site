import assert from 'node:assert/strict'
import test from 'node:test'
import {
  areBelligerentFactions,
  clearEligibleBelligerentTradeBlocks,
  filterCandidateEdgesForBelligerents,
  openBelligerentTradeBlock,
} from './belligerentTradeBlocks.js'
import { BELLIGERENT_PEACE_MIN_POST_WAR_EPOCHS } from './conflictConstants.js'

test('openBelligerentTradeBlock records a pair with peace eligibility after min post-war epochs', () => {
  const slice = { epoch: 10, belligerentTradeBlocks: [] }
  const next = openBelligerentTradeBlock({
    slice,
    aFactionId: 'f1',
    bFactionId: 'f2',
    epoch: 10,
  })
  assert.equal(next.belligerentTradeBlocks.length, 1)
  assert.equal(
    next.belligerentTradeBlocks[0].peaceEligibleEpoch,
    10 + BELLIGERENT_PEACE_MIN_POST_WAR_EPOCHS,
  )
  assert.equal(areBelligerentFactions(next.belligerentTradeBlocks, 'f1', 'f2'), true)
  assert.equal(areBelligerentFactions(next.belligerentTradeBlocks, 'f1', 'f3'), false)
})

test('peace clears the block at or after peaceEligibleEpoch', () => {
  let slice = {
    epoch: 10,
    belligerentTradeBlocks: [],
  }
  slice = openBelligerentTradeBlock({
    slice,
    aFactionId: 'loyalist',
    bFactionId: 'breakaway',
    epoch: 10,
  })
  const tooSoon = clearEligibleBelligerentTradeBlocks({ slice, epoch: 10 })
  assert.equal(tooSoon.belligerentTradeBlocks.length, 1)

  const cleared = clearEligibleBelligerentTradeBlocks({
    slice,
    epoch: 10 + BELLIGERENT_PEACE_MIN_POST_WAR_EPOCHS,
  })
  assert.equal(cleared.belligerentTradeBlocks.length, 0)
})

test('block is symmetric and ignores self pairs', () => {
  const slice = openBelligerentTradeBlock({
    slice: { belligerentTradeBlocks: [] },
    aFactionId: 'a',
    bFactionId: 'b',
    epoch: 1,
  })
  assert.equal(areBelligerentFactions(slice.belligerentTradeBlocks, 'b', 'a'), true)

  const same = openBelligerentTradeBlock({
    slice: { belligerentTradeBlocks: [] },
    aFactionId: 'a',
    bFactionId: 'a',
    epoch: 1,
  })
  assert.equal(same.belligerentTradeBlocks.length, 0)
})

test('filterCandidateEdgesForBelligerents drops edges between hot factions but keeps neutrals', () => {
  const blocks = openBelligerentTradeBlock({
    slice: { belligerentTradeBlocks: [] },
    aFactionId: 'f1',
    bFactionId: 'f2',
    epoch: 4,
  }).belligerentTradeBlocks

  const edges = [
    {
      id: 'hot',
      fromSettlementId: 's1',
      toSettlementId: 's2',
      mode: 'road',
      haulDistanceFraction: 1,
      capacityLb: 1,
      transportCostCpPerLb: 1,
      directionalFrictionAtoB: 1,
      directionalFrictionBtoA: 1,
    },
    {
      id: 'neutral',
      fromSettlementId: 's1',
      toSettlementId: 's3',
      mode: 'road',
      haulDistanceFraction: 1,
      capacityLb: 1,
      transportCostCpPerLb: 1,
      directionalFrictionAtoB: 1,
      directionalFrictionBtoA: 1,
    },
  ]
  const filtered = filterCandidateEdgesForBelligerents({
    edges,
    blocks,
    factionIdBySettlementId: { s1: 'f1', s2: 'f2', s3: 'f3' },
  })
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].id, 'neutral')
})
