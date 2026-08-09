import assert from 'node:assert/strict'
import test from 'node:test'
import { projectMight, sumFactionProjectedMight } from './projectMight.js'

/** @type {import('../../../tradeGraph/buildCandidateRoutes.js').TradeRouteEdge} */
function edge(partial) {
  return {
    id: partial.id,
    fromSettlementId: partial.fromSettlementId,
    toSettlementId: partial.toSettlementId,
    mode: partial.mode ?? 'road',
    haulDistanceFraction: partial.haulDistanceFraction ?? 1,
    capacityLb: 1,
    transportCostCpPerLb: 1,
    directionalFrictionAtoB: partial.directionalFrictionAtoB ?? 1,
    directionalFrictionBtoA: partial.directionalFrictionBtoA ?? 1,
  }
}

test('projected might is full capacity at the contested settlement itself', () => {
  const might = projectMight({
    contributorCapacity: 100,
    fromSettlementId: 'stake',
    contestedSettlementId: 'stake',
    candidateEdges: [],
    strategicReachHaulFractions: { overland: 4, road: 4, inlandWater: 8, openSea: 12 },
  })
  assert.equal(might, 100)
})

test('no logistics corridor yields zero projected might', () => {
  const might = projectMight({
    contributorCapacity: 100,
    fromSettlementId: 'a',
    contestedSettlementId: 'b',
    candidateEdges: [],
    strategicReachHaulFractions: { overland: 4, road: 4, inlandWater: 8, openSea: 12 },
  })
  assert.equal(might, 0)
})

test('projection attenuates along candidate edges with directional haul friction', () => {
  const reach = { overland: 10, road: 10, inlandWater: 10, openSea: 10 }
  const easy = projectMight({
    contributorCapacity: 100,
    fromSettlementId: 'a',
    contestedSettlementId: 'b',
    candidateEdges: [
      edge({
        id: 'a-b',
        fromSettlementId: 'a',
        toSettlementId: 'b',
        haulDistanceFraction: 1,
        directionalFrictionAtoB: 0.75,
        directionalFrictionBtoA: 1.5,
      }),
    ],
    strategicReachHaulFractions: reach,
  })
  const hard = projectMight({
    contributorCapacity: 100,
    fromSettlementId: 'a',
    contestedSettlementId: 'b',
    candidateEdges: [
      edge({
        id: 'a-b',
        fromSettlementId: 'a',
        toSettlementId: 'b',
        haulDistanceFraction: 1,
        directionalFrictionAtoB: 1.5,
        directionalFrictionBtoA: 0.75,
      }),
    ],
    strategicReachHaulFractions: reach,
  })
  assert.ok(easy > 0)
  assert.ok(hard > 0)
  assert.ok(easy > hard)
})

test('soft cutoff near strategic reach yields near-zero far contribution', () => {
  const reach = { overland: 4, road: 4, inlandWater: 4, openSea: 4 }
  const near = projectMight({
    contributorCapacity: 100,
    fromSettlementId: 'a',
    contestedSettlementId: 'b',
    candidateEdges: [
      edge({
        id: 'a-b',
        fromSettlementId: 'a',
        toSettlementId: 'b',
        haulDistanceFraction: 1,
      }),
    ],
    strategicReachHaulFractions: reach,
  })
  const beyond = projectMight({
    contributorCapacity: 100,
    fromSettlementId: 'a',
    contestedSettlementId: 'b',
    candidateEdges: [
      edge({
        id: 'a-b',
        fromSettlementId: 'a',
        toSettlementId: 'b',
        haulDistanceFraction: 5,
      }),
    ],
    strategicReachHaulFractions: reach,
  })
  assert.ok(near > 0)
  assert.equal(beyond, 0)
})

test('unaligned stake defense aggregates the stake pin alone', () => {
  const reach = { overland: 10, road: 10, inlandWater: 10, openSea: 10 }
  const edges = [
    edge({
      id: 'a-b',
      fromSettlementId: 'a',
      toSettlementId: 'b',
      haulDistanceFraction: 1,
    }),
  ]
  const unaligned = sumFactionProjectedMight({
    memberSettlementIds: ['b'],
    capacityBySettlementId: { a: 200, b: 50 },
    contestedSettlementId: 'b',
    candidateEdges: edges,
    strategicReachHaulFractions: reach,
  })
  const faction = sumFactionProjectedMight({
    memberSettlementIds: ['a', 'b'],
    capacityBySettlementId: { a: 200, b: 50 },
    contestedSettlementId: 'b',
    candidateEdges: edges,
    strategicReachHaulFractions: reach,
  })
  assert.equal(unaligned, 50)
  assert.ok(faction > unaligned)
})

test('crow-flies adjacency without a corridor edge does not project', () => {
  const might = projectMight({
    contributorCapacity: 100,
    fromSettlementId: 'a',
    contestedSettlementId: 'b',
    candidateEdges: [
      edge({
        id: 'a-c',
        fromSettlementId: 'a',
        toSettlementId: 'c',
        haulDistanceFraction: 1,
      }),
    ],
    strategicReachHaulFractions: { overland: 10, road: 10, inlandWater: 10, openSea: 10 },
  })
  assert.equal(might, 0)
})
