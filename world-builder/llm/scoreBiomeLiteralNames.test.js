import assert from 'node:assert/strict'
import test from 'node:test'
import {
  scoreBiomeLiteralNames,
  matchingStems,
} from './scoreBiomeLiteralNames.js'

test('flags taiga/scrub calques and own-biome echoes', () => {
  const score = scoreBiomeLiteralNames({
    settlements: {
      a: 'Taigaport',
      b: 'Scrubwatch',
      c: 'Marrowby',
      d: 'Port Calum',
      e: 'Frosthold',
    },
    biomeBySettlementId: {
      a: 'Taiga',
      b: 'Scrub',
      c: 'Coast',
      d: 'Coast',
      e: 'Tundra',
    },
  })
  assert.equal(score.total, 5)
  assert.ok(score.calqueCount >= 3)
  assert.ok(score.ownBiomeEchoCount >= 2)
  assert.ok(matchingStems('Copperhollow').includes('copper'))
  assert.equal(matchingStems('Marrowby').length, 0)
})
