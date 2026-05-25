/**
 * Quasar Pinia root: registers persisted state for stores that opt in (e.g. game timer).
 */
import { defineStore } from '#q-app/wrappers'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { gameTimerP2PPlugin } from '../features/game-timer/p2p/gameTimerPiniaBridge.js'
import { movieVoteP2PPlugin } from '../features/movie-vote/p2p/movieVotePiniaBridge.js'

export default defineStore((/* { ssrContext } */) => {
  const pinia = createPinia()

  pinia.use(piniaPluginPersistedstate)
  pinia.use(gameTimerP2PPlugin)
  pinia.use(movieVoteP2PPlugin)

  return pinia
})
