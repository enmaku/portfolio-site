import assert from 'node:assert/strict'
import { afterEach, before, beforeEach, mock, test } from 'node:test'
import { ref } from 'vue'
import { PROJECT_SHELL_FULLSCREEN_FAILURE_NOTIFY_TYPE } from '../notifyProjectShellFullscreenFailure.js'
import { PROJECT_SHELL_FRAME_NOTIFY_DEFAULTS } from '../projectShellNotifyFrame.js'

/** @type {import('./useScopedFullscreen.js').useScopedFullscreen extends (options: infer T) => void ? T | null : never} */
let scopedFullscreenOptions = null

/** @type {Document | undefined} */
let previousDocument

before(async () => {
  if (!mock.module) return

  mock.module('./useScopedFullscreen.js', {
    namedExports: {
      useScopedFullscreen: (options) => {
        scopedFullscreenOptions = options
      },
    },
  })
})

beforeEach(() => {
  scopedFullscreenOptions = null
  previousDocument = globalThis.document
  globalThis.document = /** @type {Document} */ ({
    documentElement: { nodeName: 'HTML' },
  })
})

afterEach(() => {
  if (previousDocument === undefined) {
    delete globalThis.document
  } else {
    globalThis.document = previousDocument
  }
})

const composableTests = { skip: !mock.module }

test(
  'useProjectShellBrowserFullscreen wires persisted preference to documentElement target',
  composableTests,
  async () => {
    const module = await import(`./useProjectShellBrowserFullscreen.js?test=${Date.now()}`)
    const enabled = ref(true)
    const setEnabledCalls = []
    module.useProjectShellBrowserFullscreen({
      enabled,
      setEnabled: (next) => setEnabledCalls.push(next),
      notify: () => {},
    })

    assert.ok(scopedFullscreenOptions)
    assert.equal(scopedFullscreenOptions.enabled, enabled)
    assert.equal(scopedFullscreenOptions.getTargetElement(), document.documentElement)
    scopedFullscreenOptions.setEnabled(true)
    assert.deepEqual(setEnabledCalls, [true])
  },
)

test(
  'useProjectShellBrowserFullscreen forwards fullscreen request failure to project-shell notify',
  composableTests,
  async () => {
    const module = await import(`./useProjectShellBrowserFullscreen.js?test=${Date.now()}`)
    const notifyCalls = []
    module.useProjectShellBrowserFullscreen({
      enabled: ref(false),
      setEnabled: () => {},
      notify: (opts) => notifyCalls.push(opts),
    })

    assert.ok(scopedFullscreenOptions?.onRequestFailure)
    scopedFullscreenOptions.onRequestFailure()

    assert.equal(notifyCalls.length, 1)
    assert.equal(notifyCalls[0].type, PROJECT_SHELL_FULLSCREEN_FAILURE_NOTIFY_TYPE)
    assert.equal(notifyCalls[0].position, PROJECT_SHELL_FRAME_NOTIFY_DEFAULTS.position)
  },
)
