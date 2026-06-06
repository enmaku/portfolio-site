import assert from 'node:assert/strict'
import test from 'node:test'

import { effectScope, nextTick, ref, triggerRef } from 'vue'

import { resetPresentationMotionTargets } from './usePresentationMotion.js'
import { usePresentationMotion } from './usePresentationMotion.js'

function flushMicrotasks() {
  return Promise.resolve().then(() => Promise.resolve())
}

function createMockGsap() {
  const timelines = []
  const sets = []
  const gsap = {
    registerPlugin() {},
    sets,
    set(el, props) {
      sets.push({ el, props })
    },
    timeline(opts) {
      const tl = {
        opts,
        killed: false,
        _timeSec: 0,
        playCalls: [],
        time() {
          return this._timeSec
        },
        duration() {
          return 0
        },
        kill() {
          this.killed = true
          if (typeof this._onKill === 'function') {
            try {
              this._onKill()
            } catch {
              /* ignore */
            }
          }
        },
        play(at) {
          this.playCalls.push(at)
        },
        eventCallback(type, fn) {
          if (type === 'onKill' && typeof fn === 'function') this._onKill = fn
        },
        add() {
          return this
        },
        fromTo(_a, _from, toVars) {
          if (toVars && typeof toVars.duration === 'number') {
            this._lastFromToDurationSec = toVars.duration
          }
          return this
        },
        to() {
          return this
        },
      }
      timelines.push(tl)
      return tl
    },
    _timelines: timelines,
  }
  return gsap
}

test('resetPresentationMotionTargets clears props on element refs', () => {
  const gsap = createMockGsap()
  const el = { nodeType: 1, tagName: 'DIV' }
  resetPresentationMotionTargets(gsap, { stage: el })
  assert.equal(gsap.sets.length, 1)
  assert.strictEqual(gsap.sets[0].el, el)
  assert.deepEqual(gsap.sets[0].props, { clearProps: 'all' })
})

test('resetPresentationMotionTargets limits clears when keys are provided', () => {
  const gsap = createMockGsap()
  const shell = { nodeType: 1, tagName: 'SECTION' }
  const card = { nodeType: 1, tagName: 'DIV' }
  resetPresentationMotionTargets(gsap, { boardShell: shell, dungeonCardWrap: card }, ['boardShell'])
  assert.equal(gsap.sets.length, 1)
  assert.strictEqual(gsap.sets[0].el, shell)
  assert.deepEqual(gsap.sets[0].props, { clearProps: 'all' })
})

test('resetPresentationMotionTargets uses narrow clearProps for equipment_* keys', () => {
  const gsap = createMockGsap()
  const shell = { nodeType: 1, tagName: 'SECTION' }
  const equip = { nodeType: 1, tagName: 'SPAN' }
  resetPresentationMotionTargets(
    gsap,
    { boardShell: shell, equipment_W_SPEAR: equip },
    ['boardShell', 'equipment_W_SPEAR'],
  )
  assert.equal(gsap.sets.length, 2)
  assert.ok(gsap.sets.some((s) => s.el === shell && s.props.clearProps === 'all'))
  assert.ok(
    gsap.sets.some(
      (s) =>
        s.el === equip &&
        s.props.clearProps ===
          'opacity,filter,boxShadow,transform,transformOrigin,--dr-equip-activation-glow-opacity',
    ),
  )
})

test('resetPresentationMotionTargets ignores non-elements', () => {
  const gsap = createMockGsap()
  resetPresentationMotionTargets(gsap, { x: {} })
  assert.equal(gsap.sets.length, 0)
})

test('resetPresentationMotionTargets dungeon continue narrow clears filter only on dungeonCardWrap', () => {
  const gsap = createMockGsap()
  const shell = { nodeType: 1, tagName: 'SECTION' }
  const card = { nodeType: 1, tagName: 'DIV' }
  resetPresentationMotionTargets(
    gsap,
    { boardShell: shell, dungeonCardWrap: card },
    ['boardShell', 'dungeonCardWrap'],
    { dungeonContinueCardWrapNarrow: true },
  )
  assert.equal(gsap.sets.length, 2)
  assert.ok(gsap.sets.some((s) => s.el === shell && s.props.clearProps === 'all'))
  assert.ok(gsap.sets.some((s) => s.el === card && s.props.clearProps === 'filter'))
})

