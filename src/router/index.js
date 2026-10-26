/**
 * Vue Router factory (Quasar wrapper). History mode follows `VUE_ROUTER_MODE` / SSR env.
 */
import { defineRouter } from '#q-app/wrappers'
import { createRouter, createMemoryHistory, createWebHistory } from 'vue-router'
import routes from './routes'
import { applyRouteDocumentChrome } from './routeDocumentChrome.js'
import { migrateHashUrl } from '../features/share/legacyHashRedirect.js'

export default defineRouter(function (/* { store, ssrContext } */) {
  migrateHashUrl()

  const createHistory = process.env.SERVER ? createMemoryHistory : createWebHistory

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE),
  })

  Router.afterEach((to) => {
    applyRouteDocumentChrome(to)
  })

  return Router
})
