import { resolveProjectShellBrowserFullscreenChrome } from '../../layouts/projects/projectShellFullscreenChrome.js'

/**
 * @param {{ isGuest: boolean, fullscreenChromeExposed?: boolean }} input
 */
export function getGameTimerSettingsModel(input) {
  return {
    showRoundRules: !input.isGuest,
    showFullscreen: resolveProjectShellBrowserFullscreenChrome(input),
  }
}

