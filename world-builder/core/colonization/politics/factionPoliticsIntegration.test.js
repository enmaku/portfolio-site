import assert from 'node:assert/strict'
import test from 'node:test'
import { applyPoliticsPhase } from './applyPoliticsPhase.js'
import { HISTORY_KIND_FACTION_EMERGED, HISTORY_KIND_INCREMENT3_LATCHED } from './historyKinds.js'
import { createDefaultColonizationSlice } from '../createDefaultColonizationSlice.js'

function flatLandDoc(width, height) {
  const n = width * height
  return {
    gridWidth: width,
    gridHeight: height,
    arableRaster: new Float32Array(n).fill(2),
    timberRaster: new Float32Array(n).fill(1),
    fields: {
      elevation: new Float32Array(n).fill(0.6),
      movementCost: new Float32Array(n).fill(1),
    },
    lakeMask: new Uint8Array(n),
    riverCorridorMask: new Uint8Array(n),
  }
}

test('same politics inputs replay identical membership history sequence', async () => {
  async function runSequence() {
    let slice = createDefaultColonizationSlice()
    slice.colonistSettings.threeDayHaulDistance = 3
    slice.settlements = [
      { id: 'a', x: 2, y: 2, population: 1200, status: 'living', tier: 'town' },
      { id: 'b', x: 35, y: 35, population: 1200, status: 'living', tier: 'town' },
    ]
    const doc = flatLandDoc(40, 40)
    const kinds = []
    for (let epoch = 1; epoch <= 8; epoch += 1) {
      slice = { ...slice, epoch }
      const result = await applyPoliticsPhase({
        slice,
        worldDocument: doc,
        primaryClaim: {},
      })
      slice = result.slice
      for (const entry of result.events) {
        kinds.push(`${entry.epoch}:${entry.kind}:${entry.factionId ?? ''}:${entry.cause ?? ''}`)
      }
    }
    return { kinds, slice }
  }

  const first = await runSequence()
  const second = await runSequence()
  assert.deepStrictEqual(first.kinds, second.kinds)
  assert.ok(first.kinds.some((k) => k.includes(HISTORY_KIND_INCREMENT3_LATCHED)))
  assert.ok(first.kinds.some((k) => k.includes(HISTORY_KIND_FACTION_EMERGED)))
  assert.strictEqual(
    first.slice.settlements.find((s) => s.id === 'a').factionId,
    second.slice.settlements.find((s) => s.id === 'a').factionId,
  )
})

test('living factions are never nested under one another after absorption', async () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 50
  slice.colonistSettings.threeDayHaulDistance = 3
  slice.increment3LatchedEpoch = 10
  slice.factions = [
    {
      id: 'winner',
      capitalSettlementId: 'a',
      settlementIds: ['a'],
      status: 'active',
      emergedEpoch: 12,
    },
    {
      id: 'loser',
      capitalSettlementId: 'b',
      settlementIds: ['b'],
      status: 'active',
      emergedEpoch: 14,
    },
  ]
  slice.settlements = [
    { id: 'a', x: 2, y: 2, population: 1200, status: 'living', tier: 'town', factionId: 'winner' },
    { id: 'b', x: 35, y: 35, population: 0, status: 'ruin', tier: null, factionId: 'loser' },
  ]

  const { slice: next } = await applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(40, 40),
    primaryClaim: {},
    warOutcomes: [{ loserFactionId: 'loser', winnerFactionId: 'winner' }],
  })

  const active = next.factions.filter((f) => f.status === 'active')
  assert.strictEqual(active.length, 1)
  assert.ok(!('parentFactionId' in active[0]))
})
