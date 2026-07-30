import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isSoftPowerDominant,
  scoreSoftPowerBySettlement,
  SOFT_POWER_MAJORITY,
  SOFT_POWER_MARGIN_RATIO,
} from './scoreSoftPower.js'
import {
  advanceSoftPowerStreaks,
  SOFT_POWER_JOIN_HOLD_EPOCHS,
  SOFT_POWER_PAINT_STREAK_EPOCHS,
} from './softPowerStreaks.js'
import {
  countLivingFactionControl,
  resolveFactionalController,
} from './factionalControl.js'
import { goodsPairKey } from './onMapGoodsBilateralCpByPair.js'

/**
 * Contiguity of same-controller pins on an undirected neighbor graph.
 * @param {Record<string, string | null>} controllerById
 * @param {Array<[string, string]>} edges
 */
function largestComponentFraction(controllerById, edges) {
  /** @type {Map<string, Set<string>>} */
  const adj = new Map()
  for (const id of Object.keys(controllerById)) adj.set(id, new Set())
  for (const [a, b] of edges) {
    if (!adj.has(a) || !adj.has(b)) continue
    if (controllerById[a] == null || controllerById[a] !== controllerById[b]) continue
    adj.get(a).add(b)
    adj.get(b).add(a)
  }
  const ids = Object.keys(controllerById).filter((id) => controllerById[id] != null)
  if (ids.length === 0) return 1
  let best = 0
  const seen = new Set()
  for (const start of ids) {
    if (seen.has(start)) continue
    const stack = [start]
    seen.add(start)
    let size = 0
    while (stack.length) {
      const id = stack.pop()
      size += 1
      for (const n of adj.get(id) ?? []) {
        if (seen.has(n)) continue
        seen.add(n)
        stack.push(n)
      }
    }
    best = Math.max(best, size)
  }
  return best / ids.length
}

function jaccard(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  let inter = 0
  let union = 0
  for (const key of keys) {
    const av = a[key] ?? null
    const bv = b[key] ?? null
    if (av == null && bv == null) continue
    union += 1
    if (av === bv) inter += 1
  }
  return union === 0 ? 1 : inter / union
}

test('parameter sweep: majority and margin boundaries stay strict', () => {
  for (const share of [0.5, 0.5000001, 0.66, 0.67]) {
    for (const runner of [0, 0.25, 0.33, 0.34]) {
      const ok = isSoftPowerDominant({ share, runnerUpShare: runner })
      const expect =
        share > SOFT_POWER_MAJORITY &&
        (runner <= 0 || share >= runner * SOFT_POWER_MARGIN_RATIO)
      assert.equal(ok, expect)
    }
  }
})

test('believability: contiguous coastal soft sphere under default streaks', () => {
  const settlements = [
    { id: 'cap', factionId: 'coast', status: 'living', population: 200 },
    { id: 'm1', factionId: 'coast', status: 'living', population: 120 },
    { id: 'm2', factionId: 'coast', status: 'living', population: 110 },
    { id: 'f1', factionId: null, status: 'living', population: 60 },
    { id: 'f2', factionId: null, status: 'living', population: 55 },
    { id: 'f3', factionId: null, status: 'living', population: 50 },
    { id: 'inland', factionId: 'hill', status: 'living', population: 90 },
    { id: 'in2', factionId: 'hill', status: 'living', population: 80 },
  ]
  const factions = [
    {
      id: 'coast',
      capitalSettlementId: 'cap',
      settlementIds: ['cap', 'm1', 'm2'],
      status: 'active',
    },
    {
      id: 'hill',
      capitalSettlementId: 'inland',
      settlementIds: ['inland', 'in2'],
      status: 'active',
    },
  ]
  const edges = [
    ['cap', 'm1'],
    ['m1', 'm2'],
    ['m2', 'f1'],
    ['f1', 'f2'],
    ['f2', 'f3'],
    ['inland', 'in2'],
  ]
  /** @type {Record<string, number>} */
  const bilateral = {}
  for (const free of ['f1', 'f2', 'f3']) {
    bilateral[goodsPairKey(free, 'm2')] = 80
    bilateral[goodsPairKey(free, 'm1')] = 40
    bilateral[goodsPairKey(free, 'inland')] = 10
  }

  let state = {
    softPowerPaintStreak: {},
    softPowerJoinHoldStreak: {},
    softPowerClearStreak: {},
    softPowerPaintBySettlementId: {},
    softPowerJoinEligibleBySettlementId: {},
    softPowerRebellionPressureStreak: {},
    membershipCooldown: [],
  }

  /** @type {Record<string, string | null> | null} */
  let prevControllers = null
  let minJaccard = 1
  for (let epoch = 1; epoch <= 12; epoch += 1) {
    const scores = scoreSoftPowerBySettlement({
      settlements,
      factions,
      bilateralCpByPair: bilateral,
    })
    state = advanceSoftPowerStreaks({
      state,
      scores,
      epoch,
      mapGraySettlementIds: new Set(['f1', 'f2', 'f3']),
    }).state

    /** @type {Record<string, string | null>} */
    const controllers = {}
    for (const s of settlements) {
      controllers[s.id] = resolveFactionalController(s, {
        settlements,
        factions,
        softPowerPaintBySettlementId: state.softPowerPaintBySettlementId,
      })
    }
    if (prevControllers) {
      minJaccard = Math.min(minJaccard, jaccard(prevControllers, controllers))
    }
    prevControllers = controllers
  }

  assert.equal(state.softPowerPaintBySettlementId.f1, 'coast')
  assert.equal(state.softPowerPaintBySettlementId.f2, 'coast')
  assert.equal(state.softPowerPaintBySettlementId.f3, 'coast')
  assert.ok(
    countLivingFactionControl('coast', {
      settlements,
      factions,
      softPowerPaintBySettlementId: state.softPowerPaintBySettlementId,
    }) >= 5,
  )

  /** @type {Record<string, string | null>} */
  const finalControllers = {}
  for (const s of settlements) {
    finalControllers[s.id] = resolveFactionalController(s, {
      settlements,
      factions,
      softPowerPaintBySettlementId: state.softPowerPaintBySettlementId,
    })
  }
  const contiguity = largestComponentFraction(finalControllers, edges)
  assert.ok(contiguity >= 0.6, `contiguity ${contiguity}`)
  assert.ok(minJaccard >= 0.5, `jaccard stability ${minJaccard}`)
})

