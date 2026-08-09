/**
 * Banner-tenure unit + believability tuning sweep (rolling window).
 * Domain: world-builder/CONTEXT.md — Banner tenure.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceBannerTenure,
  applyBannerTenurePushWeight,
  computeBannerTenureResistance,
  rebellionArmThresholdScale,
  resolveBannerTenurePreference,
} from './bannerTenure.js'
import {
  DEFAULT_BANNER_TENURE_TUNING,
  getBannerTenureTuning,
  resetBannerTenureTuning,
  setBannerTenureTuning,
} from './bannerTenureTuning.js'
import { isPoliticalPressureDominant } from '../politicalPressure/scorePoliticalPressure.js'
import {
  DEFAULT_POLITICAL_PRESSURE_TUNING,
  resetPoliticalPressureTuning,
} from '../politicalPressure/politicalPressureTuning.js'
import {
  REBELLION_TAX_DRAIN_CP_THRESHOLD,
  REBELLION_TRADE_PRESSURE_EPOCHS,
} from '../conflict/conflictConstants.js'

test.afterEach(() => {
  resetBannerTenureTuning()
  resetPoliticalPressureTuning()
})

/** @param {string} id @param {number} n */
function fill(id, n) {
  return Array.from({ length: n }, () => id)
}

/**
 * @param {{
 *   push: number,
 *   subjectStrength: number,
 *   history: string[],
 *   currentFactionId: string | null,
 *   pressuringFactionId: string,
 *   t: import('./bannerTenureTuning.js').BannerTenureTuning,
 * }} p
 */
function pressureDominates(p) {
  setBannerTenureTuning(p.t)
  const weighted = applyBannerTenurePushWeight({
    push: p.push,
    history: p.history,
    pressuringFactionId: p.pressuringFactionId,
  })
  const resist = computeBannerTenureResistance({
    subjectStrength: p.subjectStrength,
    history: p.history,
    currentFactionId: p.currentFactionId,
  })
  const denom = weighted + p.subjectStrength + resist
  const share = denom > 0 ? weighted / denom : 0
  return isPoliticalPressureDominant({
    share,
    runnerUpShare: 0,
    majority: DEFAULT_POLITICAL_PRESSURE_TUNING.majority,
    marginRatio: DEFAULT_POLITICAL_PRESSURE_TUNING.marginRatio,
  })
}

/**
 * @param {{
 *   history: string[],
 *   currentFactionId: string,
 *   taxDrain: number,
 *   tradeStreak: number,
 *   t: import('./bannerTenureTuning.js').BannerTenureTuning,
 * }} p
 */
function rebellionArms(p) {
  setBannerTenureTuning(p.t)
  const scale = rebellionArmThresholdScale({
    history: p.history,
    currentFactionId: p.currentFactionId,
  })
  const taxOk = p.taxDrain >= REBELLION_TAX_DRAIN_CP_THRESHOLD * scale
  const tradeOk = p.tradeStreak >= Math.ceil(REBELLION_TRADE_PRESSURE_EPOCHS * scale)
  return taxOk || tradeOk
}

/**
 * @param {import('./bannerTenureTuning.js').BannerTenureTuning} t
 */
