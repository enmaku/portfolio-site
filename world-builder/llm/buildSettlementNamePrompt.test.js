import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSettlementNamePrompt,
  parseSettlementNameResponse,
} from './buildSettlementNamePrompt.js'

const annotations = {
  settlements: [{ id: 's1', n: 1 }, { id: 's2', n: 2 }],
  factions: [{ id: 'f1' }],
}

test('buildSettlementNamePrompt empty mode asks for a full name set', () => {
  const prompt = buildSettlementNamePrompt({
    annotations,
    includeRegionWriteup: true,
    generationMode: 'empty',
  })
  assert.match(prompt, /One settlement entry per settlement/)
  assert.match(prompt, /regionName: string/)
  assert.doesNotMatch(prompt, /immutable canon/)
  assert.doesNotMatch(prompt, /Missing names to invent/)
})

test('buildSettlementNamePrompt forbids reusing illustrative example names as outputs', () => {
  const prompt = buildSettlementNamePrompt({
    annotations,
    includeRegionWriteup: true,
    generationMode: 'empty',
  })
  assert.match(prompt, /Do not use the illustrative example names/)
  assert.match(prompt, /never name anything Valen, Karn/)
  assert.match(prompt, /Replace any newly invented name that is Valen, Karn/)
})

test('buildSettlementNamePrompt partial mode sends provided names and missing ids', () => {
  const prompt = buildSettlementNamePrompt({
    annotations,
    includeRegionWriteup: true,
    generationMode: 'partial',
    providedNames: {
      settlements: { s1: 'Valen' },
      factions: {},
      regionName: '',
    },
    missingSettlementIds: ['s2'],
    missingFactionIds: ['f1'],
    missingRegionName: true,
  })
  assert.match(prompt, /immutable canon/)
  assert.match(prompt, /"s1":"Valen"/)
  assert.match(prompt, /Missing names to invent/)
  assert.match(prompt, /"s2"/)
  assert.doesNotMatch(prompt, /One settlement entry per settlement/)
})

test('buildSettlementNamePrompt partial mode demands one entry per missing faction id', () => {
  const prompt = buildSettlementNamePrompt({
    annotations: { settlements: [{ id: 's1', n: 1 }], factions: [{ id: 'f1' }, { id: 'f2' }] },
    includeRegionWriteup: true,
    generationMode: 'partial',
    providedNames: {
      settlements: { s1: 'Valen' },
      factions: { f1: 'Candia' },
      regionName: 'Calorum',
    },
    missingSettlementIds: [],
    missingFactionIds: ['f2'],
    missingRegionName: false,
  })
  assert.match(prompt, /exactly 0 settlements entries and 1 factions entries/)
  assert.match(prompt, /factions array is not optional/)
  assert.match(prompt, /\["f2"\]/)
  assert.match(prompt, /no omissions and no extras/)
})

test('buildSettlementNamePrompt partial mode asks for an empty factions array when none are missing', () => {
  const prompt = buildSettlementNamePrompt({
    annotations,
    includeRegionWriteup: true,
    generationMode: 'partial',
    providedNames: { settlements: {}, factions: { f1: 'Candia' }, regionName: '' },
    missingSettlementIds: ['s1', 's2'],
    missingFactionIds: [],
    missingRegionName: true,
  })
  assert.match(prompt, /exactly 2 settlements entries and 0 factions entries/)
  assert.match(prompt, /return an empty factions array/)
})

test('buildSettlementNamePrompt complete mode omits name-output fields', () => {
  const prompt = buildSettlementNamePrompt({
    annotations,
    includeRegionWriteup: true,
    generationMode: 'complete',
    providedNames: {
      settlements: { s1: 'Valen', s2: 'Rynn' },
      factions: { f1: 'House Karn' },
      regionName: 'The Reach',
    },
  })
  assert.match(prompt, /Do not return settlements, factions, or regionName/)
  assert.match(prompt, /"The Reach"/)
  assert.doesNotMatch(prompt, /You invent fantasy names/)
  assert.doesNotMatch(prompt, /Missing names to invent/)
})

test('parseSettlementNameResponse keeps provided names over generated replacements', () => {
  const parsed = parseSettlementNameResponse(
    JSON.stringify({
      settlements: [
        { settlementId: 's1', name: 'Overwrite' },
        { settlementId: 's2', name: 'Rynn' },
      ],
      factions: [{ factionId: 'f1', name: 'Nope' }],
      regionName: 'Otherland',
      overview: 'Overview of the region.',
      notableSettlements: [
        { settlementId: 's1', mapNumber: 1, name: 'Overwrite', description: 'A port.' },
      ],
      factionProfiles: [{ factionId: 'f1', summary: 'Holds the coast.' }],
      writeupSettlementIds: ['s1'],
    }),
    {
      providedNames: {
        settlements: { s1: 'Valen' },
        factions: { f1: 'House Karn' },
        regionName: 'The Reach',
      },
      expectedSettlementIds: ['s1', 's2'],
      expectedFactionIds: ['f1'],
    },
  )
  assert.equal(parsed.settlements.s1, 'Valen')
  assert.equal(parsed.settlements.s2, 'Rynn')
  assert.equal(parsed.factions.f1, 'House Karn')
  assert.equal(parsed.regionName, 'The Reach')
  assert.equal(parsed.notableSettlements[0].name, 'Valen')
  assert.match(parsed.factionProfiles[0].summary, /^House Karn\n/)
  assert.match(parsed.regionWriteup, /The Reach/)
})

test('parseSettlementNameResponse complete writeup can mention provided settlement ids', () => {
  const parsed = parseSettlementNameResponse(
    JSON.stringify({
      overview: 'Overview.',
      notableSettlements: [
        { settlementId: 's1', mapNumber: 1, description: 'A port.' },
      ],
      factionProfiles: [{ factionId: 'f1', summary: 'Holds the coast.' }],
      writeupSettlementIds: ['s1'],
    }),
    {
      providedNames: {
        settlements: { s1: 'Valen' },
        factions: { f1: 'House Karn' },
        regionName: 'The Reach',
      },
      expectedSettlementIds: ['s1'],
      expectedFactionIds: ['f1'],
    },
  )
  assert.equal(parsed.settlements.s1, 'Valen')
  assert.deepEqual(parsed.writeupSettlementIds, ['s1'])
  assert.equal(parsed.notableSettlements[0].name, 'Valen')
})
