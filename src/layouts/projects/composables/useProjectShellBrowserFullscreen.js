import { notifyProjectShellFullscreenFailure } from '../notifyProjectShellFullscreenFailure.js'
import { useScopedFullscreen } from './useScopedFullscreen.js'

/**
 * Browser-tab fullscreen for project-shell play pages: persisted preference plus failure toast.
 *
 * @param {{
 *   enabled: import('vue').MaybeRefOrGetter<boolean>
 *   setEnabled: (next: boolean) => void
 *   notify: (opts: Record<string, unknown>) => void
 * }} options
 */
export function useProjectShellBrowserFullscreen({ enabled, setEnabled, notify }) {
  useScopedFullscreen({
    enabled,
    setEnabled,
    getTargetElement: () => document.documentElement,
    onRequestFailure: () => notifyProjectShellFullscreenFailure(notify),
  })
}
