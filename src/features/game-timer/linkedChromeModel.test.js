import assert from 'node:assert/strict'
import test from 'node:test'
import { getManagerLinkedChromeModel } from './linkedChromeModel.js'

test('standalone host keeps settings cog and top-bar new game when shuffle unavailable', () => {
  const model = getManagerLinkedChromeModel({
    isManagerLinked: false,
    isGuest: false,
    canShuffle: false,
    hasPlayers: true,
  })
  assert.equal(model.showMoreOptions, false)
  assert.equal(model.showSettingsCog, true)
  assert.equal(model.showTopBarNewGame, true)
  assert.equal(model.showTopBarShuffle, false)
  assert.equal(model.hideAddClearFabs, false)
  assert.equal(model.showGameEnd, false)
})

test('linked host shows more options kebab and hides fabs and top-bar new game', () => {
  const model = getManagerLinkedChromeModel({
    isManagerLinked: true,
    isGuest: false,
    canShuffle: false,
    hasPlayers: true,
  })
  assert.equal(model.showMoreOptions, true)
  assert.equal(model.showSettingsCog, false)
  assert.equal(model.showTopBarNewGame, false)
  assert.equal(model.hideAddClearFabs, true)
  assert.equal(model.showGameEnd, true)
})

test('linked host puts shuffle in more options instead of top bar', () => {
  const model = getManagerLinkedChromeModel({
    isManagerLinked: true,
    isGuest: false,
    canShuffle: true,
    hasPlayers: true,
  })
  assert.equal(model.showTopBarShuffle, false)
  assert.equal(model.showMoreOptionsShuffle, true)
  assert.equal(model.showTopBarNewGame, false)
})

test('standalone host keeps top-bar shuffle when eligible', () => {
  const model = getManagerLinkedChromeModel({
    isManagerLinked: false,
    isGuest: false,
    canShuffle: true,
    hasPlayers: true,
  })
  assert.equal(model.showTopBarShuffle, true)
  assert.equal(model.showMoreOptionsShuffle, false)
  assert.equal(model.showTopBarNewGame, false)
})

test('linked guest keeps settings cog and has no more options', () => {
  const model = getManagerLinkedChromeModel({
    isManagerLinked: true,
    isGuest: true,
    canShuffle: false,
    hasPlayers: true,
  })
  assert.equal(model.showMoreOptions, false)
  assert.equal(model.showSettingsCog, true)
  assert.equal(model.showGameEnd, false)
  assert.equal(model.hideAddClearFabs, true)
})
