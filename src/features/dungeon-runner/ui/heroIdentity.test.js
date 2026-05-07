import assert from 'node:assert/strict'
import test from 'node:test'
import { getHeroIdentity } from './heroIdentity.js'

test('getHeroIdentity maps each hero to cue tokens and compact badge glyph', () => {
  const mage = getHeroIdentity('MAGE')
  assert.equal(mage.hero, 'MAGE')
  assert.equal(mage.accentClass, 'dr-hero--mage')
  assert.equal(mage.badgeColor, 'deep-purple')
  assert.equal(mage.buttonColor, 'deep-purple')
  assert.equal(mage.badgeGlyph, 'M')
  assert.equal(mage.shortLabel, 'Mage')

  const warrior = getHeroIdentity('WARRIOR')
  assert.equal(warrior.buttonColor, warrior.badgeColor)
  assert.equal(warrior.badgeGlyph, 'W')
})

test('getHeroIdentity defaults unknown or missing hero to warrior', () => {
  assert.equal(getHeroIdentity(null).hero, 'WARRIOR')
  assert.equal(getHeroIdentity(undefined).hero, 'WARRIOR')
  assert.equal(getHeroIdentity('').hero, 'WARRIOR')
})
