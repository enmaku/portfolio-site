import assert from 'node:assert/strict'
import test from 'node:test'
import { buildGameTimerRoomShareUrl } from './roomId.js'

test('buildGameTimerRoomShareUrl emits canonical non-hash room link', () => {
  const originalWindow = globalThis.window
  globalThis.window = /** @type {Window} */ ({
    location: {
      href: 'https://focusdisorder.com/#/projects/game-timer',
    },
  })

  try {
    const url = buildGameTimerRoomShareUrl('AB12CD')
    assert.equal(url, 'https://focusdisorder.com/projects/game-timer?room=AB12CD')
  } finally {
    globalThis.window = originalWindow
  }
})
