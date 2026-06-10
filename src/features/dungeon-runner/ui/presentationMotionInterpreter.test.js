import assert from 'node:assert/strict'
import test from 'node:test'

import { createPresentationMotionTimeline } from './presentationMotionInterpreter.js'

test('TURN_ADVANCE via createPresentationMotionTimeline tweens boardShell opacity', () => {
  const boardShell = { nodeType: 1, tagName: 'SECTION' }
  const calls = []
  const gsap = {
    timeline(opts) {
      return {
        opts,
        paused: true,
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

  const tl = createPresentationMotionTimeline(gsap, {
    kind: 'TURN_ADVANCE',
    durationMs: 240,
    refs: { boardShell },
  })

  assert.equal(calls.length, 1)
  assert.strictEqual(calls[0].target, boardShell)
  assert.deepEqual(calls[0].fromVars, { opacity: 0.92 })
  assert.deepEqual(calls[0].toVars, { opacity: 1, duration: 0.24, ease: 'power1.out' })
  assert.equal(tl.opts?.paused, true)
})

test('unknown presentation kind throws from createPresentationMotionTimeline', () => {
  const gsap = {
    timeline() {
      return { kill() {} }
    },
  }
  assert.throws(
    () =>
      createPresentationMotionTimeline(gsap, {
        kind: 'NOT_A_REAL_KIND',
        durationMs: 100,
        refs: {},
      }),
    /No presentation motion factory for kind: NOT_A_REAL_KIND/,
  )
})
