import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  DUNGEON_ORCHESTRATOR_PRESENTATION_KINDS,
  ORCHESTRATOR_PRESENTATION_KINDS,
} from './orchestratorPresentationKinds.js'
import {
  PRESENTATION_MOTION_REGISTRY,
  createBoardShellPresentationMotionTimeline,
  createBiddingAddPresentationMotionTimeline,
  createBiddingDrawPresentationMotionTimeline,
  createBiddingSacrificePresentationMotionTimeline,
  createDungeonContinuePresentationMotionTimeline,
  createDungeonDamagePresentationMotionTimeline,
  createDungeonNeutralizePresentationMotionTimeline,
  createDungeonOutcomePresentationMotionTimeline,
  createDungeonRevealPresentationMotionTimeline,
  createHeroChangeInterstitialPresentationMotionTimeline,
  EQUIPMENT_ACTIVATION_PULSE_CLASS,
  createPresentationMotionTimeline,
  createPresentationResizeFallbackMotionTimeline,
  presentationMotionClearKeys,
  presentationMotionIsLayoutFragile,
  purgePresentationEquipmentGhostNodes,
} from './presentationMotionRegistry.js'
import { mapEngineTransitionToAnimations } from './presentationOrchestrator.js'

function dungeonSummary({
  subphase = 'reveal',
  currentMonster = null,
  remainingMonsterCount = 0,
  discardedMonsterCount = 0,
  hp = 0,
} = {}) {
  return { subphase, currentMonster, remainingMonsterCount, discardedMonsterCount, hp }
}

/**
 * Representative engine transitions whose queued kinds union to every orchestrator kind.
 * Mirrors shapes used in `presentationOrchestrator.test.js`.
 */
const REPRESENTATIVE_ENGINE_TRANSITIONS = [
  {
    phaseBefore: 'bidding',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-2',
    dungeonRunResult: null,
    action: { type: 'DRAW' },
    actorRoleType: 'randombot',
  },
  {
    phaseBefore: 'bidding',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-2',
    dungeonRunResult: null,
    action: { type: 'ADD_TO_DUNGEON' },
    actorRoleType: 'randombot',
  },
  {
    phaseBefore: 'bidding',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-2',
    dungeonRunResult: null,
    action: { type: 'SACRIFICE', equipmentId: 'W_SHIELD' },
    actorRoleType: 'randombot',
    centerEquipmentBefore: ['W_PLATE', 'W_SHIELD'],
    centerEquipmentAfter: ['W_PLATE'],
  },
  {
    phaseBefore: 'bidding',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-a',
    turnAfterSeatId: 'seat-b',
    dungeonRunResult: null,
  },
  {
    phaseBefore: 'pick-adventurer',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    heroBefore: 'WARRIOR',
    heroAfter: 'MAGE',
  },
  {
    phaseBefore: 'dungeon',
    phaseAfter: 'pick-adventurer',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-2',
    dungeonRunResult: 'success',
    actorRoleType: 'randombot',
  },
  {
    phaseBefore: 'dungeon',
    phaseAfter: 'match-over',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: null,
    dungeonRunResult: null,
    action: { type: 'REVEAL_OR_CONTINUE' },
    dungeonBefore: dungeonSummary({
      subphase: 'reveal',
      currentMonster: 'demon',
      remainingMonsterCount: 0,
      discardedMonsterCount: 4,
      hp: 1,
    }),
    dungeonAfter: dungeonSummary({
      subphase: null,
      currentMonster: null,
      remainingMonsterCount: 0,
      discardedMonsterCount: 5,
      hp: 0,
    }),
  },
  {
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'REVEAL_OR_CONTINUE' },
    dungeonBefore: dungeonSummary({ currentMonster: null, remainingMonsterCount: 3, discardedMonsterCount: 0, hp: 8 }),
    dungeonAfter: dungeonSummary({
      subphase: 'pick-fire-axe',
      currentMonster: 'dragon',
      remainingMonsterCount: 2,
      discardedMonsterCount: 0,
      hp: 8,
    }),
  },
  {
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'USE_FIRE_AXE' },
    centerEquipmentBefore: ['B_AXE', 'W_PLATE'],
    centerEquipmentAfter: ['W_PLATE'],
    dungeonBefore: dungeonSummary({
      subphase: 'pick-fire-axe',
      currentMonster: 'orc',
      remainingMonsterCount: 2,
      discardedMonsterCount: 1,
      hp: 7,
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 2,
      discardedMonsterCount: 2,
      hp: 7,
    }),
  },
  {
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'DECLINE_FIRE_AXE' },
    dungeonBefore: dungeonSummary({
      subphase: 'pick-fire-axe',
      currentMonster: 'vampire',
      remainingMonsterCount: 2,
      discardedMonsterCount: 1,
      hp: 7,
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 2,
      discardedMonsterCount: 2,
      hp: 3,
    }),
  },
]

function emittedKindsFromTransitions(transitions) {
  const out = new Set()
  for (const transition of transitions) {
    for (const animation of mapEngineTransitionToAnimations(transition)) {
      out.add(animation.kind)
    }
  }
  return out
}

function sortedStrings(set) {
  return [...set].sort()
}

/** String literals enqueued as animation kinds in `presentationOrchestrator.js` (kind property + dungeon kind pushes). */
function presentationKindLiteralsInOrchestratorSource(src) {
  const out = new Set()
  for (const match of src.matchAll(/\bkind:\s*'([^']+)'/g)) {
    out.add(match[1])
  }
  for (const match of src.matchAll(/\bkinds\.push\(([^)]*)\)/gs)) {
    for (const quoted of match[1].matchAll(/'([^']+)'/g)) {
      out.add(quoted[1])
    }
  }
  return out
}

const ORCHESTRATOR_SOURCE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'presentationOrchestrator.js')

test('presentationOrchestrator.js kind literals match the canonical registry set', () => {
  const src = readFileSync(ORCHESTRATOR_SOURCE_PATH, 'utf8')
  const literalKinds = presentationKindLiteralsInOrchestratorSource(src)
  assert.deepEqual(sortedStrings(literalKinds), sortedStrings(new Set(ORCHESTRATOR_PRESENTATION_KINDS)))
})

test('registry keys match canonical orchestrator presentation kinds', () => {
  assert.deepEqual(Object.keys(PRESENTATION_MOTION_REGISTRY).sort(), [...ORCHESTRATOR_PRESENTATION_KINDS].sort())
})

test('representative transitions emit exactly the canonical orchestrator kinds', () => {
  const emitted = emittedKindsFromTransitions(REPRESENTATIVE_ENGINE_TRANSITIONS)
  assert.deepEqual(sortedStrings(emitted), sortedStrings(new Set(ORCHESTRATOR_PRESENTATION_KINDS)))
})

