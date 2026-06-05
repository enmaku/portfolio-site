import { inject, provide } from 'vue'

export const PROJECT_SHELL_BROWSER_FULLSCREEN_CHROME_KEY = Symbol(
  'projectShellBrowserFullscreenChrome',
)

/** Inject value for phone-framed mobile play routes under {@link ProjectShellLayout}. */
export const PROJECT_SHELL_MOBILE_PLAY_FULLSCREEN_CHROME_EXPOSED = true

/**
 * Whether the current project shell route exposes **browser fullscreen toggle** chrome.
 *
 * @param {{ fullscreenChromeExposed?: boolean }} input
 */
export function resolveProjectShellBrowserFullscreenChrome(input) {
  return input.fullscreenChromeExposed === true
}

/** Route-seam adapter: expose toggle chrome for mobile play routes in {@link ProjectShellLayout}. */
export function provideProjectShellMobilePlayFullscreenChrome() {
  provide(
    PROJECT_SHELL_BROWSER_FULLSCREEN_CHROME_KEY,
    PROJECT_SHELL_MOBILE_PLAY_FULLSCREEN_CHROME_EXPOSED,
  )
}

/**
 * Route-seam adapter: `true` under {@link ProjectShellLayout} mobile play routes, default `false` elsewhere (e.g. Desktop project surfaces).
 */
export function useProjectShellBrowserFullscreenChrome() {
  return inject(PROJECT_SHELL_BROWSER_FULLSCREEN_CHROME_KEY, false)
}
