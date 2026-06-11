/**
 * Run: node --test src/features/movie-vote/election.test.js
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { runBaldwin } from './baldwin.js'
import { runBorda } from './borda.js'
import { runDowdall } from './dowdall.js'
import { runCondorcet } from './condorcet.js'
import { runCopeland } from './copeland.js'
import { runCoombs } from './coombs.js'
import { isDeclaredElectionTie, runElection } from './election.js'
import { runIrv } from './irv.js'

test('runElection dispatches IRV and echoes votingMethod', () => {
  const r = runElection('irv', [['a', 'b'], ['a', 'b']], ['a', 'b'])
  assert.equal(r.votingMethod, 'irv')
  assert.equal(r.winnerId, 'a')
  assert.equal(r.tieWinnerIds, null)
  assert.ok(r.rounds.length >= 1)
  assert.ok('firstPreferenceCounts' in r.rounds[0])
})

test('runElection normalizes unknown method string to IRV', () => {
  const r = runElection('ranked-points', [['x', 'y'], ['x', 'y']], ['x', 'y'])
  assert.equal(r.votingMethod, 'irv')
  assert.equal(r.winnerId, 'x')
})

test('runElection: borda dispatches and echoes votingMethod', () => {
  const r = runElection('borda', [['a', 'b'], ['b', 'a']], ['a', 'b'])
  assert.equal(r.votingMethod, 'borda')
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(r.rounds.length, 1)
  assert.equal(r.rounds[0].eliminatedIds.length, 0)
})

test('runElection: borda unique winner', () => {
  const r = runElection(
    'borda',
    [
      ['a', 'b'],
      ['a', 'b'],
    ],
    ['a', 'b'],
  )
  assert.equal(r.winnerId, 'a')
  assert.equal(r.tieWinnerIds, null)
  assert.equal(r.rounds[0].firstPreferenceCounts.a, 2)
})

test('runElection: condorcet dispatches with pairwise matrix', () => {
  const rankings = [
    ['a', 'b'],
    ['b', 'a'],
  ]
  const r = runElection('condorcet', rankings, ['a', 'b'])
  assert.equal(r.votingMethod, 'condorcet')
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(r.rounds.length, 0)
  assert.equal(r.pairwiseMatrix?.cells.a.b, 'tie')
})

test('runElection: copeland dispatches with matrix and scores', () => {
  const rankings = [
    ['a', 'b'],
    ['b', 'a'],
  ]
  const r = runElection('copeland', rankings, ['a', 'b'])
  assert.equal(r.votingMethod, 'copeland')
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(r.pairwiseMatrix?.cells.a.b, 'tie')
  assert.equal(r.copelandScores?.a, 0)
})

test('runElection: copeland vs condorcet — Smith set wider than Copeland leaders', () => {
  const rankings = [
    ['a', 'b', 'c', 'd'],
    ['a', 'b', 'c', 'd'],
    ['b', 'c', 'd', 'a'],
    ['c', 'd', 'a', 'b'],
    ['d', 'a', 'b', 'c'],
  ]
  const ids = ['a', 'b', 'c', 'd']
  const cond = runElection('condorcet', rankings, ids)
  const cop = runElection('copeland', rankings, ids)
  assert.equal(cond.votingMethod, 'condorcet')
  assert.equal(cop.votingMethod, 'copeland')
  assert.deepEqual(new Set(cond.tieWinnerIds ?? []), new Set(ids))
  assert.deepEqual(new Set(cop.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(cop.copelandScores?.a, 1)
})

test('runElection copeland matches runCopeland and adds votingMethod', () => {
  const rankings = [
    ['a', 'b', 'c'],
    ['a', 'c', 'b'],
    ['b', 'a', 'c'],
  ]
  const ids = ['a', 'b', 'c']
  const cop = runCopeland(rankings, ids)
  const elect = runElection('copeland', rankings, ids)
  assert.deepEqual(elect, { ...cop, votingMethod: 'copeland' })
})

test('runElection condorcet matches runCondorcet and adds votingMethod', () => {
  const rankings = [
    ['a', 'b', 'c'],
    ['b', 'c', 'a'],
    ['c', 'a', 'b'],
  ]
  const ids = ['a', 'b', 'c']
  const cond = runCondorcet(rankings, ids)
  const elect = runElection('condorcet', rankings, ids)
  assert.deepEqual(elect, { ...cond, votingMethod: 'condorcet' })
})

test('isDeclaredElectionTie matches tieWinnerIds shape', () => {
  assert.equal(isDeclaredElectionTie(null), false)
  assert.equal(isDeclaredElectionTie(undefined), false)
  assert.equal(isDeclaredElectionTie({ tieWinnerIds: ['a'], winnerId: null, rounds: [] }), true)
  assert.equal(isDeclaredElectionTie({ tieWinnerIds: [], winnerId: null, rounds: [] }), false)
  assert.equal(isDeclaredElectionTie({ tieWinnerIds: null, winnerId: 'a', rounds: [] }), false)
  assert.equal(isDeclaredElectionTie({ tieWinnerIds: ['a', 'b'], winnerId: null, rounds: [] }), true)
})

test('runElection irv matches runIrv and adds votingMethod', () => {
  const rankings = [
    ['a', 'b', 'c', 'd'],
    ['a', 'b', 'c', 'd'],
    ['b', 'a', 'c', 'd'],
    ['c', 'a', 'b', 'd'],
    ['d', 'a', 'b', 'c'],
  ]
  const ids = ['a', 'b', 'c', 'd']
  const irv = runIrv(rankings, ids)
  const elect = runElection('irv', rankings, ids)
  assert.deepEqual(elect, { ...irv, votingMethod: 'irv' })
  assert.deepEqual(new Set(elect.rounds[0].eliminatedIds), new Set(['b', 'c', 'd']))
})

test('runElection borda matches runBorda and adds votingMethod', () => {
  const rankings = [
    ['a', 'b'],
    ['a', 'b'],
  ]
  const ids = ['a', 'b']
  const borda = runBorda(rankings, ids)
  const elect = runElection('borda', rankings, ids)
  assert.deepEqual(elect, { ...borda, votingMethod: 'borda' })
})

test('runElection: dowdall dispatches and echoes votingMethod', () => {
  const r = runElection('dowdall', [['a', 'b'], ['b', 'a']], ['a', 'b'])
  assert.equal(r.votingMethod, 'dowdall')
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(r.rounds.length, 1)
})

test('runElection: dowdall harmonic totals differ from Borda on same rankings', () => {
  const rankings = [['a', 'b', 'c']]
  const ids = ['a', 'b', 'c']
  const dowdall = runElection('dowdall', rankings, ids)
  const borda = runElection('borda', rankings, ids)
  assert.notDeepEqual(
    dowdall.rounds[0]?.firstPreferenceCounts,
    borda.rounds[0]?.firstPreferenceCounts,
  )
  assert.equal(dowdall.rounds[0]?.firstPreferenceCounts?.a, 1)
  assert.equal(borda.rounds[0]?.firstPreferenceCounts?.a, 2)
})

test('runElection: dowdall unique winner', () => {
  const r = runElection(
    'dowdall',
    [
      ['a', 'b'],
      ['a', 'b'],
    ],
    ['a', 'b'],
  )
  assert.equal(r.winnerId, 'a')
  assert.equal(r.tieWinnerIds, null)
  assert.equal(r.rounds[0].firstPreferenceCounts.a, 2)
})

test('runElection dowdall matches runDowdall and adds votingMethod', () => {
  const rankings = [
    ['a', 'b'],
    ['a', 'b'],
  ]
  const ids = ['a', 'b']
  const dowdall = runDowdall(rankings, ids)
  const elect = runElection('dowdall', rankings, ids)
  assert.deepEqual(elect, { ...dowdall, votingMethod: 'dowdall' })
})

test('runElection irv: declared tie without algorithmic tiebreak', () => {
  const r = runElection(
    'irv',
    [
      ['a', 'b'],
      ['b', 'a'],
    ],
    ['a', 'b'],
  )
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(r.rounds.length, 1)
  assert.deepEqual(r.rounds[0].eliminatedIds, [])
})

test('runElection coombs dispatches with last-place rounds log', () => {
  const r = runElection(
    'coombs',
    [
      ['a', 'b'],
      ['a', 'b'],
      ['a', 'b'],
      ['b', 'a'],
    ],
    ['a', 'b'],
  )
  assert.equal(r.votingMethod, 'coombs')
  assert.equal(r.winnerId, 'a')
  assert.ok('lastPlaceCounts' in r.rounds[0])
  assert.ok(!('firstPreferenceCounts' in r.rounds[0]))
})

test('runElection coombs matches runCoombs and adds votingMethod', () => {
  const rankings = [
    ['a', 'b'],
    ['a', 'b'],
    ['a', 'b'],
    ['b', 'a'],
  ]
  const ids = ['a', 'b']
  const coombs = runCoombs(rankings, ids)
  const elect = runElection('coombs', rankings, ids)
  assert.deepEqual(elect, { ...coombs, votingMethod: 'coombs' })
})

test('runElection baldwin dispatches with multi-round Borda elimination', () => {
  const rankings = [
    ['a', 'b', 'c'],
    ['a', 'b', 'c'],
    ['a', 'b', 'c'],
  ]
  const r = runElection('baldwin', rankings, ['a', 'b', 'c'])
  assert.equal(r.votingMethod, 'baldwin')
  assert.equal(r.winnerId, 'a')
  assert.ok(r.rounds.length >= 2)
  assert.deepEqual(r.rounds[0].eliminatedIds, ['c'])
})

test('runElection baldwin matches runBaldwin and adds votingMethod', () => {
  const rankings = [
    ['a', 'b', 'c'],
    ['a', 'b', 'c'],
    ['a', 'b', 'c'],
  ]
  const ids = ['a', 'b', 'c']
  const baldwin = runBaldwin(rankings, ids)
  const elect = runElection('baldwin', rankings, ids)
  assert.deepEqual(elect, { ...baldwin, votingMethod: 'baldwin' })
})

test('runElection baldwin: declared tie without fallback to IRV', () => {
  const r = runElection(
    'baldwin',
    [
      ['a', 'b', 'c'],
      ['b', 'c', 'a'],
      ['c', 'a', 'b'],
    ],
    ['a', 'b', 'c'],
  )
  assert.equal(r.votingMethod, 'baldwin')
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b', 'c']))
  assert.equal(r.rounds.length, 1)
})

test('runElection coombs: declared tie without fallback to IRV', () => {
  const r = runElection(
    'coombs',
    [
      ['a', 'b'],
      ['b', 'a'],
    ],
    ['a', 'b'],
  )
  assert.equal(r.votingMethod, 'coombs')
  assert.equal(r.winnerId, null)
  assert.deepEqual(new Set(r.tieWinnerIds ?? []), new Set(['a', 'b']))
  assert.equal(r.rounds.length, 1)
  assert.ok('lastPlaceCounts' in r.rounds[0])
  assert.ok(!('firstPreferenceCounts' in r.rounds[0]))
})