function evaluateTuning(t) {
  const S = 100
  const empty = /** @type {string[]} */ ([])
  const heartland = fill('purple', t.windowSize)
  const early = fill('purple', 2)
  const mid = fill('purple', 5)
  // 9 purple + 1 orange: still prefers purple after a fresh takeover
  const freshConquest = [...fill('purple', t.windowSize - 1), 'orange']
  // 4 purple + 6 orange: orange has majority → assimilated
  const assimilated = [...fill('purple', 4), ...fill('orange', 6)]

  const checks = {
    emptyFlipsModest: pressureDominates({
      push: 1.25 * S,
      subjectStrength: S,
      history: empty,
      currentFactionId: 'purple',
      pressuringFactionId: 'orange',
      t,
    }),
    earlyStillFlippable: pressureDominates({
      push: 1.6 * S,
      subjectStrength: S,
      history: early,
      currentFactionId: 'purple',
      pressuringFactionId: 'orange',
      t,
    }),
    heartlandResistsMild: !pressureDominates({
      push: 1.25 * S,
      subjectStrength: S,
      history: heartland,
      currentFactionId: 'purple',
      pressuringFactionId: 'orange',
      t,
    }),
    heartlandFallsToCrush: pressureDominates({
      push: 3.5 * S,
      subjectStrength: S,
      history: heartland,
      currentFactionId: 'purple',
      pressuringFactionId: 'orange',
      t,
    }),
    midPartialResist: !pressureDominates({
      push: 1.4 * S,
      subjectStrength: S,
      history: mid,
      currentFactionId: 'purple',
      pressuringFactionId: 'orange',
      t,
    }),
    // After takeover: preferred still purple → homecoming for purple succeeds on moderate push
    reconquistaHomecoming: pressureDominates({
      push: 1.35 * S,
      subjectStrength: S,
      history: freshConquest,
      currentFactionId: 'orange',
      pressuringFactionId: 'purple',
      t,
    }),
    // Same seat resists a third banner more than going home
    freshConquestResistsThird: !pressureDominates({
      push: 1.35 * S,
      subjectStrength: S,
      history: freshConquest,
      currentFactionId: 'orange',
      pressuringFactionId: 'green',
      t,
    }),
    // Once orange dominates the window, purple homecoming no longer wins on modest push
    assimilatedStays: !pressureDominates({
      push: 1.35 * S,
      subjectStrength: S,
      history: assimilated,
      currentFactionId: 'orange',
      pressuringFactionId: 'purple',
      t,
    }),
    heartlandTaxBlocked: !rebellionArms({
      history: heartland,
      currentFactionId: 'purple',
      taxDrain: REBELLION_TAX_DRAIN_CP_THRESHOLD,
      tradeStreak: 0,
      t,
    }),
    heartlandHighTaxArms: rebellionArms({
      history: heartland,
      currentFactionId: 'purple',
      taxDrain: REBELLION_TAX_DRAIN_CP_THRESHOLD * (1 + t.rebellionArmMult) * 1.01,
      tradeStreak: 0,
      t,
    }),
    // Fresh orange occupation: easier to arm rebellion vs usurper at bare tax threshold
    reconquistaTaxEasier: rebellionArms({
      history: freshConquest,
      currentFactionId: 'orange',
      taxDrain: REBELLION_TAX_DRAIN_CP_THRESHOLD,
      tradeStreak: 0,
      t,
    }),
    newMemberTaxArms: rebellionArms({
      history: empty,
      currentFactionId: 'purple',
      taxDrain: REBELLION_TAX_DRAIN_CP_THRESHOLD,
      tradeStreak: 0,
      t,
    }),
    newMemberTradeArms: rebellionArms({
      history: empty,
      currentFactionId: 'purple',
      taxDrain: 0,
      tradeStreak: REBELLION_TRADE_PRESSURE_EPOCHS,
      t,
    }),
    heartlandBareTradeBlocked: !rebellionArms({
      history: heartland,
      currentFactionId: 'purple',
      taxDrain: 0,
      tradeStreak: REBELLION_TRADE_PRESSURE_EPOCHS,
      t,
    }),
  }

  const soft = {
    windowLocked: t.windowSize === 10,
    strongCapNearParity: t.maxStrengthMult >= 0.75 && t.maxStrengthMult <= 1.25,
    armNearDouble: t.rebellionArmMult >= 0.75 && t.rebellionArmMult <= 1.25,
    reconquistaMeaningful: t.reconquistaEase >= 0.35 && t.minArmScale <= 0.6,
    homecomingPresent: t.homecomingMult >= 0.5,
  }

  const prefFresh = resolveBannerTenurePreference(freshConquest, { windowSize: t.windowSize })
  const prefAssim = resolveBannerTenurePreference(assimilated, { windowSize: t.windowSize })
  const softMemory = {
    freshPrefersOld: prefFresh.preferredFactionId === 'purple',
    assimPrefersNew: prefAssim.preferredFactionId === 'orange',
  }

  const hardPass = Object.values(checks).every(Boolean)
  const softScore =
    Object.values(soft).filter(Boolean).length + Object.values(softMemory).filter(Boolean).length
  const targetFit =
    2 -
    Math.abs(t.maxStrengthMult - 1) * 0.4 -
    Math.abs(t.homecomingMult - 0.75) * 0.35 -
    Math.abs(t.foreignDampenMult - 0.5) * 0.35 -
    Math.abs(t.rebellionArmMult - 1) * 0.3 -
    Math.abs(t.reconquistaEase - 0.5) * 0.25 -
    Math.abs(t.minArmScale - 0.5) * 0.25
  return { hardPass, softScore, targetFit, checks, soft, softMemory }
}

