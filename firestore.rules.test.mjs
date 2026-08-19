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

test('clients cannot read or write bggThingCache', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'bggThingCache/13'), {
      entry: { catalogEntryId: '13', title: 'Catan' },
      cachedAtMs: Date.now(),
    })
  })

  const authed = authedFirestore('owner-1')
  await assertFails(getDoc(doc(authed, 'bggThingCache/13')))
  await assertFails(
    setDoc(doc(authed, 'bggThingCache/1'), {
      entry: { catalogEntryId: '1', title: 'X' },
      cachedAtMs: Date.now(),
    }),
  )

  const anon = unauthenticatedFirestore()
  await assertFails(getDoc(doc(anon, 'bggThingCache/13')))
})

const CAPABILITY_SECRET = 'a'.repeat(32)

test('account owner can read and write their timeTrackerOwners tree', async () => {
  const db = authedFirestore('owner-1')
  const projectRef = doc(db, 'timeTrackerOwners/owner-1/projects/p1')
  await assertSucceeds(setDoc(projectRef, { name: 'Alpha', billable: false }))
  await assertSucceeds(getDoc(projectRef))
})

test('account owner cannot read another owner timeTracker tree', async () => {
  const ownerDb = authedFirestore('owner-1')
  await assertSucceeds(
    setDoc(doc(ownerDb, 'timeTrackerOwners/owner-1/projects/p1'), { name: 'Alpha' }),
  )
  const otherDb = authedFirestore('owner-2')
  await assertFails(getDoc(doc(otherDb, 'timeTrackerOwners/owner-1/projects/p1')))
  await assertFails(setDoc(doc(otherDb, 'timeTrackerOwners/owner-1/projects/p2'), { name: 'Eve' }))
})

test('unauthenticated client cannot access time tracker projects or time entries', async () => {
  const db = unauthenticatedFirestore()
  await assertFails(setDoc(doc(db, 'timeTrackerOwners/owner-1/projects/p1'), { name: 'Alpha' }))
  await assertFails(getDoc(doc(db, 'timeTrackerOwners/owner-1/projects/p1')))
  await assertFails(setDoc(doc(db, 'timeTrackerOwners/owner-1/timeEntries/e1'), { projectId: 'p1' }))
})

test('unauthenticated client can read a capability lookup and matching invoices', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, `timeTrackerInvoiceLinks/${CAPABILITY_SECRET}`), {
      ownerUid: 'owner-1',
      clientId: 'c1',
    })
    await setDoc(doc(db, 'timeTrackerOwners/owner-1/invoices/inv1'), {
      clientId: 'c1',
      linkSecret: CAPABILITY_SECRET,
      invoiceTotalCents: 1000,
      amountPaidCents: 0,
    })
  })

  const db = unauthenticatedFirestore()
  await assertSucceeds(getDoc(doc(db, `timeTrackerInvoiceLinks/${CAPABILITY_SECRET}`)))
  await assertSucceeds(getDoc(doc(db, 'timeTrackerOwners/owner-1/invoices/inv1')))
})

test('unauthenticated client can update amount paid only on a capability invoice', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, `timeTrackerInvoiceLinks/${CAPABILITY_SECRET}`), {
      ownerUid: 'owner-1',
      clientId: 'c1',
    })
    await setDoc(doc(db, 'timeTrackerOwners/owner-1/invoices/inv1'), {
      clientId: 'c1',
      linkSecret: CAPABILITY_SECRET,
      invoiceTotalCents: 1000,
      amountPaidCents: 0,
    })
  })

  const db = unauthenticatedFirestore()
  const invoiceRef = doc(db, 'timeTrackerOwners/owner-1/invoices/inv1')
  await assertSucceeds(setDoc(invoiceRef, { amountPaidCents: 1000 }, { merge: true }))
  await assertFails(setDoc(invoiceRef, { invoiceTotalCents: 1 }, { merge: true }))
})

test('regenerated capability secret no longer reads invoices', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'timeTrackerOwners/owner-1/invoices/inv1'), {
      clientId: 'c1',
      linkSecret: 'b'.repeat(32),
      invoiceTotalCents: 1000,
      amountPaidCents: 0,
    })
  })

  const db = unauthenticatedFirestore()
  await assertFails(getDoc(doc(db, 'timeTrackerOwners/owner-1/invoices/inv1')))
})
