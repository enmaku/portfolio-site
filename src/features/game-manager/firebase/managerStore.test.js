import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GAME_MANAGER_OWNERS_COLLECTION,
  gameManagerCollectionItemPath,
  gameManagerOwnerPath,
  gameManagerPersonPath,
  gameManagerPlaySessionPath,
} from './managerStore.js'

test('manager store paths nest under gameManagerOwners/{uid}', () => {
  assert.equal(gameManagerOwnerPath('uid-1'), `${GAME_MANAGER_OWNERS_COLLECTION}/uid-1`)
  assert.equal(gameManagerPersonPath('uid-1', 'p1'), `${GAME_MANAGER_OWNERS_COLLECTION}/uid-1/people/p1`)
  assert.equal(
    gameManagerCollectionItemPath('uid-1', 'c1'),
    `${GAME_MANAGER_OWNERS_COLLECTION}/uid-1/collection/c1`,
  )
  assert.equal(
    gameManagerPlaySessionPath('uid-1', 's1'),
    `${GAME_MANAGER_OWNERS_COLLECTION}/uid-1/playSessions/s1`,
  )
})