test('canonical orchestrator kinds cover each issue-required presentation family', () => {
  const kinds = new Set(ORCHESTRATOR_PRESENTATION_KINDS)
  assert.deepEqual(
    sortedStrings(new Set(ORCHESTRATOR_PRESENTATION_KINDS.filter((kind) => kind.startsWith('BIDDING_')))),
    ['BIDDING_ADD', 'BIDDING_DRAW', 'BIDDING_SACRIFICE'],
  )
  assert.deepEqual(
    sortedStrings(new Set(ORCHESTRATOR_PRESENTATION_KINDS.filter((kind) => kind.startsWith('PHASE_')))),
    ['PHASE_ENTER_DUNGEON', 'PHASE_MATCH_OVER', 'PHASE_PICK_ADVENTURER'],
  )
  assert.equal(kinds.has('HERO_CHANGE_INTERSTITIAL'), true)
  assert.equal(kinds.has('TURN_ADVANCE'), true)
  assert.deepEqual(
    sortedStrings(new Set(DUNGEON_ORCHESTRATOR_PRESENTATION_KINDS)),
    ['DUNGEON_CONTINUE', 'DUNGEON_DAMAGE', 'DUNGEON_NEUTRALIZE', 'DUNGEON_OUTCOME', 'DUNGEON_REVEAL'],
  )
})

test('every kind emitted by representative transitions has a registry entry', () => {
  const emitted = emittedKindsFromTransitions(REPRESENTATIVE_ENGINE_TRANSITIONS)
  for (const kind of emitted) {
    assert.equal(typeof PRESENTATION_MOTION_REGISTRY[kind], 'function', `missing registry factory for ${kind}`)
  }
})

test('presentationMotionClearKeys matches tween targets per kind', () => {
  assert.deepEqual(presentationMotionClearKeys('DUNGEON_REVEAL'), [
    'dungeonCardWrap',
    'dungeonCardFlipAxis',
    'dungeonPileBadge',
    'boardShell',
  ])
  assert.deepEqual(presentationMotionClearKeys('DUNGEON_DAMAGE'), ['dungeonCardWrap', 'boardShell'])
  assert.deepEqual(presentationMotionClearKeys('DUNGEON_NEUTRALIZE'), ['dungeonCardWrap', 'boardShell'])
  assert.deepEqual(presentationMotionClearKeys('DUNGEON_NEUTRALIZE', { consumedEquipmentIds: ['B_AXE'] }), [
    'dungeonCardWrap',
    'boardShell',
    'equipment_B_AXE',
  ])
  assert.deepEqual(presentationMotionClearKeys('DUNGEON_CONTINUE'), ['dungeonCardWrap', 'boardShell'])
  assert.deepEqual(presentationMotionClearKeys('DUNGEON_OUTCOME'), ['dungeonCardWrap', 'boardShell'])
  assert.deepEqual(presentationMotionClearKeys('HERO_CHANGE_INTERSTITIAL'), ['heroChangeInterstitialOverlay'])
  assert.deepEqual(presentationMotionClearKeys('BIDDING_DRAW'), ['dungeonCardWrap', 'dungeonCardFlipAxis', 'boardShell'])
  assert.deepEqual(presentationMotionClearKeys('BIDDING_ADD'), [
    'dungeonCardWrap',
    'dungeonCardFlipAxis',
    'deckBadge',
    'dungeonPileBadge',
    'boardShell',
  ])
  assert.deepEqual(presentationMotionClearKeys('BIDDING_SACRIFICE'), ['dungeonCardWrap', 'boardShell'])
  assert.deepEqual(presentationMotionClearKeys('BIDDING_SACRIFICE', { consumedEquipmentIds: ['W_SHIELD'] }), [
    'dungeonCardWrap',
    'boardShell',
    'equipment_W_SHIELD',
  ])
  const boardShellOnly = ORCHESTRATOR_PRESENTATION_KINDS.filter(
    (kind) =>
      kind !== 'DUNGEON_REVEAL' &&
      kind !== 'DUNGEON_DAMAGE' &&
      kind !== 'DUNGEON_NEUTRALIZE' &&
      kind !== 'DUNGEON_CONTINUE' &&
      kind !== 'DUNGEON_OUTCOME' &&
      kind !== 'HERO_CHANGE_INTERSTITIAL' &&
      kind !== 'BIDDING_DRAW' &&
      kind !== 'BIDDING_ADD' &&
      kind !== 'BIDDING_SACRIFICE',
  )
  for (const kind of boardShellOnly) {
    assert.deepEqual(presentationMotionClearKeys(kind), ['boardShell'])
  }
})

test('board shell factory falls back to a duration-only timeline without shell ref', async () => {
  const gsap = (await import('gsap')).default
  for (const kind of ORCHESTRATOR_PRESENTATION_KINDS) {
    const tl = createBoardShellPresentationMotionTimeline(gsap, { kind, durationMs: 120, refs: {} })
    assert.equal(typeof tl.duration, 'function')
    assert.ok(Number.isFinite(tl.duration()))
  }
})

test('every PRESENTATION_MOTION_REGISTRY factory runs with minimal context (kind, duration, empty refs)', async () => {
  const gsap = (await import('gsap')).default
  const minimalCtx = (kind) => ({
    kind,
    durationMs: 80,
    refs: {},
    payload: { consumedEquipmentIds: [], dungeonRunResult: null },
  })
  for (const kind of ORCHESTRATOR_PRESENTATION_KINDS) {
    const tl = createPresentationMotionTimeline(gsap, minimalCtx(kind))
    assert.equal(typeof tl.duration, 'function', kind)
    assert.ok(Number.isFinite(tl.duration()), kind)
  }
})

test('every PRESENTATION_MOTION_REGISTRY factory runs when optional context fields are absent', async () => {
  const gsap = (await import('gsap')).default
  for (const kind of ORCHESTRATOR_PRESENTATION_KINDS) {
    const tl = createPresentationMotionTimeline(gsap, { kind, durationMs: 80 })
    assert.equal(typeof tl.duration, 'function', kind)
    assert.ok(Number.isFinite(tl.duration()), kind)
  }
})

test('PRESENTATION_MOTION_REGISTRY maps DUNGEON_REVEAL to card-wrapper factory', () => {
  assert.strictEqual(PRESENTATION_MOTION_REGISTRY.DUNGEON_REVEAL, createDungeonRevealPresentationMotionTimeline)
})

test('PRESENTATION_MOTION_REGISTRY maps dungeon damage/neutralize/continue/outcome to card-wrapper factories', () => {
  assert.strictEqual(PRESENTATION_MOTION_REGISTRY.DUNGEON_DAMAGE, createDungeonDamagePresentationMotionTimeline)
  assert.strictEqual(PRESENTATION_MOTION_REGISTRY.DUNGEON_NEUTRALIZE, createDungeonNeutralizePresentationMotionTimeline)
  assert.strictEqual(PRESENTATION_MOTION_REGISTRY.DUNGEON_CONTINUE, createDungeonContinuePresentationMotionTimeline)
  assert.strictEqual(PRESENTATION_MOTION_REGISTRY.DUNGEON_OUTCOME, createDungeonOutcomePresentationMotionTimeline)
})

test('PRESENTATION_MOTION_REGISTRY maps bidding kinds to dedicated factories', () => {
  assert.strictEqual(PRESENTATION_MOTION_REGISTRY.BIDDING_DRAW, createBiddingDrawPresentationMotionTimeline)
  assert.strictEqual(PRESENTATION_MOTION_REGISTRY.BIDDING_ADD, createBiddingAddPresentationMotionTimeline)
  assert.strictEqual(PRESENTATION_MOTION_REGISTRY.BIDDING_SACRIFICE, createBiddingSacrificePresentationMotionTimeline)
})

