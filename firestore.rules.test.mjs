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

function authedFirestore(uid) {
  return testEnv.authenticatedContext(uid).firestore()
}

test('account owner can read and write their gameManagerOwners tree', async () => {
  const db = authedFirestore('owner-1')
  const personRef = doc(db, 'gameManagerOwners/owner-1/people/p1')
  await assertSucceeds(setDoc(personRef, { name: 'Ada', color: '#111111', saved: true }))
  await assertSucceeds(getDoc(personRef))
})

test('account owner cannot read another owner gameManager tree', async () => {
  const ownerDb = authedFirestore('owner-1')
  const personRef = doc(ownerDb, 'gameManagerOwners/owner-1/people/p1')
  await assertSucceeds(setDoc(personRef, { name: 'Ada', color: '#111111', saved: true }))

  const otherDb = authedFirestore('owner-2')
  await assertFails(getDoc(doc(otherDb, 'gameManagerOwners/owner-1/people/p1')))
  await assertFails(setDoc(doc(otherDb, 'gameManagerOwners/owner-1/people/p2'), { name: 'Eve' }))
})

test('unauthenticated client cannot access gameManagerOwners', async () => {
  const db = unauthenticatedFirestore()
  await assertFails(setDoc(doc(db, 'gameManagerOwners/owner-1/people/p1'), { name: 'Ada' }))
  await assertFails(getDoc(doc(db, 'gameManagerOwners/owner-1/people/p1')))
})

test('authenticated client can read bggCatalogGames but cannot write', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'bggCatalogGames/266192'), {
      bggId: '266192',
      name: 'Wingspan',
      searchPrefixes: ['wing'],
    })
  })

  const db = authedFirestore('owner-1')
  await assertSucceeds(getDoc(doc(db, 'bggCatalogGames/266192')))
  await assertFails(setDoc(doc(db, 'bggCatalogGames/1'), { bggId: '1', name: 'X' }))
})

test('unauthenticated client cannot read bggCatalogGames', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'bggCatalogGames/266192'), {
      bggId: '266192',
      name: 'Wingspan',
    })
  })

  const db = unauthenticatedFirestore()
  await assertFails(getDoc(doc(db, 'bggCatalogGames/266192')))
})
