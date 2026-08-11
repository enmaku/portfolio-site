import assert from 'node:assert/strict'
import test from 'node:test'
import { buildQuorumRows } from './buildQuorumRows.js'
import { HOST_PARTICIPANT_ID } from './core.js'

test('suggest rows use quorumRequired for progress and mark host', () => {
  const rows = buildQuorumRows({
    phase: 'suggest',
    participants: [
      {
        id: HOST_PARTICIPANT_ID,
        name: 'Host',
        quorumRequired: true,
        ready: true,
        pickCount: 0,
      },
      {
        id: 'g1',
        name: 'Sam',
        quorumRequired: false,
        ready: false,
        pickCount: 2,
      },
    ],
  })
  assert.equal(rows[0]?.isHost, true)
  assert.equal(rows[0]?.progress?.key, 'ready')
  assert.equal(rows[1]?.isHost, false)
  assert.equal(rows[1]?.quorumRequired, false)
  assert.equal(rows[1]?.progress?.key, 'has_picks')
})

test('voting rows prefer voterIds for progress when present', () => {
  const rows = buildQuorumRows({
    phase: 'voting',
    participants: [
      {
        id: HOST_PARTICIPANT_ID,
        name: 'Host',
        quorumRequired: true,
        ready: true,
        pickCount: 0,
      },
      {
        id: 'optional',
        name: 'Sam',
        quorumRequired: false,
        ready: false,
        pickCount: 1,
      },
    ],
    voterIds: [HOST_PARTICIPANT_ID],
    ballotOrderIds: ['m1', 'm2'],
    votesByParticipant: {
      [HOST_PARTICIPANT_ID]: ['m1', 'm2'],
    },
  })
  assert.equal(rows[0]?.progress?.key, 'voted')
  assert.equal(rows[1]?.progress?.key, 'watching')
})
