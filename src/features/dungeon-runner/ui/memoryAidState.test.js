import assert from 'node:assert/strict'
import test from 'node:test'
import { createMemoryAidState, setMemoryAidEnabled, tapDeck, closeDeckSplay } from './memoryAidState.js'

test('memory aid starts disabled by default', () => {
  const state = createMemoryAidState()
  assert.equal(state.enabled, false)
  assert.equal(state.deckSplayOpen, false)
})

test('deck tap is gated off when memory aid is disabled', () => {
  const state = tapDeck(createMemoryAidState({ enabled: false, deckSplayOpen: false }))
  assert.equal(state.deckSplayOpen, false)
})

test('memory aid toggle has immediate on/off deck splay effect', () => {
  const enabled = setMemoryAidEnabled(createMemoryAidState(), true)
  const opened = tapDeck(enabled)
  assert.equal(opened.deckSplayOpen, true)

  const disabled = setMemoryAidEnabled(opened, false)
  assert.equal(disabled.deckSplayOpen, false)

  const reopened = tapDeck(disabled)
  assert.equal(reopened.deckSplayOpen, false)
})

test('deck splay can be closed while memory aid remains enabled', () => {
  const opened = tapDeck(createMemoryAidState({ enabled: true, deckSplayOpen: false }))
  const closed = closeDeckSplay(opened)
  assert.equal(closed.enabled, true)
  assert.equal(closed.deckSplayOpen, false)
})
