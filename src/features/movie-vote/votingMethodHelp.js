import { VOTING_METHOD_IDS, VOTING_METHOD_OPTIONS } from './votingMethod.js'

/**
 * Help copy for the voting method settings dialog.
 * Keep in sync with `VOTING_METHOD_IDS` — each id must have an entry here.
 *
 * @type {Readonly<Record<import('./votingMethod.js').VotingMethod, { wikipediaUrl: string, chooseThis: string, howItWorks: string }>>}
 */
const VOTING_METHOD_HELP_BY_ID = {
  irv: {
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Instant-runoff_voting',
    chooseThis:
      'Pick this when you’d rather land on something most people can live with than let a few loud #1 votes decide the whole night.',
    howItWorks:
      'Instant-runoff: count first preferences; eliminate last-place ties together; transfer until majority or declared tie.',
  },
  borda: {
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Borda_count',
    chooseThis:
      'Pick this when the whole list matters—everyone’s “yeah, I’d watch that” picks should count, not just who fought hardest for their favorite.',
    howItWorks:
      'Classic Borda: points by full-ballot rank (n−1 down to 0); highest total wins; top ties declare a tie.',
  },
  dowdall: {
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Dowdall_system',
    chooseThis:
      'Pick this when your #1 should matter way more than your #4, but you still want one quick tally instead of elimination rounds.',
    howItWorks:
      'Harmonic points (1, ½, ⅓, …) by rank in one pass; highest wins; top ties declare a tie.',
  },
  condorcet: {
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Condorcet_method',
    chooseThis:
      'Pick this when the fair answer is “this movie beats every other one in a showdown”—and you’re okay calling a tie if the room genuinely can’t agree.',
    howItWorks:
      'Pairwise showdowns; a Condorcet winner beats every other; otherwise declared tie.',
  },
  copeland: {
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Copeland%27s_method',
    chooseThis:
      'Pick this when you want a straight who-beat-who scoreboard without the head-to-head tie weirdness other methods can throw at you.',
    howItWorks:
      'Scoreboard of pairwise wins; highest Copeland score wins; ties declare a tie.',
  },
  coombs: {
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Coombs%27_method',
    chooseThis:
      'Pick this when it’s more important to eliminate what you DON’T want to see than for your top pick to win.',
    howItWorks:
      'Eliminate most last-place (tied lasts together) each round until one remains or declared tie.',
  },
  baldwin: {
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Baldwin_method',
    chooseThis:
      'Pick this when rankings should count, but you’d still like to knock out the obvious duds before anyone claims victory.',
    howItWorks:
      'Iterative Borda on survivors; eliminate lowest (ties together) until one remains or declared tie.',
  },
}

for (const id of VOTING_METHOD_IDS) {
  if (!VOTING_METHOD_HELP_BY_ID[id]) {
    throw new Error(`votingMethodHelp: missing entry for ${id}`)
  }
}

/**
 * @returns {readonly { method: import('./votingMethod.js').VotingMethod, label: string, wikipediaUrl: string, chooseThis: string, howItWorks: string }[]}
 */
export function getVotingMethodHelpEntries() {
  return VOTING_METHOD_OPTIONS.map(({ value, label }) => ({
    method: value,
    label,
    ...VOTING_METHOD_HELP_BY_ID[value],
  }))
}