test('resolveBannerTenurePreference uses plurality with recency tiebreak', () => {
  const tied = [...fill('purple', 5), ...fill('orange', 5)]
  const pref = resolveBannerTenurePreference(tied, { windowSize: 10 })
  assert.equal(pref.preferredFactionId, 'orange')
  assert.equal(pref.preferredCount, 5)
  assert.ok(Math.abs(pref.affinity - 0.5) < 1e-9)

  const purpleLead = [...fill('purple', 6), ...fill('orange', 4)]
  assert.equal(
    resolveBannerTenurePreference(purpleLead, { windowSize: 10 }).preferredFactionId,
    'purple',
  )
})

test('advanceBannerTenure appends and does not wipe history on banner change', () => {
  let state = advanceBannerTenure({
    settlements: [{ id: 'a', status: 'living', factionId: 'purple' }],
  })
  assert.deepEqual(state.bannerMembershipHistoryBySettlementId.a, ['purple'])

  for (let i = 0; i < 4; i += 1) {
    state = advanceBannerTenure({
      settlements: [{ id: 'a', status: 'living', factionId: 'purple' }],
      ...state,
    })
  }
  assert.equal(state.bannerMembershipHistoryBySettlementId.a.length, 5)
  assert.ok(state.bannerMembershipHistoryBySettlementId.a.every((id) => id === 'purple'))

  state = advanceBannerTenure({
    settlements: [{ id: 'a', status: 'living', factionId: 'orange' }],
    ...state,
  })
  assert.deepEqual(state.bannerMembershipHistoryBySettlementId.a, [
    'purple',
    'purple',
    'purple',
    'purple',
    'purple',
    'orange',
  ])
  assert.equal(
    resolveBannerTenurePreference(state.bannerMembershipHistoryBySettlementId.a).preferredFactionId,
    'purple',
  )
})

test('default tuning passes believability contract', () => {
  const result = evaluateTuning(DEFAULT_BANNER_TENURE_TUNING)
  assert.equal(result.hardPass, true, JSON.stringify(result.checks))
})

test('believability sweep: lock rolling-window defaults', () => {
  const maxStrengthMults = [0.75, 1, 1.25]
  const homecomingMults = [0.5, 0.75, 1]
  const foreignDampenMults = [0.5, 0.75, 1]
  const rebellionArmMults = [0.75, 1, 1.25]
  const reconquistaEases = [0.35, 0.5, 0.65]
  const minArmScales = [0.4, 0.5, 0.6]

  /** @type {Array<{ t: typeof DEFAULT_BANNER_TENURE_TUNING, score: number }>} */
  const winners = []
  for (const maxStrengthMult of maxStrengthMults) {
    for (const homecomingMult of homecomingMults) {
      for (const foreignDampenMult of foreignDampenMults) {
        for (const rebellionArmMult of rebellionArmMults) {
          for (const reconquistaEase of reconquistaEases) {
            for (const minArmScale of minArmScales) {
              const t = {
                windowSize: 10,
                maxStrengthMult,
                homecomingMult,
                foreignDampenMult,
                rebellionArmMult,
                reconquistaEase,
                minArmScale,
              }
              const ev = evaluateTuning(t)
              if (!ev.hardPass) continue
              winners.push({ t, score: ev.softScore * 10 + ev.targetFit })
            }
          }
        }
      }
    }
  }

  assert.ok(winners.length > 0, 'at least one tuning must pass hard checks')
  winners.sort((a, b) => b.score - a.score)

  const best = winners[0].t
  assert.deepEqual(
    { ...DEFAULT_BANNER_TENURE_TUNING },
    best,
    `defaults should match best sweep winner ${JSON.stringify(best)}; top=${JSON.stringify(winners.slice(0, 3))}`,
  )

  setBannerTenureTuning(best)
  assert.equal(getBannerTenureTuning().windowSize, 10)
})
