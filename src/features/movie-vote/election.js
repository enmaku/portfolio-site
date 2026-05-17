/**
 * Single-winner election facade. Dispatches by voting method.
 */

import { runBaldwin } from './baldwin.js'
import { runBorda } from './borda.js'
import { runCondorcet } from './condorcet.js'
import { runDowdall } from './dowdall.js'
import { runCopeland } from './copeland.js'
import { runCoombs } from './coombs.js'
import { runIrv } from './irv.js'
import { normalizeVotingMethod } from './votingMethod.js'

/**
 * @typedef {import('./irv.js').IrvResult} ElectionResult
 */

/**
 * @param {unknown} result
 * @returns {boolean}
 */
export function isDeclaredElectionTie(result) {
  return Array.isArray(result?.tieWinnerIds) && result.tieWinnerIds.length > 0
}

/**
 * @param {import('./votingMethod.js').VotingMethod | unknown} votingMethod
 * @param {string[][]} rankings
 * @param {string[]} candidateIds
 * @returns {ElectionResult}
 */
export function runElection(votingMethod, rankings, candidateIds) {
  const method = normalizeVotingMethod(votingMethod)

  if (method === 'irv') {
    return { ...runIrv(rankings, candidateIds), votingMethod: method }
  }

  if (method === 'borda') {
    return { ...runBorda(rankings, candidateIds), votingMethod: method }
  }

  if (method === 'condorcet') {
    return { ...runCondorcet(rankings, candidateIds), votingMethod: method }
  }

  if (method === 'copeland') {
    return { ...runCopeland(rankings, candidateIds), votingMethod: method }
  }

  if (method === 'coombs') {
    return { ...runCoombs(rankings, candidateIds), votingMethod: method }
  }

  if (method === 'baldwin') {
    return { ...runBaldwin(rankings, candidateIds), votingMethod: method }
  }

  if (method === 'dowdall') {
    return { ...runDowdall(rankings, candidateIds), votingMethod: method }
  }

  return unsupportedElectionResult(method, candidateIds)
}

/**
 * @param {import('./votingMethod.js').VotingMethod} method
 * @param {string[]} candidateIds
 * @returns {ElectionResult}
 */
function unsupportedElectionResult(method, candidateIds) {
  if (candidateIds.length === 0) {
    return { votingMethod: method, rounds: [], winnerId: null, tieWinnerIds: [] }
  }
  if (candidateIds.length === 1) {
    return {
      votingMethod: method,
      rounds: [],
      winnerId: candidateIds[0],
      tieWinnerIds: null,
    }
  }
  return {
    votingMethod: method,
    rounds: [],
    winnerId: null,
    tieWinnerIds: [...candidateIds],
  }
}
