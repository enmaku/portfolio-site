import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PROJECT_SHELL_MOBILE_PLAY_FULLSCREEN_CHROME_EXPOSED,
  resolveProjectShellBrowserFullscreenChrome,
} from './projectShellFullscreenChrome.js'

test('mobile play route adapter exposes browser fullscreen toggle chrome', () => {
  assert.equal(PROJECT_SHELL_MOBILE_PLAY_FULLSCREEN_CHROME_EXPOSED, true)
  assert.equal(
    resolveProjectShellBrowserFullscreenChrome({
      fullscreenChromeExposed: PROJECT_SHELL_MOBILE_PLAY_FULLSCREEN_CHROME_EXPOSED,
    }),
    true,
  )
})

test('desktop project route adapter hides browser fullscreen toggle chrome', () => {
  assert.equal(resolveProjectShellBrowserFullscreenChrome({ fullscreenChromeExposed: false }), false)
})

test('missing adapter defaults to hidden chrome', () => {
  assert.equal(resolveProjectShellBrowserFullscreenChrome({}), false)
  assert.equal(resolveProjectShellBrowserFullscreenChrome({ fullscreenChromeExposed: undefined }), false)
})
