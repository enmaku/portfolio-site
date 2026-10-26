import assert from 'node:assert/strict'
import test from 'node:test'
import { buildShareHtml } from './sharePageHtml.js'

test('buildShareHtml sets canonical tags and preserves query on redirect', () => {
  const baseHtml = `<!doctype html><html><head><title>Old</title></head><body></body></html>`
  const entry = {
    title: 'Game Timer',
    description: 'desc',
    routePath: '/projects/game-timer',
    shareSlug: 'projects/game-timer',
    ogImage: 'icons/social/game-timer.png',
  }

  const html = buildShareHtml(baseHtml, entry, {
    siteOrigin: 'https://focusdisorder.com',
    pagesBase: '/',
    siteName: 'Focus Disorder',
  })

  assert.match(html, /<meta property="og:url" content="https:\/\/focusdisorder\.com\/projects\/game-timer"/)
  assert.match(html, /<link rel="canonical" href="https:\/\/focusdisorder\.com\/projects\/game-timer"/)
  assert.match(html, /<meta property="og:site_name" content="Focus Disorder"/)
  assert.match(html, /URLSearchParams\(window\.location\.search\)/)
  assert.match(html, /window\.location\.replace\(target\)/)
})

test('buildShareHtml links the app manifest and apple touch icon for installable apps', () => {
  const baseHtml = `<!doctype html><html><head><title>Old</title></head><body></body></html>`
  const entry = {
    title: 'Game Timer',
    description: 'desc',
    routePath: '/projects/game-timer',
    shareSlug: 'projects/game-timer',
    ogImage: 'icons/social/game-timer.png',
  }

  const html = buildShareHtml(baseHtml, entry, {
    siteOrigin: 'https://focusdisorder.com',
    pagesBase: '/',
    siteName: 'Focus Disorder',
  })

  assert.match(
    html,
    /<link id="portfolio-manifest" rel="manifest" href="\.\.\/\.\.\/manifests\/timer\.webmanifest"/,
  )
  assert.match(
    html,
    /<link id="portfolio-apple-touch-icon" rel="apple-touch-icon" href="\.\.\/\.\.\/icons\/apps\/timer-192\.png"/,
  )
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="Game Timer"/)
})

test('buildShareHtml omits install links for non-installable routes', () => {
  const baseHtml = `<!doctype html><html><head><title>Old</title></head><body></body></html>`
  const entry = {
    title: 'About',
    description: 'desc',
    routePath: '/about',
    shareSlug: 'about',
    ogImage: 'icons/favicon-info.svg',
  }

  const html = buildShareHtml(baseHtml, entry, {
    siteOrigin: 'https://focusdisorder.com',
    pagesBase: '/',
    siteName: 'Focus Disorder',
  })

  assert.doesNotMatch(html, /rel="manifest"/)
  assert.doesNotMatch(html, /apple-touch-icon/)
})