test('bidding draw factory flies wrap from deck anchor and optionally flips face-up', () => {
  const card = {
    nodeType: 1,
    tagName: 'DIV',
    getBoundingClientRect: () => ({ left: 200, top: 120, width: 160, height: 100 }),
  }
  const deck = {
    nodeType: 1,
    tagName: 'SPAN',
    getBoundingClientRect: () => ({ left: 40, top: 380, width: 72, height: 36 }),
  }
  const flip = { nodeType: 1, tagName: 'DIV' }
  const fromToCalls = []
  const gsap = {
    timeline(opts) {
      return {
        opts,
        kill() {},
        fromTo(target, fromVars, toVars) {
          fromToCalls.push({ target, fromVars, toVars })
          return this
        },
        to() {
          return this
        },
      }
    },
    set() {},
  }

  createBiddingDrawPresentationMotionTimeline(gsap, {
    kind: 'BIDDING_DRAW',
    durationMs: 1000,
    payload: { shouldFlipFaceAfterArrival: true },
    refs: { dungeonCardWrap: card, deckBadge: deck, dungeonCardFlipAxis: flip },
  })

  assert.ok(fromToCalls.some((c) => c.target === card && (c.fromVars?.scale ?? 1) < 0.99))
  assert.ok(fromToCalls.some((c) => c.target === flip && c.toVars?.rotationY === 180))
})

test('dungeon reveal factory flies wrap from dungeon pile toward slot then flips', () => {
  const card = {
    nodeType: 1,
    tagName: 'DIV',
    getBoundingClientRect: () => ({ left: 200, top: 120, width: 160, height: 100 }),
  }
  const pile = {
    nodeType: 1,
    tagName: 'SPAN',
    getBoundingClientRect: () => ({ left: 400, top: 400, width: 72, height: 36 }),
  }
  const flip = { nodeType: 1, tagName: 'DIV' }
  const fromToCalls = []
  const gsap = {
    timeline(opts) {
      return {
        opts,
        kill() {},
        fromTo(target, fromVars, toVars, position) {
          fromToCalls.push({ target, fromVars, toVars, position })
          return this
        },
        to() {
          return this
        },
      }
    },
    set() {},
  }

  createDungeonRevealPresentationMotionTimeline(gsap, {
    kind: 'DUNGEON_REVEAL',
    durationMs: 1000,
    refs: { dungeonCardWrap: card, dungeonPileBadge: pile, dungeonCardFlipAxis: flip },
  })

  assert.ok(fromToCalls.some((c) => c.target === card && (c.fromVars?.scale ?? 1) < 0.99))
  assert.ok(fromToCalls.some((c) => c.target === flip && c.toVars?.rotationY === 180))
})

test('bidding add factory moves card toward dungeon pile badge', () => {
  const card = {
    nodeType: 1,
    tagName: 'DIV',
    getBoundingClientRect: () => ({ left: 100, top: 80, width: 160, height: 100 }),
  }
  const dungeon = {
    nodeType: 1,
    tagName: 'SPAN',
    getBoundingClientRect: () => ({ left: 360, top: 420, width: 72, height: 36 }),
  }
  const toCalls = []
  const gsap = {
    timeline() {
      return {
        kill() {},
        fromTo() {
          return this
        },
        to(target, vars, position) {
          toCalls.push({ target, vars, position })
          return this
        },
      }
    },
    set() {},
  }

  createBiddingAddPresentationMotionTimeline(gsap, {
    kind: 'BIDDING_ADD',
    durationMs: 800,
    payload: { shouldFlipToBackBeforeDungeon: false },
    refs: { dungeonCardWrap: card, dungeonPileBadge: dungeon },
  })

  assert.ok(toCalls.some((c) => c.target === card && c.vars?.ease === 'power2.in'))
})

test('bot bidding sacrifice factory ghost-flies consumed equipment to card and pulses card', () => {
  const card = {
    nodeType: 1,
    tagName: 'DIV',
    getBoundingClientRect: () => ({ left: 100, top: 40, width: 200, height: 220 }),
  }
  const badge = {
    nodeType: 1,
    tagName: 'DIV',
    getBoundingClientRect: () => ({ left: 0, top: 500, width: 72, height: 32 }),
    cloneNode() {
      return {
        nodeType: 1,
        setAttribute() {},
        remove() {},
      }
    },
  }
  const flightLayer = {
    nodeType: 1,
    appended: [],
    getBoundingClientRect: () => ({ left: 50, top: 50, width: 400, height: 600 }),
    appendChild(n) {
      this.appended.push(n)
    },
  }
  const sets = []
  const fromToCalls = []
  const toCalls = []
  const addCalls = []
  let onKill = null
  const gsap = {
    set(el, props) {
      sets.push({ el, props })
    },
    timeline(opts) {
      return {
        opts,
        kill() {
          onKill?.()
        },
        eventCallback(type, fn) {
          if (type === 'onKill') onKill = fn
        },
        add(fn, pos) {
          addCalls.push({ fn, pos })
        },
        duration() {
          return 0.8
        },
        fromTo(target, fromVars, toVars, position) {
          fromToCalls.push({ target, fromVars, toVars, position })
          return this
        },
        to(target, vars, position) {
          toCalls.push({ target, vars, position })
          return this
        },
      }
    },
  }

  createBiddingSacrificePresentationMotionTimeline(gsap, {
    kind: 'BIDDING_SACRIFICE',
    durationMs: 800,
    payload: { consumedEquipmentIds: ['W_SHIELD'] },
    refs: {
      dungeonCardWrap: card,
      equipment_W_SHIELD: badge,
      presentationFlightLayer: flightLayer,
    },
  })

  assert.equal(flightLayer.appended.length, 1)
  const ghost = flightLayer.appended[0]
  const ghostSet = sets.find((s) => s.el === ghost)
  assert.equal(ghostSet?.props?.position, 'absolute')
  assert.equal(ghostSet?.props?.left, -50)
  assert.equal(ghostSet?.props?.top, 450)
  assert.ok(
    toCalls.some(
      (c) =>
        c.target === ghost &&
        c.vars?.ease === 'power2.inOut' &&
        c.vars?.left === 114 &&
        c.vars?.top === 84,
    ),
  )
  assert.ok(sets.some((s) => s.el === badge && s.props.opacity === 0.38))
  assert.ok(fromToCalls.some((c) => c.target === card && c.fromVars?.filter === 'brightness(1)'))
  assert.ok(toCalls.some((c) => c.target === card && Number(c.vars?.x ?? 0) > 50))
  assert.equal(addCalls.length, 1)
})

