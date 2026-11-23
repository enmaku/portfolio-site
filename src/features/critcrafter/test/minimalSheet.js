// Smallest schema-valid sheet. Test-side helper (ESM); the function side has its own copy.

function stat(value, parts = [{ label: 'Base', amount: value, type: 'base' }]) {
  return { value, breakdown: parts }
}

export function minimalSheet() {
  return {
    schemaVersion: 1,
    generatedAt: '2026-01-01T00:00:00.000Z',
    corpus: { sha: 'stub' },
    warnings: [],
    header: {
      name: 'Fixture',
      level: 1,
      ancestry: 'Human',
      classLine: 'Fighter',
      hp: stat(18),
      perception: stat(5),
      speed: stat(25),
      unarmoredAc: stat(10),
    },
    stats: {
      abilities: [{ id: 'str', score: 18, mod: 4 }],
      saves: [
        {
          id: 'fortitude',
          name: 'Fortitude',
          rank: 'T',
          bonus: stat(5, [
            { label: 'Constitution', amount: 2, type: 'ability' },
            { label: 'Trained', amount: 2, type: 'proficiency' },
            { label: 'Level', amount: 1, type: 'level' },
          ]),
        },
      ],
      classDc: stat(10),
    },
    skills: [],
    gear: {
      bulk: { ...stat(0), encumberedAt: 9, max: 14 },
      weapons: [],
      shields: [],
      armor: [],
      consumables: [],
      gear: [],
    },
    spells: { casters: [], focus: null, rituals: [] },
    actions: { groups: [] },
    features: { groups: [] },
  }
}
