/**
 * Vue Router factory (Quasar wrapper). History mode follows `VUE_ROUTER_MODE` / SSR env.
 */
import { defineRouter } from '#q-app/wrappers'
import {
  createRouter,
  createMemoryHistory,
  createWebHistory,
  createWebHashHistory,
} from 'vue-router'
import routes, { portfolioDocumentTitle } from './routes'

const FAVICON_IDS = new Set(['default', 'photo', 'info', 'timer', 'movie'])

/**
 * @param {import('vue-router').RouteLocationNormalized} to
 */
function applyRouteFavicon(to) {
  if (typeof document === 'undefined') return
  const raw = to.meta.favicon
  const id = typeof raw === 'string' && FAVICON_IDS.has(raw) ? raw : 'default'
  const href = `icons/favicon-${id}.svg`
  const el = document.getElementById('portfolio-favicon')
  if (el instanceof HTMLLinkElement && el.getAttribute('href') !== href) {
    el.setAttribute('href', href)
  }
}

export default defineRouter(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : process.env.VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE),
  })

  Router.afterEach((to) => {
    const title = to.meta.title
    document.title = typeof title === 'string' ? title : portfolioDocumentTitle
    applyRouteFavicon(to)
  })

  return Router
})
