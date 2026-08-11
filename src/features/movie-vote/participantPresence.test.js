import assert from 'node:assert/strict'
import test from 'node:test'
import { HOST_PARTICIPANT_ID } from './core.js'
import { withParticipantPresence } from './participantPresence.js'

test('withParticipantPresence marks host online and guests from active set', () => {
  const stableIdToParticipant = new Map([
    ['s1', 'g1'],
    ['s2', 'g2'],
  ])
  const activeGuestStableIds = new Set(['s1'])
  const stamped = withParticipantPresence(
    {
      phase: 'suggest',
      participants: [
        { id: HOST_PARTICIPANT_ID, name: 'Host', quorumRequired: true, ready: false, pickCount: 0 },
        { id: 'g1', name: 'A', quorumRequired: true, ready: false, pickCount: 0 },
        { id: 'g2', name: 'B', quorumRequired: true, ready: false, pickCount: 0 },
      ],
      ballotMovies: null,
      ballotOrderIds: null,
      voteProgress: null,
      electionOutcome: null,
      uniqueSuggestedMovieCount: 0,
      votingMethod: 'irv',
    },
    { stableIdToParticipant, activeGuestStableIds },
  )
  assert.equal(stamped.participants[0]?.online, true)
  assert.equal(stamped.participants[1]?.online, true)
  assert.equal(stamped.participants[2]?.online, false)
})