test('bot bidding sacrifice warns and keeps card pulse when equipment ref missing', () => {
  const warnings = []
  const origWarn = console.warn
  console.warn = (...args) => {
    warnings.push(args)
  }
  try {
    const card = {
      nodeType: 1,
      tagName: 'DIV',
      getBoundingClientRect: () => ({ left: 100, top: 40, width: 200, height: 220 }),
    }
    const flightLayer = {
      nodeType: 1,
      appended: [],
      appendChild(n) {
        this.appended.push(n)
      },
    }
    const fromToCalls = []
    const gsap = {
      set() {},
      timeline(opts) {
        return {
          opts,
          kill() {},
          eventCallback() {},
          add() {},
          duration() {
            return 0.8
          },
          fromTo(target, fromVars, toVars, position) {
            fromToCalls.push({ target, fromVars, toVars, position })
            return this
          },
          to() {
            return this
          },
        }
      },
    }

    createBiddingSacrificePresentationMotionTimeline(gsap, {
      kind: 'BIDDING_SACRIFICE',
      durationMs: 800,
      payload: { consumedEquipmentIds: ['W_SHIELD'] },
      refs: {
        dungeonCardWrap: card,
        presentationFlightLayer: flightLayer,
      },
    })

    assert.equal(flightLayer.appended.length, 0)
    assert.ok(
      warnings.some((w) =>
        w.some((part) => typeof part === 'string' && part.includes('missing equipment ref')),
      ),
    )
    assert.ok(fromToCalls.some((c) => c.target === card && c.fromVars?.filter === 'brightness(1)'))
  } finally {
    console.warn = origWarn
  }
})

test('PRESENTATION_MOTION_REGISTRY maps HERO_CHANGE_INTERSTITIAL to overlay factory', () => {
  assert.strictEqual(
    PRESENTATION_MOTION_REGISTRY.HERO_CHANGE_INTERSTITIAL,
    createHeroChangeInterstitialPresentationMotionTimeline,
  )
})

test('createPresentationMotionTimeline composite drives inner timeline so card tweens run', async () => {
  const { default: gsap } = await import('gsap')
  const dungeonCardWrap = { nodeType: 1 }
  const boardShell = { nodeType: 1 }
  const tl = createPresentationMotionTimeline(gsap, {
    kind: 'BIDDING_DRAW',
    durationMs: 500,
    refs: { dungeonCardWrap, boardShell },
    payload: { shouldFlipFaceAfterArrival: false },
  })
  tl.play(0)
  await new Promise((resolve) => setTimeout(resolve, 120))
  const scaleRaw = gsap.getProperty(dungeonCardWrap, 'scale')
  const scale = Number.parseFloat(String(scaleRaw))
  assert.ok(Number.isFinite(scale) && scale > 0.01 && scale < 1.01, `expected card wrap scale tween, scale=${String(scaleRaw)}`)
})

test('createPresentationMotionTimeline tweens board shell for default motion kinds', () => {
  const boardShell = { nodeType: 1, tagName: 'SECTION' }
  const calls = []
  const gsap = {
    timeline(opts) {
      return {
        opts,
        kill() {},
        fromTo(target, fromVars, toVars) {
          calls.push({ target, fromVars, toVars })
          return this
        },
        to() {
          return this
        },
      }
    },
  }

  const boardShellKinds = ORCHESTRATOR_PRESENTATION_KINDS.filter(
    (k) =>
      k !== 'DUNGEON_REVEAL' &&
      k !== 'DUNGEON_DAMAGE' &&
      k !== 'DUNGEON_NEUTRALIZE' &&
      k !== 'DUNGEON_CONTINUE' &&
      k !== 'DUNGEON_OUTCOME' &&
      k !== 'HERO_CHANGE_INTERSTITIAL' &&
      k !== 'BIDDING_DRAW' &&
      k !== 'BIDDING_ADD' &&
      k !== 'BIDDING_SACRIFICE',
  )
  for (const kind of boardShellKinds) {
    createPresentationMotionTimeline(gsap, { kind, durationMs: 240, refs: { boardShell } })
  }

  assert.equal(calls.length, boardShellKinds.length)
  for (const call of calls) {
    assert.strictEqual(call.target, boardShell)
    assert.deepEqual(call.fromVars, { opacity: 0.92 })
    assert.deepEqual(call.toVars, { opacity: 1, duration: 0.24, ease: 'power1.out' })
  }
})

test('createPresentationMotionTimeline tweens hero overlay only for HERO_CHANGE_INTERSTITIAL (no boardShell)', () => {
  const overlay = { nodeType: 1, tagName: 'BUTTON' }
  const fromToCalls = []
  const toCalls = []
  const gsap = {
    timeline(opts) {
      return {
        opts,
        kill() {},
        add() {
          return this
        },
        fromTo(target, fromVars, toVars) {
          fromToCalls.push({ target, fromVars, toVars })
          return this
        },
        to(target, vars) {
          toCalls.push({ target, vars })
          return this
        },
      }
    },
  }

  const boardShell = { nodeType: 1, tagName: 'SECTION' }
  createPresentationMotionTimeline(gsap, {
    kind: 'HERO_CHANGE_INTERSTITIAL',
    durationMs: 1000,
    refs: { heroChangeInterstitialOverlay: overlay, boardShell },
  })

  assert.equal(fromToCalls.length, 1)
  assert.ok(fromToCalls.some((c) => c.target === overlay && c.fromVars?.autoAlpha === 0))
  assert.equal(fromToCalls.some((c) => c.target === boardShell), false)
  assert.equal(toCalls.length, 2)
  assert.strictEqual(toCalls[0].target, overlay)
  assert.ok(Number.isFinite(toCalls[0].vars.duration))
  assert.strictEqual(toCalls[1].target, overlay)
  assert.equal(toCalls[1].vars.autoAlpha, 0)
})

test('createPresentationMotionTimeline tweens dungeonCardWrap and boardShell for DUNGEON_REVEAL', () => {
  const dungeonCardWrap = { nodeType: 1, tagName: 'DIV' }
  const boardShell = { nodeType: 1, tagName: 'SECTION' }
  const calls = []
  const gsap = {
    timeline(opts) {
      return {
        opts,
        kill() {},
        add() {
          return this
        },
        fromTo(target, fromVars, toVars) {
          calls.push({ target, fromVars, toVars })
          return this
        },
        to() {
          return this
        },
      }
    },
  }

  createPresentationMotionTimeline(gsap, {
    kind: 'DUNGEON_REVEAL',
    durationMs: 300,
    refs: { dungeonCardWrap, boardShell },
  })

  assert.equal(calls.length, 2)
  const wrapCall = calls.find((c) => c.target === dungeonCardWrap)
  assert.ok(wrapCall)
  assert.ok(Number.isFinite(wrapCall.fromVars?.x))
  assert.ok(Number.isFinite(wrapCall.fromVars?.scale))
  assert.equal(wrapCall.fromVars?.opacity, 0.92)
  assert.equal(wrapCall.toVars?.opacity, 1)
  assert.equal(wrapCall.toVars?.duration, 0.3 * 0.85)
  assert.equal(wrapCall.toVars?.ease, 'power2.out')
  assert.ok(
    calls.some(
      (c) =>
        c.target === boardShell &&
        c.fromVars?.opacity === 0.92 &&
        !Object.prototype.hasOwnProperty.call(c.fromVars ?? {}, 'x'),
    ),
  )
})

