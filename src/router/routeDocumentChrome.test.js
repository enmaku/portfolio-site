import assert from 'node:assert/strict'
import test from 'node:test'
import { FAVICON_IDS, INSTALLABLE_APPS, getShareEntryForPath } from '../share-metadata.js'
import { portfolioDocumentTitle } from './routes.js'
import {
  applyRouteDocumentChrome,
  resolveRouteFaviconId,
} from './routeDocumentChrome.js'

test('resolveRouteFaviconId accepts catalog ids and falls back to default', () => {
  for (const id of FAVICON_IDS) {
    assert.equal(resolveRouteFaviconId(id), id)
  }
  assert.equal(resolveRouteFaviconId('not-a-favicon'), 'default')
  assert.equal(resolveRouteFaviconId(undefined), 'default')
})

/** @returns {{ document: Document, favicon: HTMLLinkElement, metas: Map<string, HTMLMetaElement>, head: { children: any[] } }} */
function installDocumentStub() {
  /** @type {Map<string, HTMLMetaElement>} */
  const metas = new Map()
  const favicon = {
    tagName: 'LINK',
    href: 'icons/favicon-default.svg',
    getAttribute(name) {
      return name === 'href' ? this.href : null
    },
    setAttribute(name, value) {
      if (name === 'href') this.href = value
    },
  }

  /** @type {any[]} */
  const headChildren = []
  /** @type {Map<string, any>} */
  const linksById = new Map()

  const documentStub = {
    title: '',
    head: {
      appendChild(el) {
        headChildren.push(el)
        if (el.id) linksById.set(el.id, el)
      },
    },
    createElement(tagName) {
      return {
        tagName: tagName.toUpperCase(),
        id: '',
        rel: '',
        removed: false,
        _href: '',
        get href() {
          return this._href
        },
        set href(value) {
          this._href = value
        },
        getAttribute(name) {
          if (name === 'href') return this._href
          if (name === 'rel') return this.rel
          return null
        },
        setAttribute(name, value) {
          if (name === 'href') this._href = value
          if (name === 'rel') this.rel = value
        },
        remove() {
          this.removed = true
          if (this.id) linksById.delete(this.id)
          const idx = headChildren.indexOf(this)
          if (idx >= 0) headChildren.splice(idx, 1)
        },
      }
    },
    getElementById(id) {
      if (id === 'portfolio-favicon') return favicon
      return linksById.get(id) ?? null
    },
    querySelector(selector) {
      const metaMatch = selector.match(/^meta\[(name|property)="([^"]+)"\]$/)
      if (metaMatch) {
        const [, attr, key] = metaMatch
        return metas.get(`${attr}:${key}`) ?? null
      }
      if (selector === 'link[rel="canonical"]') {
        return metas.get('link:canonical') ?? null
      }
      return null
    },
  }

  for (const [attr, key] of [
    ['name', 'description'],
    ['property', 'og:site_name'],
    ['property', 'og:title'],
    ['property', 'og:description'],
    ['property', 'og:image'],
    ['property', 'og:url'],
    ['name', 'twitter:title'],
    ['name', 'twitter:description'],
    ['name', 'twitter:image'],
  ]) {
    const el = {
      tagName: 'META',
      content: '',
      setAttribute(name, value) {
        if (name === 'content') this.content = value
      },
    }
    metas.set(`${attr}:${key}`, el)
  }

  const canonical = {
    tagName: 'LINK',
    href: '',
    setAttribute(name, value) {
      if (name === 'href') this.href = value
    },
  }
  metas.set('link:canonical', canonical)

  // @ts-expect-error test stub
  globalThis.document = documentStub
  globalThis.window = { location: { origin: 'https://example.test' } }

  return { document: documentStub, favicon, metas, head: { children: headChildren } }
}

test.afterEach(() => {
  // @ts-expect-error cleanup
  delete globalThis.document
  // @ts-expect-error cleanup
  delete globalThis.window
})

test('applyRouteDocumentChrome applies home catalog row', () => {
  const { document, favicon } = installDocumentStub()
  const entry = getShareEntryForPath('/')
  assert.ok(entry)

  applyRouteDocumentChrome({ path: '/' })

  assert.equal(document.title, entry.title)
  assert.equal(favicon.href, `/icons/favicon-${entry.favicon}.svg`)
})

test('applyRouteDocumentChrome sets catalog title and favicon for known paths', () => {
  const { document, favicon } = installDocumentStub()
  const entry = getShareEntryForPath('/about')
  assert.ok(entry)

  applyRouteDocumentChrome({ path: '/about' })

  assert.equal(document.title, entry.title)
  assert.equal(favicon.href, `/icons/favicon-${entry.favicon}.svg`)
})

test('applyRouteDocumentChrome syncs OG tags for catalog paths', () => {
  const { metas } = installDocumentStub()
  const entry = getShareEntryForPath('/projects/game-timer')
  assert.ok(entry)

  applyRouteDocumentChrome({ path: '/projects/game-timer' })

  assert.equal(metas.get('property:og:title')?.content, entry.title)
  assert.equal(metas.get('name:twitter:image')?.content, `https://example.test/${entry.ogImage}`)
  assert.equal(
    metas.get('property:og:url')?.content,
    'https://example.test/projects/game-timer',
  )
})

test('applyRouteDocumentChrome uses site defaults for unknown paths', () => {
  const { document, favicon, metas } = installDocumentStub()
  const ogTitleBefore = metas.get('property:og:title')?.content

  applyRouteDocumentChrome({ path: '/does-not-exist' })

  assert.equal(document.title, portfolioDocumentTitle)
  assert.equal(favicon.href, '/icons/favicon-default.svg')
  assert.equal(metas.get('property:og:title')?.content, ogTitleBefore)
})

test('applyRouteDocumentChrome points the manifest link at the active app', () => {
  const { head } = installDocumentStub()

  for (const app of INSTALLABLE_APPS) {
    applyRouteDocumentChrome({ path: app.routePath })

    const manifest = head.children.find((el) => el.id === 'portfolio-manifest')
    const appleIcon = head.children.find((el) => el.id === 'portfolio-apple-touch-icon')
    assert.equal(manifest?.href, `/${app.manifestHref}`)
    assert.equal(appleIcon?.href, `/icons/apps/${app.iconId}-192.png`)
  }

  const manifestIds = head.children
    .filter((el) => el.id === 'portfolio-manifest')
    .map((el) => el.href)
  assert.equal(manifestIds.length, 1, 'manifest link should be reused, not duplicated')
})

test('applyRouteDocumentChrome drops install links outside installable apps', () => {
  const { head } = installDocumentStub()

  applyRouteDocumentChrome({ path: '/projects/game-timer' })
  assert.ok(head.children.some((el) => el.id === 'portfolio-manifest'))

  applyRouteDocumentChrome({ path: '/projects/world-builder' })
  assert.equal(head.children.some((el) => el.id === 'portfolio-manifest'), false)
  assert.equal(head.children.some((el) => el.id === 'portfolio-apple-touch-icon'), false)
})
