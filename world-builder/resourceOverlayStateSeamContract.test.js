import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const worldBuilderPagePath = join(repoRoot, 'src/pages/projects/WorldBuilderPage.vue')

test('WorldBuilderPage does not call setResourceOverlayVisibility on the viewport directly', () => {
  const source = readFileSync(worldBuilderPagePath, 'utf8')
  assert.ok(
    !/\.setResourceOverlayVisibility\s*\(/.test(source),
    'page must route overlay visibility through resourceOverlayState commit/sync only',
  )
})

test('WorldBuilderPage commits overlay mutations through resourceOverlayState', () => {
  const source = readFileSync(worldBuilderPagePath, 'utf8')
  assert.ok(source.includes('commitResourceOverlayState'))
})

test('WorldBuilderPage does not call syncResourceOverlayStateToViewport directly', () => {
  const source = readFileSync(worldBuilderPagePath, 'utf8')
  assert.ok(
    !source.includes('syncResourceOverlayStateToViewport'),
    'page must project overlay state through commitResourceOverlayState only',
  )
})

test('WorldBuilderPage reads overlay display settings from canonical page state', () => {
  const source = readFileSync(worldBuilderPagePath, 'utf8')
  assert.ok(
    source.includes('resourceOverlayState.value.displaySettings'),
    'page must read overlay display settings from resourceOverlayState owner',
  )
  assert.ok(
    !/overlayDisplaySettings\.value\[[^\]]+\]/.test(source),
    'page must not read overlay display settings directly from Pinia',
  )
})

test('WorldBuilderPage routes toggle, slider, reset, and defaults through commitResourceOverlayState', () => {
  const source = readFileSync(worldBuilderPagePath, 'utf8')
  const commitBlocks = source.match(/commitResourceOverlayState\([\s\S]*?\)/g) ?? []
  assert.ok(commitBlocks.length >= 5, 'expected commit on toggle, slider, reset, defaults, and viewport-ready sync')
  assert.match(source, /function onResourceOverlayToggle[\s\S]*?commitResourceOverlayState/)
  assert.match(source, /function onOverlaySliderChange[\s\S]*?commitResourceOverlayState/)
  assert.match(source, /function resetResourceOverlayVisibility[\s\S]*?commitResourceOverlayState/)
  assert.match(source, /function resetToDefaults[\s\S]*?commitResourceOverlayState/)
  assert.match(source, /function syncResourceOverlayVisibilityToMapViewport[\s\S]*?commitResourceOverlayState/)
})
