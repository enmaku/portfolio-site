import { onMounted, onUnmounted } from 'vue'
import { pushMergedHistoryState } from './vueRouterHistoryState.js'

/** @type {{ portfolioProjectBrowserBackTrap: true }} */
const TRAP_HISTORY_STATE = { portfolioProjectBrowserBackTrap: true }

function onTrapPopState() {
  pushMergedHistoryState(TRAP_HISTORY_STATE)
}

/**
 * Keeps the tab on the current project shell: browser back pops our sentinel
 * entry, then we push it again (same pattern as photo preview in IndexPage).
 */
export function useTrapBrowserBack() {
  onMounted(() => {
    if (typeof window === 'undefined') return
    pushMergedHistoryState(TRAP_HISTORY_STATE)
    window.addEventListener('popstate', onTrapPopState)
  })

  onUnmounted(() => {
    if (typeof window === 'undefined') return
    window.removeEventListener('popstate', onTrapPopState)
  })
}
