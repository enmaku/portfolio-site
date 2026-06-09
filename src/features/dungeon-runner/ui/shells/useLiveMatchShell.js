import { reactive } from 'vue'
import { wireLiveMatchShellConcerns } from './wireLiveMatchShellConcerns.js'

export { LIVE_MATCH_SHELL_SESSION_GROUPS } from './liveMatchShellSessionGroups.js'

/**
 * Live-match session: board, mid-match dialogs, AI pipeline, presentation motion.
 *
 * @param {Parameters<typeof wireLiveMatchShellConcerns>[0]} deps
 */
export function useLiveMatchShell(deps) {
  const wired = wireLiveMatchShellConcerns(deps)
  return reactive(wired.assembleInjectGroups())
}
