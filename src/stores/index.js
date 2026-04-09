/**
 * Quasar Pinia root: registers persisted state for stores that opt in (e.g. game timer).
 */
import { defineStore } from '#q-app/wrappers'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

export default defineStore((/* { ssrContext } */) => {
  const pinia = createPinia()

  pinia.use(piniaPluginPersistedstate)

  return pinia
})
