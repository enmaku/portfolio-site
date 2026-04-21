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
import { SHARE_METADATA } from '../share-metadata.js'

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

/**
 * Keeps description + OG/Twitter tags aligned as users navigate within the SPA.
 * Crawlers still read the per-route HTML emitted by `scripts/generate-share-pages.mjs`,
 * this just prevents drift for users who already have the page open.
 *
 * @param {import('vue-router').RouteLocationNormalized} to
 */
function applyRouteSharePreview(to) {
  if (typeof document === 'undefined') return
  const key = typeof to.meta.shareKey === 'string' ? to.meta.shareKey : null
  const entry = key ? SHARE_METADATA[key] : null
  if (!entry) return

  setMetaContent('name', 'description', entry.description)
  setMetaContent('property', 'og:title', entry.title)
  setMetaContent('property', 'og:description', entry.description)
  setMetaContent('name', 'twitter:title', entry.title)
  setMetaContent('name', 'twitter:description', entry.description)
}

/**
 * @param {'name' | 'property'} attr
 * @param {string} key
 * @param {string} value
 */
function setMetaContent(attr, key, value) {
  const selector = `meta[${attr}="${key}"]`
  const el = document.querySelector(selector)
  if (el instanceof HTMLMetaElement) {
    el.setAttribute('content', value)
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
    applyRouteSharePreview(to)
  })

  return Router
})