test('presentation motion kills timeline when active head id changes', async () => {
  const mockGsap = createMockGsap()
  const active = ref({
    id: 1,
    kind: 'TURN_ADVANCE',
    durationMs: 650,
    remainingMs: 650,
    channel: 'gameplay',
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  assert.equal(mockGsap._timelines.length, 1)
  const first = mockGsap._timelines[0]
  assert.equal(first.killed, false)
  assert.deepEqual(first.playCalls, [0])

  active.value = {
    id: 2,
    kind: 'TURN_ADVANCE',
    durationMs: 650,
    remainingMs: 650,
    channel: 'gameplay',
  }
  await nextTick()
  await flushMicrotasks()

  assert.equal(first.killed, true)
  assert.equal(mockGsap._timelines.length, 2)

  scope.stop()
})

test('presentation motion kills timeline when queue cleared (null head)', async () => {
  const mockGsap = createMockGsap()
  const active = ref({
    id: 1,
    kind: 'PHASE_ENTER_DUNGEON',
    durationMs: 1200,
    remainingMs: 1200,
    channel: 'gameplay',
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  const tl = mockGsap._timelines[0]
  active.value = null
  await nextTick()
  await flushMicrotasks()

  assert.equal(tl.killed, true)

  scope.stop()
})

test('presentation motion teardown on scope stop (unmount)', async () => {
  const mockGsap = createMockGsap()
  const active = ref({
    id: 1,
    kind: 'TURN_ADVANCE',
    durationMs: 500,
    remainingMs: 500,
    channel: 'gameplay',
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  const tl = mockGsap._timelines[0]
  scope.stop()
  await flushMicrotasks()

  assert.equal(tl.killed, true)
})

test('presentation motion resets refs when killing prior timeline', async () => {
  const mockGsap = createMockGsap()
  const el = { nodeType: 1, tagName: 'SECTION' }
  const active = ref({
    id: 1,
    kind: 'TURN_ADVANCE',
    durationMs: 400,
    remainingMs: 400,
    channel: 'gameplay',
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
      getMotionRefs: () => ({ boardShell: el }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  mockGsap.sets.length = 0

  active.value = {
    id: 2,
    kind: 'TURN_ADVANCE',
    durationMs: 400,
    remainingMs: 400,
    channel: 'gameplay',
  }
  await nextTick()
  await flushMicrotasks()

  assert.ok(mockGsap.sets.some((s) => s.el === el && s.props.clearProps === 'all'))

  scope.stop()
})

test('presentation motion teardown clears boardShell only when extra motion refs exist', async () => {
  const mockGsap = createMockGsap()
  const shell = { nodeType: 1, tagName: 'SECTION' }
  const cardWrap = { nodeType: 1, tagName: 'DIV' }
  const active = ref({
    id: 1,
    kind: 'TURN_ADVANCE',
    durationMs: 400,
    remainingMs: 400,
    channel: 'gameplay',
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
      getMotionRefs: () => ({ boardShell: shell, dungeonCardWrap: cardWrap }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  mockGsap.sets.length = 0

  active.value = {
    id: 2,
    kind: 'PHASE_ENTER_DUNGEON',
    durationMs: 1200,
    remainingMs: 1200,
    channel: 'gameplay',
  }
  await nextTick()
  await flushMicrotasks()

  assert.ok(mockGsap.sets.some((s) => s.el === shell && s.props.clearProps === 'all'))
  assert.equal(mockGsap.sets.some((s) => s.el === cardWrap), false)

  scope.stop()
})

test('presentation motion teardown clears neutralize targets including payload equipment keys', async () => {
  const mockGsap = createMockGsap()
  const shell = { nodeType: 1, tagName: 'SECTION' }
  const cardWrap = {
    nodeType: 1,
    tagName: 'DIV',
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 120, height: 180 }),
  }
  const equip = {
    nodeType: 1,
    tagName: 'SPAN',
    getBoundingClientRect: () => ({ left: 0, top: 400, width: 48, height: 28 }),
    cloneNode() {
      return { nodeType: 1, setAttribute() {}, remove() {} }
    },
  }
  const flightLayer = {
    nodeType: 1,
    appendChild() {},
  }
  const active = ref({
    id: 1,
    kind: 'DUNGEON_NEUTRALIZE',
    durationMs: 400,
    remainingMs: 400,
    channel: 'gameplay',
    payload: { neutralizedMonsterIds: ['orc'], consumedEquipmentIds: ['B_AXE'] },
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
      getMotionRefs: () => ({
        boardShell: shell,
        dungeonCardWrap: cardWrap,
        presentationFlightLayer: flightLayer,
        equipment_B_AXE: equip,
      }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  mockGsap.sets.length = 0

  active.value = {
    id: 2,
    kind: 'TURN_ADVANCE',
    durationMs: 400,
    remainingMs: 400,
    channel: 'gameplay',
  }
  await nextTick()
  await flushMicrotasks()

  assert.ok(mockGsap.sets.some((s) => s.el === cardWrap && s.props.clearProps === 'all'))
  assert.ok(
    mockGsap.sets.some(
      (s) =>
        s.el === equip &&
        s.props.clearProps ===
          'opacity,filter,boxShadow,transform,transformOrigin,--dr-equip-activation-glow-opacity',
    ),
  )
  assert.ok(mockGsap.sets.some((s) => s.el === shell && s.props.clearProps === 'all'))

  scope.stop()
})

test('presentation motion teardown clears sacrifice targets including payload equipment keys', async () => {
  const mockGsap = createMockGsap()
  const shell = { nodeType: 1, tagName: 'SECTION' }
  const cardWrap = {
    nodeType: 1,
    tagName: 'DIV',
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 120, height: 180 }),
  }
  const equip = {
    nodeType: 1,
    tagName: 'SPAN',
    getBoundingClientRect: () => ({ left: 0, top: 400, width: 48, height: 28 }),
    cloneNode() {
      return { nodeType: 1, setAttribute() {}, remove() {} }
    },
  }
  const flightLayer = {
    nodeType: 1,
    appendChild() {},
  }
  const active = ref({
    id: 1,
    kind: 'BIDDING_SACRIFICE',
    durationMs: 800,
    remainingMs: 800,
    channel: 'gameplay',
    payload: { consumedEquipmentIds: ['W_SHIELD'] },
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
      getMotionRefs: () => ({
        boardShell: shell,
        dungeonCardWrap: cardWrap,
        deckBadge: null,
        presentationFlightLayer: flightLayer,
        equipment_W_SHIELD: equip,
      }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  mockGsap.sets.length = 0

  active.value = {
    id: 2,
    kind: 'TURN_ADVANCE',
    durationMs: 400,
    remainingMs: 400,
    channel: 'gameplay',
  }
  await nextTick()
  await flushMicrotasks()

  assert.ok(mockGsap.sets.some((s) => s.el === cardWrap && s.props.clearProps === 'all'))
  assert.ok(
    mockGsap.sets.some(
      (s) =>
        s.el === equip &&
        s.props.clearProps ===
          'opacity,filter,boxShadow,transform,transformOrigin,--dr-equip-activation-glow-opacity',
    ),
  )
  assert.ok(mockGsap.sets.some((s) => s.el === shell && s.props.clearProps === 'all'))

  scope.stop()
})

test('presentation motion teardown clears dungeonCardWrap and boardShell for DUNGEON_OUTCOME', async () => {
  const mockGsap = createMockGsap()
  const shell = { nodeType: 1, tagName: 'SECTION' }
  const cardWrap = { nodeType: 1, tagName: 'DIV' }
  const active = ref({
    id: 1,
    kind: 'DUNGEON_OUTCOME',
    durationMs: 900,
    remainingMs: 900,
    channel: 'gameplay',
    payload: { dungeonRunResult: 'success' },
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
      getMotionRefs: () => ({
        boardShell: shell,
        dungeonCardWrap: cardWrap,
      }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  mockGsap.sets.length = 0

  active.value = null
  await nextTick()
  await flushMicrotasks()

  assert.ok(mockGsap.sets.some((s) => s.el === cardWrap && s.props.clearProps === 'all'))
  assert.ok(mockGsap.sets.some((s) => s.el === shell && s.props.clearProps === 'all'))

  scope.stop()
})

test('presentation motion plays phase beat after DUNGEON_OUTCOME queue gap', async () => {
  const mockGsap = createMockGsap()
  const shell = { nodeType: 1, tagName: 'SECTION' }
  const cardWrap = { nodeType: 1, tagName: 'DIV' }
  const active = ref({
    id: 1,
    kind: 'DUNGEON_OUTCOME',
    durationMs: 500,
    remainingMs: 500,
    channel: 'gameplay',
    payload: { dungeonRunResult: 'success' },
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
      getMotionRefs: () => ({
        boardShell: shell,
        dungeonCardWrap: cardWrap,
      }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  assert.equal(mockGsap._timelines.length, 1)
  assert.equal(mockGsap._timelines[0].playCalls.length, 1)

  active.value = null
  await nextTick()
  await flushMicrotasks()

  active.value = {
    id: 2,
    kind: 'PHASE_PICK_ADVENTURER',
    durationMs: 1200,
    remainingMs: 1200,
    channel: 'gameplay',
    label: 'Choosing next adventurer...',
  }
  await nextTick()
  await flushMicrotasks()

  assert.equal(mockGsap._timelines.length, 2)
  assert.equal(mockGsap._timelines[1].playCalls.length, 1)

  scope.stop()
})

test('presentation motion teardown clears dungeonCardWrap for DUNGEON_DAMAGE', async () => {
  const mockGsap = createMockGsap()
  const shell = { nodeType: 1, tagName: 'SECTION' }
  const cardWrap = { nodeType: 1, tagName: 'DIV' }
  const active = ref({
    id: 1,
    kind: 'DUNGEON_DAMAGE',
    durationMs: 500,
    remainingMs: 500,
    channel: 'gameplay',
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
      getMotionRefs: () => ({
        boardShell: shell,
        dungeonCardWrap: cardWrap,
      }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  mockGsap.sets.length = 0

  active.value = {
    id: 2,
    kind: 'TURN_ADVANCE',
    durationMs: 400,
    remainingMs: 400,
    channel: 'gameplay',
  }
  await nextTick()
  await flushMicrotasks()

  assert.ok(mockGsap.sets.some((s) => s.el === cardWrap && s.props.clearProps === 'all'))
  assert.ok(mockGsap.sets.some((s) => s.el === shell && s.props.clearProps === 'all'))

  scope.stop()
})

test('presentation motion teardown clears dungeonCardWrap, dungeonCardFlipAxis, and boardShell for DUNGEON_REVEAL', async () => {
  const mockGsap = createMockGsap()
  const shell = { nodeType: 1, tagName: 'SECTION' }
  const cardWrap = { nodeType: 1, tagName: 'DIV' }
  const flipAxis = { nodeType: 1, tagName: 'DIV' }
  const active = ref({
    id: 1,
    kind: 'DUNGEON_REVEAL',
    durationMs: 400,
    remainingMs: 400,
    channel: 'gameplay',
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
      getMotionRefs: () => ({
        boardShell: shell,
        dungeonCardWrap: cardWrap,
        dungeonCardFlipAxis: flipAxis,
      }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  mockGsap.sets.length = 0

  active.value = {
    id: 2,
    kind: 'TURN_ADVANCE',
    durationMs: 400,
    remainingMs: 400,
    channel: 'gameplay',
  }
  await nextTick()
  await flushMicrotasks()

  assert.ok(mockGsap.sets.some((s) => s.el === cardWrap && s.props.clearProps === 'all'))
  assert.ok(mockGsap.sets.some((s) => s.el === flipAxis && s.props.clearProps === 'all'))
  assert.ok(mockGsap.sets.some((s) => s.el === shell && s.props.clearProps === 'all'))

  scope.stop()
})

test('presentation motion teardown after DUNGEON_CONTINUE clears full dungeonCardWrap when queue goes idle', async () => {
  const mockGsap = createMockGsap()
  const shell = { nodeType: 1, tagName: 'SECTION' }
  const cardWrap = { nodeType: 1, tagName: 'DIV' }
  const active = ref({
    id: 1,
    kind: 'DUNGEON_CONTINUE',
    durationMs: 360,
    remainingMs: 360,
    channel: 'gameplay',
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
      getMotionRefs: () => ({
        boardShell: shell,
        dungeonCardWrap: cardWrap,
      }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  mockGsap.sets.length = 0

  active.value = null
  await nextTick()
  await flushMicrotasks()

  assert.ok(mockGsap.sets.some((s) => s.el === cardWrap && s.props.clearProps === 'all'))

  scope.stop()
})

test('presentation motion teardown after DUNGEON_CONTINUE uses narrow dungeonCardWrap clear only before DUNGEON_REVEAL', async () => {
  const mockGsap = createMockGsap()
  const shell = { nodeType: 1, tagName: 'SECTION' }
  const cardWrap = { nodeType: 1, tagName: 'DIV' }
  const flipAxis = { nodeType: 1, tagName: 'DIV' }
  const active = ref({
    id: 1,
    kind: 'DUNGEON_CONTINUE',
    durationMs: 360,
    remainingMs: 360,
    channel: 'gameplay',
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
      getMotionRefs: () => ({
        boardShell: shell,
        dungeonCardWrap: cardWrap,
        dungeonCardFlipAxis: flipAxis,
      }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  mockGsap.sets.length = 0

  active.value = {
    id: 2,
    kind: 'DUNGEON_REVEAL',
    durationMs: 600,
    remainingMs: 600,
    channel: 'gameplay',
  }
  await nextTick()
  await flushMicrotasks()

  assert.ok(mockGsap.sets.some((s) => s.el === cardWrap && s.props.clearProps === 'filter'))

  scope.stop()
})

test('presentation motion teardown clears hero overlay for HERO_CHANGE_INTERSTITIAL', async () => {
  const mockGsap = createMockGsap()
  const shell = { nodeType: 1, tagName: 'SECTION' }
  const overlay = { nodeType: 1, tagName: 'BUTTON' }
  const active = ref({
    id: 1,
    kind: 'HERO_CHANGE_INTERSTITIAL',
    durationMs: 2000,
    remainingMs: 2000,
    channel: 'gameplay',
    skippable: true,
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
      getMotionRefs: (head) =>
        head?.kind === 'HERO_CHANGE_INTERSTITIAL'
          ? { heroChangeInterstitialOverlay: overlay }
          : { boardShell: shell },
    })
  })

  await nextTick()
  await flushMicrotasks()
  mockGsap.sets.length = 0

  active.value = {
    id: 2,
    kind: 'TURN_ADVANCE',
    durationMs: 650,
    remainingMs: 650,
    channel: 'gameplay',
  }
  await nextTick()
  await flushMicrotasks()

  assert.ok(mockGsap.sets.some((s) => s.el === overlay && s.props.clearProps === 'all'))
  assert.equal(mockGsap.sets.some((s) => s.el === shell), false)

  scope.stop()
})

test('presentation motion kills timeline when active head kind changes (same id)', async () => {
  const mockGsap = createMockGsap()
  const active = ref({
    id: 99,
    kind: 'TURN_ADVANCE',
    durationMs: 400,
    remainingMs: 400,
    channel: 'gameplay',
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  const first = mockGsap._timelines[0]

  active.value = {
    id: 99,
    kind: 'PHASE_ENTER_DUNGEON',
    durationMs: 1200,
    remainingMs: 1200,
    channel: 'gameplay',
  }
  await nextTick()
  await flushMicrotasks()

  assert.equal(first.killed, true)
  assert.equal(mockGsap._timelines.length, 2)

  scope.stop()
})

test('presentation motion kills timeline when active head durationMs changes (same id/kind)', async () => {
  const mockGsap = createMockGsap()
  const active = ref({
    id: 7,
    kind: 'TURN_ADVANCE',
    durationMs: 650,
    remainingMs: 650,
    channel: 'gameplay',
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  const first = mockGsap._timelines[0]

  active.value = {
    id: 7,
    kind: 'TURN_ADVANCE',
    durationMs: 400,
    remainingMs: 400,
    channel: 'gameplay',
  }
  await nextTick()
  await flushMicrotasks()

  assert.equal(first.killed, true)
  assert.equal(mockGsap._timelines.length, 2)

  scope.stop()
})

test('presentation motion resyncs after in-place durationMs mutation when ref is triggered', async () => {
  const mockGsap = createMockGsap()
  const head = {
    id: 7,
    kind: 'TURN_ADVANCE',
    durationMs: 650,
    remainingMs: 650,
    channel: 'gameplay',
  }
  const active = ref(head)

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  const first = mockGsap._timelines[0]

  head.durationMs = 400
  head.remainingMs = 400
  await nextTick()
  await flushMicrotasks()
  assert.equal(first.killed, false)

  triggerRef(active)
  await nextTick()
  await flushMicrotasks()

  assert.equal(first.killed, true)
  assert.equal(mockGsap._timelines.length, 2)

  scope.stop()
})

test('presentation motion registers resize placeholder once per window', async () => {
  const resizeListeners = []
  const mockWindow = {
    addEventListener(type, handler) {
      if (type === 'resize') resizeListeners.push(handler)
    },
    removeEventListener() {},
  }
  const prevWindow = globalThis.window
  globalThis.window = mockWindow
  try {
    const mockGsap = createMockGsap()
    const active1 = ref({
      id: 1,
      kind: 'TURN_ADVANCE',
      durationMs: 300,
      remainingMs: 300,
      channel: 'gameplay',
    })
    const scope1 = effectScope(true)
    scope1.run(() => {
      usePresentationMotion({
        activePresentation: active1,
        loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
      })
    })
    await nextTick()
    await flushMicrotasks()
    assert.equal(resizeListeners.length, 1)

    const active2 = ref({
      id: 2,
      kind: 'TURN_ADVANCE',
      durationMs: 300,
      remainingMs: 300,
      channel: 'gameplay',
    })
    const scope2 = effectScope(true)
    scope2.run(() => {
      usePresentationMotion({
        activePresentation: active2,
        loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
      })
    })
    await nextTick()
    await flushMicrotasks()
    assert.equal(resizeListeners.length, 1)

    scope1.stop()
    scope2.stop()
  } finally {
    globalThis.window = prevWindow
  }
})

test('resize during layout-fragile beat kills timeline and plays fallback for remainder', async () => {
  const resizeListeners = []
  const mockWindow = {
    addEventListener(type, handler) {
      if (type === 'resize') resizeListeners.push(handler)
    },
    removeEventListener() {},
  }
  const prevWindow = globalThis.window
  globalThis.window = mockWindow
  try {
    const mockGsap = createMockGsap()
    const shell = { nodeType: 1, tagName: 'SECTION' }
    const card = { nodeType: 1, tagName: 'DIV' }
    const flip = { nodeType: 1, tagName: 'DIV' }
    const active = ref({
      id: 1,
      kind: 'DUNGEON_NEUTRALIZE',
      durationMs: 1000,
      remainingMs: 600,
      channel: 'gameplay',
      payload: { consumedEquipmentIds: ['W_SHIELD'] },
    })
    const scope = effectScope(true)
    scope.run(() => {
      usePresentationMotion({
        activePresentation: active,
        loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
        getMotionRefs: () => ({
          boardShell: shell,
          dungeonCardWrap: card,
          dungeonCardFlipAxis: flip,
          equipment_W_SHIELD: { nodeType: 1, tagName: 'DIV' },
        }),
      })
    })
    await nextTick()
    await flushMicrotasks()
    assert.equal(resizeListeners.length, 1)
    assert.equal(mockGsap._timelines.length, 2)
    const activeTl = mockGsap._timelines.at(-1)
    activeTl._timeSec = 0.4

    resizeListeners[0]()
    assert.equal(activeTl.killed, true)
    assert.equal(mockGsap._timelines.length, 3)
    const fallbackTl = mockGsap._timelines.at(-1)
    assert.deepEqual(fallbackTl.playCalls, [0])
    assert.equal(fallbackTl._lastFromToDurationSec, 0.6)

    scope.stop()
  } finally {
    globalThis.window = prevWindow
  }
})

test('resize during DUNGEON_REVEAL kills timeline and plays shell+card fallback for remainder', async () => {
  const resizeListeners = []
  const mockWindow = {
    addEventListener(type, handler) {
      if (type === 'resize') resizeListeners.push(handler)
    },
    removeEventListener() {},
  }
  const prevWindow = globalThis.window
  globalThis.window = mockWindow
  try {
    const mockGsap = createMockGsap()
    const shell = { nodeType: 1, tagName: 'SECTION' }
    const card = { nodeType: 1, tagName: 'DIV' }
    const flip = { nodeType: 1, tagName: 'DIV' }
    const active = ref({
      id: 3,
      kind: 'DUNGEON_REVEAL',
      durationMs: 800,
      remainingMs: 550,
      channel: 'gameplay',
      payload: {},
    })
    const scope = effectScope(true)
    scope.run(() => {
      usePresentationMotion({
        activePresentation: active,
        loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
        getMotionRefs: () => ({
          boardShell: shell,
          dungeonCardWrap: card,
          dungeonCardFlipAxis: flip,
        }),
      })
    })
    await nextTick()
    await flushMicrotasks()
    assert.equal(resizeListeners.length, 1)
    assert.equal(mockGsap._timelines.length, 2)
    const activeTl = mockGsap._timelines.at(-1)
    activeTl._timeSec = 0.25

    resizeListeners[0]()
    assert.equal(activeTl.killed, true)
    assert.equal(mockGsap._timelines.length, 3)
    const fallbackTl = mockGsap._timelines.at(-1)
    assert.deepEqual(fallbackTl.playCalls, [0])
    assert.equal(fallbackTl._lastFromToDurationSec, 0.55)

    scope.stop()
  } finally {
    globalThis.window = prevWindow
  }
})

test('resize during non-fragile beat does not replace timeline', async () => {
  const resizeListeners = []
  const mockWindow = {
    addEventListener(type, handler) {
      if (type === 'resize') resizeListeners.push(handler)
    },
    removeEventListener() {},
  }
  const prevWindow = globalThis.window
  globalThis.window = mockWindow
  try {
    const mockGsap = createMockGsap()
    const shell = { nodeType: 1, tagName: 'SECTION' }
    const active = ref({
      id: 1,
      kind: 'TURN_ADVANCE',
      durationMs: 500,
      remainingMs: 500,
      channel: 'gameplay',
    })
    const scope = effectScope(true)
    scope.run(() => {
      usePresentationMotion({
        activePresentation: active,
        loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
        getMotionRefs: () => ({ boardShell: shell }),
      })
    })
    await nextTick()
    await flushMicrotasks()
    const first = mockGsap._timelines[0]
    first._timeSec = 0.2
    resizeListeners[0]()
    assert.equal(first.killed, false)
    assert.equal(mockGsap._timelines.length, 1)

    scope.stop()
  } finally {
    globalThis.window = prevWindow
  }
})

test('resize during DUNGEON_NEUTRALIZE without ghost flight does not replace timeline', async () => {
  const resizeListeners = []
  const mockWindow = {
    addEventListener(type, handler) {
      if (type === 'resize') resizeListeners.push(handler)
    },
    removeEventListener() {},
  }
  const prevWindow = globalThis.window
  globalThis.window = mockWindow
  try {
    const mockGsap = createMockGsap()
    const shell = { nodeType: 1, tagName: 'SECTION' }
    const card = { nodeType: 1, tagName: 'DIV' }
    const active = ref({
      id: 7,
      kind: 'DUNGEON_NEUTRALIZE',
      durationMs: 520,
      remainingMs: 520,
      channel: 'gameplay',
      payload: {},
    })
    const scope = effectScope(true)
    scope.run(() => {
      usePresentationMotion({
        activePresentation: active,
        loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
        getMotionRefs: () => ({ boardShell: shell, dungeonCardWrap: card }),
      })
    })
    await nextTick()
    await flushMicrotasks()
    assert.equal(mockGsap._timelines.length, 2)
    const activeTl = mockGsap._timelines.at(-1)
    activeTl._timeSec = 0.1
    resizeListeners[0]()
    assert.equal(activeTl.killed, false)
    assert.equal(mockGsap._timelines.length, 2)

    scope.stop()
  } finally {
    globalThis.window = prevWindow
  }
})

test('resize during DUNGEON_NEUTRALIZE with consumedEquipmentIds kills timeline and plays fallback', async () => {
  const resizeListeners = []
  const mockWindow = {
    addEventListener(type, handler) {
      if (type === 'resize') resizeListeners.push(handler)
    },
    removeEventListener() {},
  }
  const prevWindow = globalThis.window
  globalThis.window = mockWindow
  try {
    const mockGsap = createMockGsap()
    const shell = { nodeType: 1, tagName: 'SECTION' }
    const cardWrap = {
      nodeType: 1,
      tagName: 'DIV',
      getBoundingClientRect: () => ({ left: 10, top: 20, width: 120, height: 180 }),
    }
    const equip = {
      nodeType: 1,
      tagName: 'SPAN',
      getBoundingClientRect: () => ({ left: 0, top: 400, width: 48, height: 28 }),
      cloneNode() {
        return { nodeType: 1, setAttribute() {}, remove() {} }
      },
    }
    const flightLayer = {
      nodeType: 1,
      appendChild() {},
    }
    const active = ref({
      id: 42,
      kind: 'DUNGEON_NEUTRALIZE',
      durationMs: 1000,
      remainingMs: 600,
      channel: 'gameplay',
      payload: { neutralizedMonsterIds: ['orc'], consumedEquipmentIds: ['B_AXE'] },
    })
    const scope = effectScope(true)
    scope.run(() => {
      usePresentationMotion({
        activePresentation: active,
        loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
        getMotionRefs: () => ({
          boardShell: shell,
          dungeonCardWrap: cardWrap,
          presentationFlightLayer: flightLayer,
          equipment_B_AXE: equip,
        }),
      })
    })
    await nextTick()
    await flushMicrotasks()
    assert.equal(resizeListeners.length, 1)
    assert.equal(mockGsap._timelines.length, 2)
    const activeTl = mockGsap._timelines.at(-1)
    activeTl._timeSec = 0.4

    resizeListeners[0]()
    assert.equal(activeTl.killed, true)
    assert.equal(mockGsap._timelines.length, 3)
    const fallbackTl = mockGsap._timelines.at(-1)
    assert.deepEqual(fallbackTl.playCalls, [0])
    assert.equal(fallbackTl._lastFromToDurationSec, 0.6)

    scope.stop()
  } finally {
    globalThis.window = prevWindow
  }
})

test('loadPresentationGsap runs once across sequential heads', async () => {
  const mockGsap = createMockGsap()
  let loadCount = 0
  const active = ref({
    id: 1,
    kind: 'TURN_ADVANCE',
    durationMs: 300,
    remainingMs: 300,
    channel: 'gameplay',
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => {
        loadCount += 1
        return { gsap: mockGsap, Flip: {} }
      },
    })
  })

  await nextTick()
  await flushMicrotasks()
  active.value = {
    id: 2,
    kind: 'TURN_ADVANCE',
    durationMs: 300,
    remainingMs: 300,
    channel: 'gameplay',
  }
  await nextTick()
  await flushMicrotasks()

  assert.equal(loadCount, 1)

  scope.stop()
})

test('hero skip simulation: head replaced — kills overlay tween and clears overlay only', async () => {
  const mockGsap = createMockGsap()
  const shell = { nodeType: 1, tagName: 'SECTION' }
  const overlay = { nodeType: 1, tagName: 'BUTTON' }
  const active = ref({
    id: 10,
    kind: 'HERO_CHANGE_INTERSTITIAL',
    durationMs: 2000,
    remainingMs: 1500,
    channel: 'gameplay',
    skippable: true,
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
      getMotionRefs: (head) =>
        head?.kind === 'HERO_CHANGE_INTERSTITIAL'
          ? { heroChangeInterstitialOverlay: overlay }
          : { boardShell: shell },
    })
  })

  await nextTick()
  await flushMicrotasks()
  const heroTl = mockGsap._timelines[0]
  mockGsap.sets.length = 0

  active.value = {
    id: 11,
    kind: 'TURN_ADVANCE',
    durationMs: 650,
    remainingMs: 650,
    channel: 'gameplay',
  }
  await nextTick()
  await flushMicrotasks()

  assert.equal(heroTl.killed, true)
  assert.ok(mockGsap.sets.some((s) => s.el === overlay && s.props.clearProps === 'all'))
  assert.equal(mockGsap.sets.some((s) => s.el === shell), false)

  scope.stop()
})

test('does not load GSAP when active presentation stays null', async () => {
  const mockGsap = createMockGsap()
  let loadCount = 0
  const active = ref(null)

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => {
        loadCount += 1
        return { gsap: mockGsap, Flip: {} }
      },
    })
  })

  await nextTick()
  await flushMicrotasks()

  assert.equal(loadCount, 0)
  assert.equal(mockGsap._timelines.length, 0)

  scope.stop()
})

test('head cleared before lazy GSAP resolves does not create a timeline', async () => {
  const mockGsap = createMockGsap()
  /** @type {(() => void) | undefined} */
  let releaseLoad
  const loadPresentationGsap = () =>
    new Promise((resolve) => {
      releaseLoad = () => resolve({ gsap: mockGsap, Flip: {} })
    })

  const active = ref({
    id: 1,
    kind: 'TURN_ADVANCE',
    durationMs: 400,
    remainingMs: 400,
    channel: 'gameplay',
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap,
    })
  })

  await nextTick()
  active.value = null
  await nextTick()
  assert.ok(typeof releaseLoad === 'function')
  releaseLoad()
  await flushMicrotasks()

  assert.equal(mockGsap._timelines.length, 0)

  scope.stop()
})

test('rapid head changes kill each prior timeline (only last survives)', async () => {
  const mockGsap = createMockGsap()
  const active = ref({
    id: 1,
    kind: 'TURN_ADVANCE',
    durationMs: 300,
    remainingMs: 300,
    channel: 'gameplay',
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  const tl1 = mockGsap._timelines[0]

  active.value = {
    id: 2,
    kind: 'TURN_ADVANCE',
    durationMs: 300,
    remainingMs: 300,
    channel: 'gameplay',
  }
  await nextTick()
  await flushMicrotasks()
  const tl2 = mockGsap._timelines[1]

  active.value = {
    id: 3,
    kind: 'TURN_ADVANCE',
    durationMs: 300,
    remainingMs: 300,
    channel: 'gameplay',
  }
  await nextTick()
  await flushMicrotasks()

  assert.equal(tl1.killed, true)
  assert.equal(tl2.killed, true)
  assert.equal(mockGsap._timelines.length, 3)
  assert.equal(mockGsap._timelines[2].killed, false)

  scope.stop()
  assert.equal(mockGsap._timelines[2].killed, true)
})

test('hero skip to idle (null head) kills interstitial timeline and clears overlay', async () => {
  const mockGsap = createMockGsap()
  const overlay = { nodeType: 1, tagName: 'BUTTON' }
  const active = ref({
    id: 10,
    kind: 'HERO_CHANGE_INTERSTITIAL',
    durationMs: 2000,
    remainingMs: 2000,
    channel: 'gameplay',
    skippable: true,
  })

  const scope = effectScope(true)
  scope.run(() => {
    usePresentationMotion({
      activePresentation: active,
      loadPresentationGsap: async () => ({ gsap: mockGsap, Flip: {} }),
      getMotionRefs: () => ({ heroChangeInterstitialOverlay: overlay }),
    })
  })

  await nextTick()
  await flushMicrotasks()
  const heroTl = mockGsap._timelines[0]
  mockGsap.sets.length = 0

  active.value = null
  await nextTick()
  await flushMicrotasks()

  assert.equal(heroTl.killed, true)
  assert.ok(mockGsap.sets.some((s) => s.el === overlay && s.props.clearProps === 'all'))
  assert.equal(mockGsap._timelines.length, 1)

  scope.stop()
})
