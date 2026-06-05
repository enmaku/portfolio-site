import assert from 'node:assert/strict'
import test from 'node:test'
import { PROJECT_SHELL_FRAME_NOTIFY_DEFAULTS } from './projectShellNotifyFrame.js'
import {
  PROJECT_SHELL_FULLSCREEN_FAILURE_NOTIFY_TYPE,
  notifyProjectShellFullscreenFailure,
} from './notifyProjectShellFullscreenFailure.js'

test('notifyProjectShellFullscreenFailure uses warning severity and framed notify position', () => {
  const calls = []
  notifyProjectShellFullscreenFailure((opts) => {
    calls.push(opts)
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].type, PROJECT_SHELL_FULLSCREEN_FAILURE_NOTIFY_TYPE)
  assert.equal(calls[0].position, PROJECT_SHELL_FRAME_NOTIFY_DEFAULTS.position)
  assert.equal(typeof calls[0].message, 'string')
  assert.ok(calls[0].message.length > 0)
  assert.equal(calls[0].timeout, 2500)
})
