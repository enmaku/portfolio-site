import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, test } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const PROJECT_ID = 'demo-portfolio-firestore-rules'

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let testEnv

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8'),
    },
  })
})

after(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

function unauthenticatedFirestore() {
  return testEnv.unauthenticatedContext().firestore()
}

test('unauthenticated client can create dungeonRunnerMatchOutcomes/{matchId} once', async () => {
  const db = unauthenticatedFirestore()
  const matchRef = doc(db, 'dungeonRunnerMatchOutcomes/match-abc')
  await assertSucceeds(setDoc(matchRef, { outcomeSchemaVersion: 1, matchId: 'match-abc' }))
  await assertFails(setDoc(matchRef, { outcomeSchemaVersion: 2, matchId: 'match-abc' }))
})

test('unauthenticated client cannot update dungeonRunnerMatchOutcomes/{matchId}', async () => {
  const db = unauthenticatedFirestore()
  const matchRef = doc(db, 'dungeonRunnerMatchOutcomes/match-update')
  await assertSucceeds(setDoc(matchRef, { outcomeSchemaVersion: 1 }))
  await assertFails(
    setDoc(matchRef, { outcomeSchemaVersion: 1, patched: true }, { merge: true }),
  )
})

test('unauthenticated client cannot delete dungeonRunnerMatchOutcomes/{matchId}', async () => {
  const db = unauthenticatedFirestore()
  const matchRef = doc(db, 'dungeonRunnerMatchOutcomes/match-delete')
  await assertSucceeds(setDoc(matchRef, { outcomeSchemaVersion: 1 }))
  const { deleteDoc } = await import('firebase/firestore')
  await assertFails(deleteDoc(matchRef))
})

test('unauthenticated client can read dungeonRunnerMatchOutcomes/{matchId}', async () => {
  const db = unauthenticatedFirestore()
  const matchRef = doc(db, 'dungeonRunnerMatchOutcomes/match-read')
  await assertSucceeds(setDoc(matchRef, { outcomeSchemaVersion: 1 }))
  await assertSucceeds(getDoc(matchRef))
})