test('createPresentationMotionTimeline DUNGEON_REVEAL: wrap gets y/scale only, flip axis gets rotationY', () => {
  const dungeonCardWrap = { nodeType: 1, tagName: 'DIV' }
  const dungeonCardFlipAxis = { nodeType: 1, tagName: 'DIV' }
  const boardShell = { nodeType: 1, tagName: 'SECTION' }
  const calls = []
  const gsap = {
    timeline(opts) {
      return {
        opts,
        kill() {},
        add() {
          return this
        },
        fromTo(target, fromVars, toVars) {
          calls.push({ target, fromVars, toVars })
          return this
        },
        to() {
          return this
        },
      }
    },
  }

  createPresentationMotionTimeline(gsap, {
    kind: 'DUNGEON_REVEAL',
    durationMs: 300,
    refs: { dungeonCardWrap, dungeonCardFlipAxis, boardShell },
  })

  assert.equal(calls.length, 3)
  const wrapCall = calls.find((c) => c.target === dungeonCardWrap)
  const axisCall = calls.find((c) => c.target === dungeonCardFlipAxis)
  assert.ok(wrapCall)
  assert.ok(axisCall)
  assert.equal(wrapCall.fromVars?.rotationY, undefined)
  assert.equal(wrapCall.toVars?.rotationY, undefined)
  assert.ok(wrapCall.toVars?.duration < 0.3)
  assert.equal(axisCall.fromVars?.rotationY, 0)
  assert.equal(axisCall.toVars?.rotationY, 180)
  assert.ok(
    calls.some(
      (c) =>
        c.target === boardShell &&
        c.fromVars?.opacity === 0.92 &&
        !Object.prototype.hasOwnProperty.call(c.fromVars ?? {}, 'x'),
    ),
  )
})

test('createPresentationMotionTimeline DUNGEON_REVEAL without boardShell only tweens card wrap', () => {
  const dungeonCardWrap = { nodeType: 1, tagName: 'DIV' }
  const calls = []
  const gsap = {
    timeline(opts) {
      return {
        opts,
        kill() {},
        fromTo(target, fromVars, toVars) {
          calls.push({ target, fromVars, toVars })
          return this
        },
        to() {
          return this
        },
      }
    },
  }

  createPresentationMotionTimeline(gsap, {
    kind: 'DUNGEON_REVEAL',
    durationMs: 300,
    refs: { dungeonCardWrap },
  })

  assert.equal(calls.length, 1)
  assert.strictEqual(calls[0].target, dungeonCardWrap)
})

test('boardShell placeholder tween once per kind when shell ref is set (issue #62)', () => {
  const boardShell = { nodeType: 1, tagName: 'SECTION' }
  const card = { nodeType: 1, tagName: 'DIV' }
  const deck = { nodeType: 1, tagName: 'SPAN' }
  const overlay = { nodeType: 1, tagName: 'DIV' }
  const flightLayer = { nodeType: 1, appendChild() {} }
  for (const kind of ORCHESTRATOR_PRESENTATION_KINDS) {
    let shellBeatCount = 0
    const expectShellBeats =
      kind === 'HERO_CHANGE_INTERSTITIAL' || kind === 'DUNGEON_OUTCOME' ? 0 : 1
    const gsap = {
      set() {},
      timeline() {
        return {
          kill() {},
          add() {
            return this
          },
          eventCallback() {
            return this
          },
          duration() {
            return 0.5
          },
          fromTo(target, fromVars) {
            if (
              target === boardShell &&
              fromVars?.opacity === 0.92 &&
              !Object.prototype.hasOwnProperty.call(fromVars ?? {}, 'x')
            ) {
              shellBeatCount += 1
            }
            return this
          },
          to() {
            return this
          },
        }
      },
    }
    const payload =
      kind === 'DUNGEON_OUTCOME'
        ? { dungeonRunResult: 'success' }
        : { consumedEquipmentIds: [], dungeonRunResult: null }
    createPresentationMotionTimeline(gsap, {
      kind,
      durationMs: 400,
      refs: {
        boardShell,
        dungeonCardWrap: card,
        deckBadge: deck,
        heroChangeInterstitialOverlay: overlay,
        presentationFlightLayer: flightLayer,
      },
      payload,
    })
    assert.equal(shellBeatCount, expectShellBeats, kind)
  }
})

test('createPresentationMotionTimeline adds parallel boardShell for every specialized kind when shell ref is set', () => {
  const boardShell = { nodeType: 1, tagName: 'SECTION' }
  const card = { nodeType: 1, tagName: 'DIV' }
  const deck = { nodeType: 1, tagName: 'SPAN' }
  const overlay = { nodeType: 1, tagName: 'DIV' }
  const flightLayer = { nodeType: 1, appendChild() {} }
  let shellBeatCount = 0
  const gsap = {
    timeline() {
      return {
        kill() {},
        add() {
          return this
        },
        eventCallback() {},
        duration() {
          return 0.5
        },
        set() {},
        fromTo(target, fromVars) {
          if (
            target === boardShell &&
            fromVars?.opacity === 0.92 &&
            !Object.prototype.hasOwnProperty.call(fromVars ?? {}, 'x')
          ) {
            shellBeatCount += 1
          }
          return this
        },
        to() {
          return this
        },
      }
    },
  }

  const rows = [
    ['DUNGEON_REVEAL', { boardShell, dungeonCardWrap: card }],
    ['DUNGEON_DAMAGE', { boardShell, dungeonCardWrap: card }],
    ['DUNGEON_NEUTRALIZE', { boardShell, dungeonCardWrap: card, presentationFlightLayer: flightLayer }],
    ['DUNGEON_CONTINUE', { boardShell, dungeonCardWrap: card }],
    ['BIDDING_DRAW', { boardShell, dungeonCardWrap: card }],
    ['BIDDING_ADD', { boardShell, deckBadge: deck }],
    ['BIDDING_SACRIFICE', { boardShell, dungeonCardWrap: card, presentationFlightLayer: flightLayer }],
  ]

  for (const [kind, ctx] of rows) {
    shellBeatCount = 0
    const { payload, ...refs } = ctx
    createPresentationMotionTimeline(gsap, {
      kind,
      durationMs: 400,
      refs,
      payload,
    })
    assert.equal(shellBeatCount, 1, kind)
  }

  shellBeatCount = 0
  createPresentationMotionTimeline(gsap, {
    kind: 'HERO_CHANGE_INTERSTITIAL',
    durationMs: 400,
    refs: { boardShell, heroChangeInterstitialOverlay: overlay },
  })
  assert.equal(shellBeatCount, 0)
})

test('createPresentationMotionTimeline does not parallel tween boardShell for DUNGEON_OUTCOME', () => {
  const boardShell = { nodeType: 1, tagName: 'SECTION' }
  const card = { nodeType: 1, tagName: 'DIV' }
  let shellFromTo = 0
  const gsap = {
    timeline() {
      return {
        kill() {},
        add() {
          return this
        },
        eventCallback() {},
        duration() {
          return 0.5
        },
        set() {},
        fromTo(target, fromVars) {
          if (
            target === boardShell &&
            fromVars?.opacity === 0.92 &&
            !Object.prototype.hasOwnProperty.call(fromVars ?? {}, 'x')
          ) {
            shellFromTo += 1
          }
          return this
        },
        to() {
          return this
        },
      }
    },
  }

  createPresentationMotionTimeline(gsap, {
    kind: 'DUNGEON_OUTCOME',
    durationMs: 400,
    refs: {
      boardShell,
      dungeonCardWrap: card,
      presentationFlightLayer: { nodeType: 1, appendChild() {} },
    },
    payload: { dungeonRunResult: 'success' },
  })
  assert.equal(shellFromTo, 0)
})

