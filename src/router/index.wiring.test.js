import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const routerIndexSource = readFileSync(new URL('./index.js', import.meta.url), 'utf8')

test('router index wires path-keyed document chrome on navigation', () => {
  assert.match(routerIndexSource, /applyRouteDocumentChrome/)
  assert.match(routerIndexSource, /Router\.afterEach\(\(to\) => \{[\s\S]*applyRouteDocumentChrome\(to\)/)
})

test('router index does not use route meta share keys or legacy appliers', () => {
  assert.equal(routerIndexSource.includes('shareKey'), false)
  assert.equal(routerIndexSource.includes('to.meta.title'), false)
  assert.equal(routerIndexSource.includes('SHARE_METADATA'), false)
  assert.equal(routerIndexSource.includes('applyRouteSharePreview'), false)
  assert.equal(routerIndexSource.includes('applyRouteFavicon'), false)
})
