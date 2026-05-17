import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DUNGEON_ORCHESTRATOR_PRESENTATION_KINDS,
  ORCHESTRATOR_PRESENTATION_KINDS,
  isDungeonOrchestratorPresentationKind,
} from './orchestratorPresentationKinds.js'

test('every DUNGEON_* kind in the canonical list is in the derived dungeon set', () => {
  const expectedDungeonKinds = ORCHESTRATOR_PRESENTATION_KINDS.filter((k) =>
    k.startsWith('DUNGEON_'),
  )
  const derivedSet = new Set(DUNGEON_ORCHESTRATOR_PRESENTATION_KINDS)

  assert.equal(
    derivedSet.size,
    expectedDungeonKinds.length,
    'derived set should include each canonical DUNGEON_* entry exactly once',
  )

  for (const kind of expectedDungeonKinds) {
    assert.ok(derivedSet.has(kind), `${kind} should be in DUNGEON_ORCHESTRATOR_PRESENTATION_KINDS`)
  }
})

test('derived dungeon set contains no non-DUNGEON_* kinds', () => {
  for (const kind of DUNGEON_ORCHESTRATOR_PRESENTATION_KINDS) {
    assert.ok(kind.startsWith('DUNGEON_'), `${kind} must start with DUNGEON_`)
  }

  const nonDungeonCanonical = ORCHESTRATOR_PRESENTATION_KINDS.filter(
    (k) => !k.startsWith('DUNGEON_'),
  )
  const derivedSet = new Set(DUNGEON_ORCHESTRATOR_PRESENTATION_KINDS)

  for (const kind of nonDungeonCanonical) {
    assert.ok(!derivedSet.has(kind), `${kind} must not appear in the dungeon-only derived set`)
  }
})

test('isDungeonOrchestratorPresentationKind agrees with derived set membership', () => {
  const derivedSet = new Set(DUNGEON_ORCHESTRATOR_PRESENTATION_KINDS)

  for (const kind of derivedSet) {
    assert.equal(isDungeonOrchestratorPresentationKind(kind), true)
  }

  for (const kind of ORCHESTRATOR_PRESENTATION_KINDS) {
    assert.equal(isDungeonOrchestratorPresentationKind(kind), derivedSet.has(kind))
  }

  assert.equal(isDungeonOrchestratorPresentationKind(null), false)
  assert.equal(isDungeonOrchestratorPresentationKind(undefined), false)
})