test('createDungeonRevealPresentationMotionTimeline tweens flip axis rotationY with card wrap', () => {
  const wrap = { nodeType: 1, tagName: 'DIV' }
  const axis = { nodeType: 1, tagName: 'DIV' }
  const fromToCalls = []
  const gsap = {
    timeline(opts) {
      return {
        opts,
        kill() {},
        fromTo(target, fromVars, toVars, position) {
          fromToCalls.push({ target, fromVars, toVars, position })
          return this
        },
        to() {
          return this
        },
      }
    },
  }

  createDungeonRevealPresentationMotionTimeline(gsap, {
    kind: 'DUNGEON_REVEAL',
    durationMs: 400,
    refs: { dungeonCardWrap: wrap, dungeonCardFlipAxis: axis },
  })

  assert.equal(fromToCalls.length, 2)
  const flipCall = fromToCalls.find((c) => c.target === axis)
  assert.ok(flipCall)
  assert.equal(flipCall.fromVars.rotationY, 0)
  assert.equal(flipCall.toVars.rotationY, 180)
  assert.equal(flipCall.position, 0.4 * 0.62)
})

test('DUNGEON_REVEAL factory falls back to a duration-only timeline without card-wrap ref', () => {
  const toCalls = []
  const fromToCalls = []
  const gsap = {
    timeline(opts) {
      return {
        opts,
        kill() {},
        fromTo(target, fromVars, toVars) {
          fromToCalls.push({ target, fromVars, toVars })
          return this
        },
        to(target, vars) {
          toCalls.push({ target, vars })
          return this
        },
      }
    },
  }

  createDungeonRevealPresentationMotionTimeline(gsap, {
    kind: 'DUNGEON_REVEAL',
    durationMs: 300,
    refs: {},
  })

  assert.equal(fromToCalls.length, 0)
  assert.equal(toCalls.length, 1)
  assert.equal(toCalls[0].vars.duration, 0.3)
})

test('createPresentationMotionTimeline tweens dungeonCardWrap for DUNGEON_DAMAGE (shake + saturate)', () => {
  const dungeonCardWrap = { nodeType: 1, tagName: 'DIV' }
  const fromToCalls = []
  const toCalls = []
  const gsap = {
    timeline(opts) {
      return {
        opts,
        kill() {},
        fromTo(target, fromVars, toVars, position) {
          fromToCalls.push({ target, fromVars, toVars, position })
          return this
        },
        to(target, vars, position) {
          toCalls.push({ target, vars, position })
          return this
        },
      }
    },
  }

  createPresentationMotionTimeline(gsap, {
    kind: 'DUNGEON_DAMAGE',
    durationMs: 240,
    refs: { dungeonCardWrap },
  })

  assert.ok(
    fromToCalls.some(
      (c) =>
        c.target === dungeonCardWrap &&
        c.fromVars?.x === 0 &&
        c.toVars?.x === -7 &&
        String(c.fromVars?.filter ?? '').includes('saturate'),
    ),
  )
  const cardTo = toCalls.filter((c) => c.target === dungeonCardWrap)
  assert.ok(cardTo.some((c) => c.vars?.x === 6))
  assert.ok(cardTo.some((c) => c.vars?.x === -4))
  assert.ok(cardTo.some((c) => c.vars?.x === 0 && String(c.vars?.filter ?? '').includes('saturate(1)')))
  assert.ok(cardTo.some((c) => Number.isFinite(c.vars?.x) && c.vars?.x >= 320 && c.vars?.opacity === 0))
})

test('createPresentationMotionTimeline tweens dungeonCardWrap for DUNGEON_NEUTRALIZE (strike + brightness)', () => {
  const dungeonCardWrap = { nodeType: 1, tagName: 'DIV' }
  const fromToCalls = []
  const toCalls = []
  const gsap = {
    timeline(opts) {
      return {
        opts,
        kill() {},
        eventCallback() {},
        add() {
          return this
        },
        fromTo(target, fromVars, toVars, position) {
          fromToCalls.push({ target, fromVars, toVars, position })
          return this
        },
        to(target, vars, position) {
          toCalls.push({ target, vars, position })
          return this
        },
      }
    },
  }

  createPresentationMotionTimeline(gsap, {
    kind: 'DUNGEON_NEUTRALIZE',
    durationMs: 400,
    refs: { dungeonCardWrap },
  })

  assert.ok(fromToCalls.some((c) => c.target === dungeonCardWrap && c.fromVars?.x === 0 && c.toVars?.x === 6))
  assert.ok(fromToCalls.some((c) => c.target === dungeonCardWrap && c.fromVars?.filter === 'brightness(1)'))
  assert.ok(toCalls.some((c) => c.target === dungeonCardWrap && c.vars?.x === 0))
  assert.ok(toCalls.some((c) => c.target === dungeonCardWrap && typeof c.vars?.x === 'number' && c.vars.x > 180))
})

test('dungeon neutralize factory ghost-flies consumed equipment toward card with strike', () => {
  const card = {
    nodeType: 1,
    tagName: 'DIV',
    getBoundingClientRect: () => ({ left: 50, top: 30, width: 180, height: 240 }),
  }
  const badge = {
    nodeType: 1,
    tagName: 'DIV',
    getBoundingClientRect: () => ({ left: 5, top: 300, width: 64, height: 30 }),
    cloneNode() {
      return { nodeType: 1, setAttribute() {}, remove() {} }
    },
  }
  const flightLayer = {
    nodeType: 1,
    appended: [],
    getBoundingClientRect: () => ({ left: 40, top: 20, width: 400, height: 600 }),
    appendChild(n) {
      this.appended.push(n)
    },
  }
  const sets = []
  const fromToCalls = []
  const toCalls = []
  const gsap = {
    set(el, props) {
      sets.push({ el, props })
    },
    timeline(opts) {
      return {
        opts,
        kill() {},
        eventCallback() {},
        add() {
          return this
        },
        duration() {
          return 0.92
        },
        fromTo(target, fromVars, toVars, position) {
          fromToCalls.push({ target, fromVars, toVars, position })
          return this
        },
        to(target, vars, position) {
          toCalls.push({ target, vars, position })
          return this
        },
      }
    },
  }

  createDungeonNeutralizePresentationMotionTimeline(gsap, {
    kind: 'DUNGEON_NEUTRALIZE',
    durationMs: 920,
    payload: { consumedEquipmentIds: ['B_AXE'] },
    refs: {
      dungeonCardWrap: card,
      equipment_B_AXE: badge,
      presentationFlightLayer: flightLayer,
    },
  })

  assert.equal(flightLayer.appended.length, 1)
  const ghost = flightLayer.appended[0]
  assert.equal(sets.find((s) => s.el === ghost)?.props?.position, 'absolute')
  assert.ok(toCalls.some((c) => c.target === ghost))
  assert.ok(sets.some((s) => s.el === badge && s.props.opacity === 0.38))
  assert.ok(fromToCalls.some((c) => c.target === card && c.fromVars?.x === 0))
})

