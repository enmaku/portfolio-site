import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computePrimaryClaimMap,
  recomputePrimaryClaims,
  serializeClaimMap,
} from './computePrimaryClaimMap.js'

test('computePrimaryClaimMap assigns exclusive ownership of isochrone cells to the founding pin', () => {
  const claimMap = computePrimaryClaimMap({
    pins: [{ id: 'settlement-a', x: 2, y: 2 }],
    budget: 2,
    gridWidth: 5,
    gridHeight: 5,
  })

  assert.ok(claimMap.cellsBySettlementId['settlement-a'].length > 0)
  assert.ok(
    claimMap.cellsBySettlementId['settlement-a'].every(
      (cell) => claimMap.ownerByCell[cell.y * 5 + cell.x] === 'settlement-a',
    ),
  )
  assert.ok(!claimMap.cellsBySettlementId['settlement-a'].some((cell) => cell.x === 0 && cell.y === 0))
})

test('computePrimaryClaimMap does not expand beyond the haul-shed budget', () => {
  const claimMap = computePrimaryClaimMap({
    pins: [{ id: 'settlement-a', x: 0, y: 0 }],
    budget: 1,
    gridWidth: 5,
    gridHeight: 5,
  })

  assert.ok(!claimMap.cellsBySettlementId['settlement-a'].some((cell) => cell.x === 4))
})

test('computePrimaryClaimMap ignores ruin pins', () => {
  const claimMap = computePrimaryClaimMap({
    pins: [
      { id: 'living', x: 1, y: 1, status: 'living' },
      { id: 'ruined', x: 3, y: 3, status: 'ruin' },
    ],
    budget: 2,
    gridWidth: 5,
    gridHeight: 5,
  })

  assert.ok(claimMap.cellsBySettlementId.living.length > 0)
  assert.deepStrictEqual(claimMap.cellsBySettlementId.ruined, undefined)
  assert.ok(!claimMap.ownerByCell.includes('ruined'))
})

test('recomputePrimaryClaims uses colonist haul distance and living settlements', () => {
  const claimMap = recomputePrimaryClaims({
    settlements: [{ id: 's1', x: 2, y: 2, status: 'living' }],
    colonistSettings: { threeDayHaulDistance: 1 },
    gridWidth: 5,
    gridHeight: 5,
  })

  assert.ok(claimMap.cellsBySettlementId.s1.some((cell) => cell.x === 2 && cell.y === 2))
  assert.ok(!claimMap.cellsBySettlementId.s1.some((cell) => cell.x === 4))
})

test('serializeClaimMap clones cell lists for tip storage', () => {
  const claimMap = computePrimaryClaimMap({
    pins: [{ id: 's1', x: 1, y: 1 }],
    budget: 1,
    gridWidth: 3,
    gridHeight: 3,
  })
  const serialized = serializeClaimMap(claimMap)
  serialized.s1[0].x = 99
  assert.notStrictEqual(claimMap.cellsBySettlementId.s1[0].x, 99)
})
