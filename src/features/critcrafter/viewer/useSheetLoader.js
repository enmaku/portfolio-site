import { ref, shallowRef } from 'vue'
import { getAppCheckToken } from './appCheck.js'
import { loadSheet } from './loadSheet.js'
import { rememberRecent } from './recent.js'
import { resolveSheetFunctionUrl } from './viewerModel.js'

/**
 * Reactive wrapper over `loadSheet` for the page. Thin on purpose: all behaviour lives in loadSheet.js.
 * `phase` is 'idle' (landing) | 'loading' | 'ready' | 'error'.
 */
export function useSheetLoader() {
  const phase = ref('idle')
  const step = ref('fetching')
  const sheet = shallowRef(null)
  const failure = ref(null)
  let current = 0

  /** @param {string} id Normalised Pathbuilder id. */
  async function load(id) {
    const ticket = ++current
    phase.value = 'loading'
    step.value = 'fetching'
    sheet.value = null
    failure.value = null
    const e = import.meta.env ?? {}
    const result = await loadSheet({
      id,
      fetchImpl: (...args) => fetch(...args),
      functionUrl: resolveSheetFunctionUrl({
        base: e.VITE_CRITCRAFTER_FUNCTIONS_BASE,
        projectId: e.VITE_FIREBASE_PROJECT_ID,
      }),
      getAppCheckToken,
      onStep: (s) => {
        if (ticket === current) step.value = s
      },
    })
    if (ticket !== current) return
    if (result.ok) {
      sheet.value = result.sheet
      phase.value = 'ready'
      rememberRecent(id, String(result.sheet?.header?.name ?? `Character ${id}`))
    } else {
      failure.value = result
      phase.value = 'error'
    }
  }

  function reset() {
    current++
    phase.value = 'idle'
    sheet.value = null
    failure.value = null
  }

  return { phase, step, sheet, failure, load, reset }
}
