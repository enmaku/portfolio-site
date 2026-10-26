import {
  FAVICON_IDS,
  appIconPath,
  getInstallableAppForPath,
  getShareEntryForPath,
  SHARE_SITE_NAME,
} from '../share-metadata.js'
import { portfolioDocumentTitle } from './routes.js'

const faviconIdSet = new Set(FAVICON_IDS)

/**
 * @param {string | undefined} raw
 * @returns {string}
 */
export function resolveRouteFaviconId(raw) {
  return typeof raw === 'string' && faviconIdSet.has(raw) ? raw : 'default'
}

/**
 * @param {string} faviconId
 */
function applyFavicon(faviconId) {
  if (typeof document === 'undefined') return
  const id = resolveRouteFaviconId(faviconId)
  const href = `icons/favicon-${id}.svg`
  const el = document.getElementById('portfolio-favicon')
  if (el?.getAttribute?.('href') !== href) {
    el?.setAttribute?.('href', href)
  }
}

/**
 * The document URL stays at the site root during hash navigation, so the
 * manifest link has to follow the active route rather than the initial page.
 * @param {import('../share-metadata.js').InstallableApp | null} app
 */
function applyInstallChrome(app) {
  if (typeof document === 'undefined') return
  const head = document.head
  if (!app) {
    document.getElementById('portfolio-manifest')?.remove?.()
    document.getElementById('portfolio-apple-touch-icon')?.remove?.()
    return
  }

  const manifestEl = ensureLink('portfolio-manifest', 'manifest', head)
  if (manifestEl?.getAttribute?.('href') !== app.manifestHref) {
    manifestEl?.setAttribute?.('href', app.manifestHref)
  }

  const iconHref = appIconPath(app.iconId, 192)
  const appleIconEl = ensureLink('portfolio-apple-touch-icon', 'apple-touch-icon', head)
  if (appleIconEl?.getAttribute?.('href') !== iconHref) {
    appleIconEl?.setAttribute?.('href', iconHref)
  }
}

/**
 * @param {string} id
 * @param {string} rel
 * @param {HTMLElement | null} head
 */
function ensureLink(id, rel, head) {
  const existing = document.getElementById(id)
  if (existing) return existing
  if (!head?.appendChild || typeof document.createElement !== 'function') return null
  const el = document.createElement('link')
  el.id = id
  el.rel = rel
  head.appendChild(el)
  return el
}

/**
 * @param {import('../share-metadata.js').ShareCatalogEntry} entry
 */
function applySharePreviewTags(entry) {
  if (typeof document === 'undefined' || !entry.pasteUnfurl) return
  const canonicalUrl = `${window.location.origin}${entry.routePath}`

  setMetaContent('name', 'description', entry.description)
  setMetaContent('property', 'og:site_name', SHARE_SITE_NAME)
  setMetaContent('property', 'og:title', entry.title)
  setMetaContent('property', 'og:description', entry.description)
  setMetaContent('property', 'og:image', entry.ogImage)
  setMetaContent('property', 'og:url', canonicalUrl)
  setMetaContent('name', 'twitter:title', entry.title)
  setMetaContent('name', 'twitter:description', entry.description)
  setMetaContent('name', 'twitter:image', entry.ogImage)
  setCanonicalHref(canonicalUrl)
}

/**
 * @param {'name' | 'property'} attr
 * @param {string} key
 * @param {string} value
 */
function setMetaContent(attr, key, value) {
  const selector = `meta[${attr}="${key}"]`
  const el = document.querySelector(selector)
  el?.setAttribute?.('content', value)
}

/** @param {string} href */
function setCanonicalHref(href) {
  const el = document.querySelector('link[rel="canonical"]')
  el?.setAttribute?.('href', href)
}

/**
 * @param {Pick<import('vue-router').RouteLocationNormalized, 'path'>} to
 */
export function applyRouteDocumentChrome(to) {
  if (typeof document === 'undefined') return
  const entry = getShareEntryForPath(to.path)
  if (entry) {
    document.title = entry.title
    applyFavicon(entry.favicon)
    applyInstallChrome(getInstallableAppForPath(to.path))
    applySharePreviewTags(entry)
    return
  }
  document.title = portfolioDocumentTitle
  applyFavicon('default')
  applyInstallChrome(null)
}
