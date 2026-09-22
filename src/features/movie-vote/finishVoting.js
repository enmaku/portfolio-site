import { runElection } from './election.js'

export function finishVotingIfComplete(store) {
  if (store.phase !== 'voting') return false
  const { voterIds, votesByParticipant, ballotOrderIds } = store
  if (!voterIds.length) return false
  for (const id of voterIds) {
    const r = votesByParticipant[id]
    if (!r || r.length !== ballotOrderIds.length) return false
  }
  const rankings = voterIds.map((id) => votesByParticipant[id])
  const result = runElection(store.votingMethod, rankings, [...ballotOrderIds])
  store.setElectionOutcome(result)
  return true
}

export function forceFinishVoting(store) {
  if (store.phase !== 'voting') return false
  const { votesByParticipant, ballotOrderIds } = store
  const next = {}
  for (const [id, ranking] of Object.entries(votesByParticipant)) {
    if (ranking?.length === ballotOrderIds.length) next[id] = ranking
  }
  store.votesByParticipant = next
  const rankings = Object.values(next)
  if (!rankings.length) return false
  const result = runElection(store.votingMethod, rankings, [...ballotOrderIds])
  store.setElectionOutcome(result)
  return true
}