test('believability: flicker without clear-and-rearm does not recolor every epoch', () => {
  let state = {
    softPowerPaintStreak: {},
    softPowerJoinHoldStreak: {},
    softPowerClearStreak: {},
    softPowerPaintBySettlementId: {},
    softPowerJoinEligibleBySettlementId: {},
    membershipCooldown: [],
  }
  let paintOnCount = 0
  for (let epoch = 1; epoch <= 10; epoch += 1) {
    const dominant = epoch % 2 === 1 ? 'fa' : null
    const scores = {
      free: {
        dominantFactionId: dominant,
        sharesByFactionId: dominant ? { fa: 1 } : {},
      },
    }
    state = advanceSoftPowerStreaks({
      state,
      scores,
      epoch,
      mapGraySettlementIds: new Set(['free']),
    }).state
    if (state.softPowerPaintBySettlementId.free) paintOnCount += 1
  }
  // Alternating dominance every epoch cannot sustain paint under clear-and-rearm.
  assert.equal(paintOnCount, 0)
})

test('believability: join requires additional hold after paint arms', () => {
  assert.ok(SOFT_POWER_JOIN_HOLD_EPOCHS >= 1)
  assert.ok(
    SOFT_POWER_PAINT_STREAK_EPOCHS + SOFT_POWER_JOIN_HOLD_EPOCHS >
      SOFT_POWER_PAINT_STREAK_EPOCHS,
  )
})

test('believability sweep over paint/join/margin knobs keeps dominance contract', () => {
  for (const paint of [1, 2, 3]) {
    for (const join of [2, 3, 4]) {
      for (const margin of [1.5, 2, 2.5]) {
        let state = {
          softPowerPaintStreak: {},
          softPowerJoinHoldStreak: {},
          softPowerClearStreak: {},
          softPowerPaintBySettlementId: {},
          softPowerJoinEligibleBySettlementId: {},
          membershipCooldown: [],
        }
        const scores = { free: { dominantFactionId: 'fa' } }
        for (let epoch = 1; epoch <= paint + join + 1; epoch += 1) {
          state = advanceSoftPowerStreaks({
            state,
            scores,
            epoch,
            mapGraySettlementIds: new Set(['free']),
            paintStreakEpochs: paint,
            joinHoldEpochs: join,
          }).state
        }
        assert.equal(state.softPowerPaintBySettlementId.free, 'fa')
        assert.equal(state.softPowerJoinEligibleBySettlementId.free, 'fa')
        const expected = 0.7 >= 0.3 * margin
        assert.equal(
          isSoftPowerDominant({ share: 0.7, runnerUpShare: 0.3, marginRatio: margin }),
          expected,
        )
      }
    }
  }
})
