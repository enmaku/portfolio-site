import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, test } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import { get, ref, set } from 'firebase/database'

const PROJECT_ID = 'demo-portfolio-rtdb-rules'
const DATABASE_URL = `http://127.0.0.1:9001?ns=${PROJECT_ID}`

/** @type {import('@firebase/rules-unit-testing').RulesTestEnvironment} */
let testEnv

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: {
      host: '127.0.0.1',
      port: 9001,
      rules: readFileSync(new URL('./database.rules.json', import.meta.url), 'utf8'),
    },
  })
})

after(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearDatabase()
})

function unauthenticatedDatabase() {
  return testEnv.unauthenticatedContext().database(DATABASE_URL)
}

test('unauthenticated client cannot read at database root', async () => {
  const db = unauthenticatedDatabase()
  await assertFails(get(ref(db, '/')))
})

test('unauthenticated client cannot write at database root', async () => {
  const db = unauthenticatedDatabase()
  await assertFails(set(ref(db, 'rogue'), { ok: true }))
})

test('unauthenticated client can read and write gameTimerRooms/{suffix}', async () => {
  const db = unauthenticatedDatabase()
  const roomRef = ref(db, 'gameTimerRooms/ABC123')
  await assertSucceeds(set(roomRef, { phase: 'hosting' }))
  await assertSucceeds(get(roomRef))
})

test('unauthenticated client can read and write movieVoteRooms/{suffix}', async () => {
  const db = unauthenticatedDatabase()
  const roomRef = ref(db, 'movieVoteRooms/XYZ789')
  await assertSucceeds(set(roomRef, { phase: 'hosting' }))
  await assertSucceeds(get(roomRef))
})

test('unauthenticated client cannot write outside known product roots', async () => {
  const db = unauthenticatedDatabase()
  await assertFails(set(ref(db, 'rogueRooms/ABC123'), { ok: true }))
})

test('unauthenticated client can list dungeonRunnerCompletedMatches for archive listing', async () => {
  const db = unauthenticatedDatabase()
  await assertSucceeds(get(ref(db, 'dungeonRunnerCompletedMatches')))
})

test('unauthenticated client cannot write at dungeonRunnerCompletedMatches root', async () => {
  const db = unauthenticatedDatabase()
  await assertFails(set(ref(db, 'dungeonRunnerCompletedMatches'), { seeded: true }))
})

test('unauthenticated client can create dungeonRunnerCompletedMatches/{matchId} once', async () => {
  const db = unauthenticatedDatabase()
  const matchRef = ref(db, 'dungeonRunnerCompletedMatches/match-abc')
  await assertSucceeds(set(matchRef, { schemaVersion: 1 }))
  await assertFails(set(matchRef, { schemaVersion: 2 }))
})