test('dungeon neutralize warns and keeps card strike when equipment ref missing', () => {
  const warnings = []
  const origWarn = console.warn
  console.warn = (...args) => {
    warnings.push(args)
  }
  try {
    const card = {
      nodeType: 1,
      tagName: 'DIV',
      getBoundingClientRect: () => ({ left: 50, top: 30, width: 180, height: 240 }),
    }
    const flightLayer = {
      nodeType: 1,
      appended: [],
      appendChild(n) {
        this.appended.push(n)
      },
    }
    const fromToCalls = []
    const gsap = {
      set() {},
      timeline(opts) {
        return {
          opts,
          kill() {},
          eventCallback() {},
          add() {
            return this
          },
          duration() {
            return 0.4
          },
          fromTo(target, fromVars, toVars, position) {
            fromToCalls.push({ target, fromVars, toVars, position })
            return this
          },
          to() {
            return this
          },
        }
      },
    }

    createDungeonNeutralizePresentationMotionTimeline(gsap, {
      kind: 'DUNGEON_NEUTRALIZE',
      durationMs: 400,
      payload: { consumedEquipmentIds: ['B_AXE'] },
      refs: {
        dungeonCardWrap: card,
        presentationFlightLayer: flightLayer,
      },
    })

    assert.equal(flightLayer.appended.length, 0)
    assert.ok(
      warnings.some((w) =>
        w.some((part) => typeof part === 'string' && part.includes('missing equipment ref')),
      ),
    )
    assert.ok(fromToCalls.some((c) => c.target === card && c.fromVars?.x === 0))
  } finally {
    console.warn = origWarn
  }
})

test('createPresentationMotionTimeline tweens dungeonCardWrap for DUNGEON_CONTINUE (brightness)', () => {
  const dungeonCardWrap = { nodeType: 1, tagName: 'DIV' }
  const calls = []
  const gsap = {
    timeline(opts) {
      return {
        opts,
        kill() {},
        fromTo(target, fromVars, toVars) {
          calls.push({ target, fromVars, toVars })
          return this
        },
        to() {
          return this
        },
      }
    },
  }

  createPresentationMotionTimeline(gsap, {
    kind: 'DUNGEON_CONTINUE',
    durationMs: 280,
    refs: { dungeonCardWrap },
  })

  assert.equal(calls.length, 1)
  assert.strictEqual(calls[0].target, dungeonCardWrap)
  assert.deepEqual(calls[0].fromVars, { filter: 'brightness(1)' })
  assert.deepEqual(calls[0].toVars.filter, 'brightness(0.88)')
})

test('createPresentationMotionTimeline tweens dungeonCardWrap for DUNGEON_OUTCOME (vertical lift; success uses glow)', () => {
  const dungeonCardWrap = { nodeType: 1, tagName: 'DIV' }
  const fromToCalls = []
  const toCalls = []
  const gsap = {
    timeline(opts) {
      return {
        opts,
        kill() {},
        fromTo(target, fromVars, toVars, position) {
          fromToCalls.push({ target, fromVars, toVars, position })
          return this
        },
        to(target, vars, position) {
          toCalls.push({ target, vars, position })
          return this
        },
      }
    },
  }

  createPresentationMotionTimeline(gsap, {
    kind: 'DUNGEON_OUTCOME',
    durationMs: 1000,
    payload: { dungeonRunResult: 'success' },
    refs: { dungeonCardWrap },
  })

  assert.ok(
    fromToCalls.some(
      (c) =>
        c.target === dungeonCardWrap &&
        c.fromVars?.x === 0 &&
        (c.toVars?.y ?? 0) < 0 &&
        (c.toVars?.rotationZ ?? 0) < 0 &&
        String(c.toVars?.boxShadow ?? '').includes('76, 175, 80'),
    ),
  )
  assert.ok(
    toCalls.some(
      (c) =>
        c.target === dungeonCardWrap &&
        c.vars?.y === 0 &&
        c.vars?.x === 0 &&
        (c.vars?.rotationZ ?? 0) === 0,
    ),
  )
})

test('createPresentationMotionTimeline DUNGEON_OUTCOME failure uses sag + desaturation (no horizontal strike)', () => {
  const dungeonCardWrap = { nodeType: 1, tagName: 'DIV' }
  const fromToCalls = []
  const gsap = {
    timeline(opts) {
      return {
        opts,
        kill() {},
        fromTo(target, fromVars, toVars) {
          fromToCalls.push({ target, fromVars, toVars })
          return this
        },
        to() {
          return this
        },
      }
    },
  }

  createPresentationMotionTimeline(gsap, {
    kind: 'DUNGEON_OUTCOME',
    durationMs: 800,
    payload: { dungeonRunResult: 'failure' },
    refs: { dungeonCardWrap },
  })

  const peak = fromToCalls.find((c) => c.target === dungeonCardWrap)
  assert.ok(peak)
  assert.equal(peak.fromVars?.x, 0)
  assert.ok((peak.toVars?.y ?? 0) > 0)
  assert.ok((peak.toVars?.rotationZ ?? 0) > 0)
  assert.ok(String(peak.toVars?.filter ?? '').includes('saturate'))
})

test('presentationMotionIsLayoutFragile matches ghost-flight payload shapes', () => {
  assert.equal(presentationMotionIsLayoutFragile('DUNGEON_REVEAL', {}), true)
  assert.equal(presentationMotionIsLayoutFragile('DUNGEON_NEUTRALIZE', {}), false)
  assert.equal(
    presentationMotionIsLayoutFragile('DUNGEON_NEUTRALIZE', { consumedEquipmentIds: ['W_SHIELD'] }),
    true,
  )
  assert.equal(
    presentationMotionIsLayoutFragile('DUNGEON_NEUTRALIZE', { responsibleEquipmentIds: ['W_TORCH'] }),
    true,
  )
  assert.equal(presentationMotionIsLayoutFragile('BIDDING_DRAW', {}), true)
  assert.equal(presentationMotionIsLayoutFragile('BIDDING_ADD', {}), true)
  assert.equal(presentationMotionIsLayoutFragile('BIDDING_SACRIFICE', {}), false)
  assert.equal(
    presentationMotionIsLayoutFragile('BIDDING_SACRIFICE', { consumedEquipmentIds: ['W_PLATE'] }),
    true,
  )
  assert.equal(
    presentationMotionIsLayoutFragile('BIDDING_SACRIFICE', { responsibleEquipmentIds: ['W_PLATE'] }),
    true,
  )
  assert.equal(presentationMotionIsLayoutFragile('TURN_ADVANCE', {}), false)
})

