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
