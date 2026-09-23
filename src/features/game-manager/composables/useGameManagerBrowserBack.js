/**
 * Game Manager browser-back: close layered UI innermost-first; never leave the GM route
 * unless an intentional leave is armed (manager-linked timer launch).
 */
import {
  computed,
  inject,
  onMounted,
  onUnmounted,
  provide,
  shallowRef,
  unref,
  watch,
} from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import {
  claimLayerOnStack,
  releaseLayerFromStack,
  resolveGameManagerBrowserBackAction,
  shouldBlockGameManagerRouteLeave,
} from '../domain/gameManagerBrowserBack.js'

export const GAME_MANAGER_BROWSER_BACK_KEY = 'gameManagerBrowserBack'

/** @type {{ portfolioGameManagerBrowserBack: true }} */
const LAYER_HISTORY_STATE = { portfolioGameManagerBrowserBack: true }

/**
 * Provide Game Manager browser-back handling for the current page tree.
 */
export function provideGameManagerBrowserBack() {
  /** @type {import('vue').ShallowRef<Array<{ id: string, close: () => void }>>} */
  const stack = shallowRef([])
  let allowLeave = false
  let ignoreNextPopstate = false
  let closingFromPopstate = false

  function allowNextLeave() {
    allowLeave = true
    // Drop layer ownership without history.back — overlay teardown after
    // router.push must not rewind the timer navigation.
    stack.value = []
  }

  /**
   * @param {string} id
   * @param {() => void} close
   */
  function claimLayer(id, close) {
    if (typeof window === 'undefined' || !id) return
    const next = claimLayerOnStack(stack.value, { id, close })
    if (next === stack.value) return
    stack.value = next
    history.pushState(LAYER_HISTORY_STATE, '')
  }

  /**
   * @param {string} id
   * @param {{ syncHistory?: boolean }} [options]
   */
  function releaseLayer(id, options = {}) {
    if (typeof window === 'undefined' || !id) return
    const syncHistory = options.syncHistory !== false
    const prev = stack.value
    const next = releaseLayerFromStack(prev, id)
    if (next.length === prev.length) return
    const wasTop = prev.length > 0 && prev[prev.length - 1].id === id
    stack.value = next
    if (closingFromPopstate || !wasTop || !syncHistory) return
    ignoreNextPopstate = true
    history.back()
  }

  function closeTopLayer() {
    const action = resolveGameManagerBrowserBackAction({
      layerIds: stack.value.map((entry) => entry.id),
    })
    if (action.type !== 'closeLayer') return false
    const layer = stack.value[stack.value.length - 1]
    if (!layer) return false
    closingFromPopstate = true
    stack.value = releaseLayerFromStack(stack.value, layer.id)
    try {
      layer.close()
    } finally {
      closingFromPopstate = false
    }
    return true
  }

  function onPopState() {
    if (ignoreNextPopstate) {
      ignoreNextPopstate = false
      return
    }
    closeTopLayer()
  }

  onBeforeRouteLeave((to) => {
    const armed = allowLeave
    allowLeave = false
    if (
      !shouldBlockGameManagerRouteLeave({
        toPath: to.path,
        allowLeave: armed,
      })
    ) {
      return true
    }
    if (stack.value.length > 0) {
      closeTopLayer()
    }
    return false
  })

  onMounted(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('popstate', onPopState)
  })

  onUnmounted(() => {
    if (typeof window === 'undefined') return
    window.removeEventListener('popstate', onPopState)
  })

  const api = {
    allowNextLeave,
    claimLayer,
    releaseLayer,
  }

  provide(GAME_MANAGER_BROWSER_BACK_KEY, api)
  return api
}

/**
 * Register a dismissible layer while `isOpen` is true.
 * @param {import('vue').Ref<boolean> | import('vue').ComputedRef<boolean> | boolean} isOpen
 * @param {() => void} close
 * @param {string} [layerId]
 */
export function useGameManagerBackLayer(isOpen, close, layerId) {
  const api = inject(GAME_MANAGER_BROWSER_BACK_KEY, null)
  const id =
    layerId ||
    `gm-back-${Math.random().toString(36).slice(2, 10)}`

  watch(
    () => Boolean(unref(isOpen)),
    (open, wasOpen) => {
      if (!api) return
      if (open && !wasOpen) {
        api.claimLayer(id, close)
      } else if (!open && wasOpen) {
        api.releaseLayer(id)
      }
    },
    { immediate: true },
  )

  onUnmounted(() => {
    if (!api) return
    if (unref(isOpen)) {
      api.releaseLayer(id, { syncHistory: false })
    }
  })
}

/**
 * Convenience for boolean refs (dialogs / flags).
 * @param {import('vue').Ref<boolean>} openRef
 * @param {string} [layerId]
 */
export function useGameManagerBackLayerRef(openRef, layerId) {
  useGameManagerBackLayer(
    openRef,
    () => {
      openRef.value = false
    },
    layerId,
  )
}

/**
 * Convenience for nullable overlay targets (person stats, etc.).
 * @param {import('vue').Ref<unknown>} targetRef
 * @param {string} [layerId]
 */
export function useGameManagerBackLayerNullable(targetRef, layerId) {
  useGameManagerBackLayer(
    computed(() => targetRef.value != null),
    () => {
      targetRef.value = null
    },
    layerId,
  )
}
