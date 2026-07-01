import assert from 'node:assert/strict'
import test from 'node:test'
import { createResourceOverlayPageState } from '../resourceOverlayState.js'
import { diffResourceOverlayMapLayers } from './diffResourceOverlayMapLayers.js'

/**
 * @param {Partial<Record<string, boolean>>} visibility
 * @param {number} [arableMinimumProductivity]
 */
function overlayState(visibility, arableMinimumProductivity) {
  const state = createResourceOverlayPageState(
    arableMinimumProductivity === undefined
      ? undefined
      : { arableMinimumProductivity },
  )
  state.visibility = { ...state.visibility, ...visibility }
  return state
}

test('toggling timber visibility changes only the timber raster layer', () => {
  assert.deepStrictEqual(
    diffResourceOverlayMapLayers(overlayState({}), overlayState({ timber: true })),
    ['timber'],
  )
})

test('toggling metals visibility changes the metals raster and metalNodes layer', () => {
  const changed = diffResourceOverlayMapLayers(overlayState({}), overlayState({ metals: true }))
  assert.deepStrictEqual(new Set(changed), new Set(['metals', 'metalNodes']))
})

test('toggling salt visibility changes only the saltNodes layer', () => {
  assert.deepStrictEqual(
    diffResourceOverlayMapLayers(overlayState({}), overlayState({ salt: true })),
    ['saltNodes'],
  )
})

test('toggling arable visibility changes only the arable raster layer', () => {
  assert.deepStrictEqual(
    diffResourceOverlayMapLayers(overlayState({}), overlayState({ arable: true })),
    ['arable'],
  )
})

test('changing the arable envelope threshold changes only the arable raster layer', () => {
  assert.deepStrictEqual(
    diffResourceOverlayMapLayers(overlayState({}, 0.25), overlayState({}, 0.6)),
    ['arable'],
  )
})

test('an unchanged overlay commit changes no layers', () => {
  assert.deepStrictEqual(
    diffResourceOverlayMapLayers(overlayState({ timber: true }, 0.4), overlayState({ timber: true }, 0.4)),
    [],
  )
})

test('independent overlay changes union into the affected layers only', () => {
  const changed = diffResourceOverlayMapLayers(
    overlayState({ timber: true }, 0.25),
    overlayState({ timber: true, salt: true }, 0.6),
  )
  assert.deepStrictEqual(new Set(changed), new Set(['saltNodes', 'arable']))
})
