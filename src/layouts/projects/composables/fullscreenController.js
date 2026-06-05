/**
 * @param {{
 *   getTargetElement: () => Element | null
 *   readEnabled: () => boolean
 *   writeEnabled: (next: boolean) => void
 *   onRequestFailure?: () => void
 *   fullscreenApi?: {
 *     readonly fullscreenElement: Element | null
 *     requestFullscreen: (el: Element) => Promise<void>
 *     exitFullscreen: () => Promise<void>
 *   }
 * }} options
 */
export function createFullscreenController(options) {
  const api = options.fullscreenApi ?? {
    get fullscreenElement() {
      return document.fullscreenElement
    },
    requestFullscreen: (el) => el.requestFullscreen(),
    exitFullscreen: () => document.exitFullscreen(),
  }

  async function sync() {
    const target = options.getTargetElement()
    if (!target) return
    if (options.readEnabled()) {
      if (api.fullscreenElement === target) return
      try {
        await api.requestFullscreen(target)
      } catch {
        options.writeEnabled(false)
        options.onRequestFailure?.()
      }
      return
    }
    if (api.fullscreenElement === target) {
      await api.exitFullscreen()
    }
  }

  return {
    async setEnabled(next) {
      options.writeEnabled(Boolean(next))
      await sync()
    },
    sync,
    async cleanup() {
      const target = options.getTargetElement()
      if (!target) return
      if (api.fullscreenElement === target) {
        await api.exitFullscreen()
      }
    },
  }
}
