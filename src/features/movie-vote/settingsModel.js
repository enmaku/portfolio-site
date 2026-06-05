import { resolveProjectShellBrowserFullscreenChrome } from '../../layouts/projects/projectShellFullscreenChrome.js'

/**
 * @param {{
 *   isGuest: boolean
 *   phase: import('./types.js').MovieVotePhase
 *   fullscreenChromeExposed?: boolean
 * }} input
 */
export function getMovieVoteSettingsModel(input) {
  const locked = input.phase !== 'suggest'
  return {
    votingMethodEditable: !input.isGuest && !locked,
    votingMethodReadOnly: input.isGuest || locked,
    showFullscreen: resolveProjectShellBrowserFullscreenChrome(input),
  }
}
