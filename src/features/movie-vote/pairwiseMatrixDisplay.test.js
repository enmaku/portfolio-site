/**
 * Run: node --test src/features/movie-vote/pairwiseMatrixDisplay.test.js
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  pairwiseCellAriaLabel,
  pairwiseCellCssClass,
  pairwiseCellGlyph,
} from './pairwiseMatrixDisplay.js'

test('pairwiseCellGlyph: win loss tie and unknown', () => {
  assert.equal(pairwiseCellGlyph('win'), '✓')
  assert.equal(pairwiseCellGlyph('loss'), '✗')
  assert.equal(pairwiseCellGlyph('tie'), '=')
  assert.equal(pairwiseCellGlyph(undefined), '·')
})

test('pairwiseCellCssClass: diagonal and outcome modifiers', () => {
  const cells = { a: { b: 'win' }, b: { a: 'loss' } }
  assert.equal(pairwiseCellCssClass('a', 'a', cells), 'mv-pairwise__cell--diag')
  assert.equal(pairwiseCellCssClass('a', 'b', cells), 'mv-pairwise__cell--win')
  assert.equal(pairwiseCellCssClass('b', 'a', cells), 'mv-pairwise__cell--loss')
  assert.equal(pairwiseCellCssClass('a', 'c', cells), '')
})

test('pairwiseCellAriaLabel: head-to-head copy from row perspective', () => {
  assert.equal(pairwiseCellAriaLabel('Alpha', 'Beta', 'win'), 'Alpha beats Beta head-to-head')
  assert.equal(pairwiseCellAriaLabel('Alpha', 'Beta', 'loss'), 'Alpha loses to Beta head-to-head')
  assert.equal(pairwiseCellAriaLabel('Alpha', 'Beta', 'tie'), 'Alpha tied with Beta head-to-head')
  assert.equal(pairwiseCellAriaLabel('Alpha', 'Beta', undefined), 'Alpha vs Beta')
})