test('presentationMotionClearKeys reads responsibleEquipmentIds for ghost-flight kinds', () => {
  assert.deepEqual(
    presentationMotionClearKeys('DUNGEON_NEUTRALIZE', { responsibleEquipmentIds: ['W_TORCH'] }),
    ['dungeonCardWrap', 'boardShell', 'equipment_W_TORCH'],
  )
  assert.deepEqual(
    presentationMotionClearKeys('BIDDING_SACRIFICE', { responsibleEquipmentIds: ['W_VORPAL'] }),
    ['dungeonCardWrap', 'boardShell', 'equipment_W_VORPAL'],
  )
})

test('dungeon neutralize factory pulses (not dims) reusable equipment when not in expended set', () => {
  const card = {
    nodeType: 1,
    tagName: 'DIV',
    getBoundingClientRect: () => ({ left: 50, top: 30, width: 180, height: 240 }),
  }
  const activationPulseClasses = []
  const badge = {
    nodeType: 1,
    tagName: 'DIV',
    getBoundingClientRect: () => ({ left: 5, top: 300, width: 64, height: 30 }),
    classList: {
      add(cls) {
        activationPulseClasses.push(cls)
      },
      remove() {},
    },
    cloneNode() {
      return { nodeType: 1, setAttribute() {}, remove() {} }
    },
  }
  const flightLayer = {
    nodeType: 1,
    appended: [],
    appendChild(n) {
      this.appended.push(n)
    },
  }
  const sets = []
  const fromToCalls = []
  const toCalls = []
  const gsap = {
    set(el, props) {
      sets.push({ el, props })
    },
    timeline(opts) {
      return {
        opts,
        kill() {},
        eventCallback() {},
        add() {
          return this
        },
        duration() {
          return 0.92
        },
        fromTo(target, fromVars, toVars, position) {
          fromToCalls.push({ target, fromVars, toVars, position })
          return this
        },
        to(target, vars, position) {
          toCalls.push({ target, vars, position })
          return this
        },
      }
    },
  }

  createDungeonNeutralizePresentationMotionTimeline(gsap, {
    kind: 'DUNGEON_NEUTRALIZE',
    durationMs: 920,
    payload: {
      responsibleEquipmentIds: ['W_TORCH'],
      expendedEquipmentIds: [],
    },
    refs: {
      dungeonCardWrap: card,
      equipment_W_TORCH: badge,
      presentationFlightLayer: flightLayer,
    },
  })

  assert.equal(flightLayer.appended.length, 1)
  assert.equal(sets.some((s) => s.el === badge && s.props.opacity === 0.38), false)
  assert.deepEqual(activationPulseClasses, [EQUIPMENT_ACTIVATION_PULSE_CLASS])
  assert.ok(
    fromToCalls.some(
      (c) =>
        c.target === badge &&
        c.toVars?.['--dr-equip-activation-glow-opacity'] === 1 &&
        c.fromVars?.['--dr-equip-activation-glow-opacity'] === 0,
    ),
  )
})

test('dungeon neutralize factory dims expended equipment but not reusable equipment in same flight', () => {
  const card = {
    nodeType: 1,
    tagName: 'DIV',
    getBoundingClientRect: () => ({ left: 50, top: 30, width: 180, height: 240 }),
  }
  const makeBadge = () => ({
    nodeType: 1,
    tagName: 'DIV',
    getBoundingClientRect: () => ({ left: 5, top: 300, width: 64, height: 30 }),
    cloneNode() {
      return { nodeType: 1, setAttribute() {}, remove() {} }
    },
  })
  const torch = makeBadge()
  const vorpal = makeBadge()
  const flightLayer = {
    nodeType: 1,
    appended: [],
    appendChild(n) {
      this.appended.push(n)
    },
  }
  const sets = []
  const gsap = {
    set(el, props) {
      sets.push({ el, props })
    },
    timeline() {
      return {
        kill() {},
        eventCallback() {},
        add() {
          return this
        },
        duration() {
          return 0.92
        },
        fromTo() {
          return this
        },
        to() {
          return this
        },
      }
    },
  }

  createDungeonNeutralizePresentationMotionTimeline(gsap, {
    kind: 'DUNGEON_NEUTRALIZE',
    durationMs: 920,
    payload: {
      responsibleEquipmentIds: ['W_TORCH', 'W_VORPAL'],
      expendedEquipmentIds: ['W_VORPAL'],
    },
    refs: {
      dungeonCardWrap: card,
      equipment_W_TORCH: torch,
      equipment_W_VORPAL: vorpal,
      presentationFlightLayer: flightLayer,
    },
  })

  assert.equal(sets.some((s) => s.el === torch && s.props.opacity === 0.38), false)
  assert.ok(sets.some((s) => s.el === vorpal && s.props.opacity === 0.38))
})

test('dungeon neutralize factory skips card slide-off when isFinalDungeonMonsterDefeat is true', () => {
  const card = {
    nodeType: 1,
    tagName: 'DIV',
    getBoundingClientRect: () => ({ left: 50, top: 30, width: 180, height: 240 }),
  }
  const toCalls = []
  const gsap = {
    set() {},
    timeline() {
      return {
        kill() {},
        eventCallback() {},
        add() {
          return this
        },
        duration() {
          return 0.92
        },
        fromTo() {
          return this
        },
        to(target, vars, position) {
          toCalls.push({ target, vars, position })
          return this
        },
      }
    },
  }

  createDungeonNeutralizePresentationMotionTimeline(gsap, {
    kind: 'DUNGEON_NEUTRALIZE',
    durationMs: 920,
    payload: {
      responsibleEquipmentIds: [],
      expendedEquipmentIds: [],
      isFinalDungeonMonsterDefeat: true,
    },
    refs: { dungeonCardWrap: card },
  })

  assert.equal(toCalls.some((c) => c.target === card && Number(c.vars?.x ?? 0) > 50), false)
})

test('purgePresentationEquipmentGhostNodes removes all marked nodes under body', () => {
  const removed = []
  const n1 = { remove() { removed.push(1) } }
  const n2 = { remove() { removed.push(2) } }
  const prev = globalThis.document
  globalThis.document = {
    body: {
      querySelectorAll() {
        return [n1, n2]
      },
    },
  }
  try {
    purgePresentationEquipmentGhostNodes()
    assert.deepEqual(removed, [1, 2])
  } finally {
    globalThis.document = prev
  }
})

test('createPresentationResizeFallbackMotionTimeline runs shell and card tweens together', () => {
  const fromToCalls = []
  const boardShell = { nodeType: 1, tagName: 'SECTION' }
  const dungeonCardWrap = { nodeType: 1, tagName: 'DIV' }
  const gsap = {
    timeline() {
      return {
        fromTo(target, fromVars, toVars, position) {
          fromToCalls.push({ target, fromVars, toVars, position })
          return this
        },
        to() {
          return this
        },
        kill() {},
      }
    },
  }

  createPresentationResizeFallbackMotionTimeline(gsap, {
    kind: 'DUNGEON_REVEAL',
    durationMs: 400,
    refs: { boardShell, dungeonCardWrap },
  })

  assert.equal(fromToCalls.length, 2)
  assert.ok(fromToCalls.some((c) => c.target === boardShell))
  assert.ok(fromToCalls.some((c) => c.target === dungeonCardWrap))
  assert.ok(fromToCalls.every((c) => c.position === 0))
})
