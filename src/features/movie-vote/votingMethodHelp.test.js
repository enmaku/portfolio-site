import assert from 'node:assert/strict'
import test from 'node:test'
import { VOTING_METHOD_IDS } from './votingMethod.js'
import { getVotingMethodHelpEntries } from './votingMethodHelp.js'

test('every voting method help entry has non-empty howItWorks and chooseThis', () => {
  const entries = getVotingMethodHelpEntries()
  const byMethod = new Map(entries.map((e) => [e.method, e]))
  for (const id of VOTING_METHOD_IDS) {
    const entry = byMethod.get(id)
    assert.ok(entry, `missing help entry for ${id}`)
    assert.equal(typeof entry.howItWorks, 'string')
    assert.ok(entry.howItWorks.length > 0, `${id}.howItWorks must be non-empty`)
    assert.equal(typeof entry.chooseThis, 'string')
    assert.ok(entry.chooseThis.length > 0, `${id}.chooseThis must be non-empty`)
  }
})
