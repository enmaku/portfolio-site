import assert from 'node:assert/strict'
import test from 'node:test'
import { FAVICON_IDS, getShareEntryForPath } from '../share-metadata.js'
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

/** @returns {{ document: Document, favicon: HTMLLinkElement, metas: Map<string, HTMLMetaElement> }} */
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

  const documentStub = {
    title: '',
    getElementById(id) {
      return id === 'portfolio-favicon' ? favicon : null
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

  return { document: documentStub, favicon, metas }
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
  assert.equal(favicon.href, `icons/favicon-${entry.favicon}.svg`)
})

test('applyRouteDocumentChrome sets catalog title and favicon for known paths', () => {
  const { document, favicon } = installDocumentStub()
  const entry = getShareEntryForPath('/about')
  assert.ok(entry)

  applyRouteDocumentChrome({ path: '/about' })

  assert.equal(document.title, entry.title)
  assert.equal(favicon.href, `icons/favicon-${entry.favicon}.svg`)
})

test('applyRouteDocumentChrome syncs OG tags for catalog paths', () => {
  const { metas } = installDocumentStub()
  const entry = getShareEntryForPath('/projects/game-timer')
  assert.ok(entry)

  applyRouteDocumentChrome({ path: '/projects/game-timer' })

  assert.equal(metas.get('property:og:title')?.content, entry.title)
  assert.equal(metas.get('name:twitter:image')?.content, entry.ogImage)
})

test('applyRouteDocumentChrome uses site defaults for unknown paths', () => {
  const { document, favicon, metas } = installDocumentStub()
  const ogTitleBefore = metas.get('property:og:title')?.content

  applyRouteDocumentChrome({ path: '/does-not-exist' })

  assert.equal(document.title, portfolioDocumentTitle)
  assert.equal(favicon.href, 'icons/favicon-default.svg')
  assert.equal(metas.get('property:og:title')?.content, ogTitleBefore)
})
