/**
 * @param {{ isGuest: boolean, phase: import('./types.js').MovieVotePhase }} input
 */
export function getMovieVoteSettingsModel(input) {
  const locked = input.phase !== 'suggest'
  return {
    votingMethodEditable: !input.isGuest && !locked,
    votingMethodReadOnly: input.isGuest || locked,
  }
}
