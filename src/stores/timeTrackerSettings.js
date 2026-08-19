import { acceptHMRUpdate, defineStore } from 'pinia'
import { defaultOwnerPrefs, normalizeOwnerPrefs } from '../features/time-tracker/sessionPrefs.js'
import { DEFAULT_TIMER_COLOR, parseTimerColor } from '../features/time-tracker/timerAccent.js'

export const useTimeTrackerSettingsStore = defineStore('timeTrackerSettings', {
  state: () => ({
    fullscreenEnabled: false,
    timerColor: DEFAULT_TIMER_COLOR,
    prefsByOwner: {},
  }),

  persist: {
    key: 'portfolio-time-tracker',
    afterHydrate: ({ store }) => {
      store.fullscreenEnabled = store.fullscreenEnabled === true
      const color = parseTimerColor(store.timerColor)
      store.timerColor = color ?? DEFAULT_TIMER_COLOR
      const bag = store.prefsByOwner && typeof store.prefsByOwner === 'object' ? store.prefsByOwner : {}
      /** @type {Record<string, ReturnType<typeof defaultOwnerPrefs>>} */
      const next = {}
      for (const [uid, prefs] of Object.entries(bag)) {
        next[uid] = normalizeOwnerPrefs(prefs)
      }
      store.prefsByOwner = next
    },
  },

  actions: {
    setFullscreenEnabled(value) {
      this.fullscreenEnabled = value === true
    },
    prefsFor(uid) {
      if (!uid || !Object.prototype.hasOwnProperty.call(this.prefsByOwner, uid)) return null
      return normalizeOwnerPrefs(this.prefsByOwner[uid])
    },
    patchOwnerPrefs(uid, patch) {
      if (!uid) return
      const current = this.prefsFor(uid) || defaultOwnerPrefs()
      const next = normalizeOwnerPrefs({ ...current, ...patch })
      this.prefsByOwner = { ...this.prefsByOwner, [uid]: next }
      if (patch.timerColor != null) {
        const color = parseTimerColor(patch.timerColor)
        if (color) this.timerColor = color
      }
    },
    setTimerColor(value, uid) {
      const color = parseTimerColor(value)
      if (!color) return
      this.timerColor = color
      if (uid) this.patchOwnerPrefs(uid, { timerColor: color })
    },
    applyOwner(uid) {
      const prefs = this.prefsFor(uid)
      if (prefs) this.timerColor = prefs.timerColor
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTimeTrackerSettingsStore, import.meta.hot))
}
