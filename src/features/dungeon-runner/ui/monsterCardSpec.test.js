import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { dungeonRunnerAssetPack, DUNGEON_RUNNER_RUNTIME_BASE } from './assetPack.js'
import {
  MONSTER_CARD_SPECS,
  cardBlankUrl,
  monsterBackUrl,
  monsterDoodleUrl,
  revealedMonsterTemplateUrl,
  symbolUrl,
} from './monsterCardSpec.js'

function *monsterCardGrammarRuntimeUrls() {
  yield cardBlankUrl()
  yield monsterBackUrl()
  yield revealedMonsterTemplateUrl()
  for (const spec of MONSTER_CARD_SPECS) {
    yield monsterDoodleUrl(spec.species)
    for (const icon of spec.icons) {
      yield symbolUrl(icon)
    }
  }
}

function publicPathToPublicFile(urlPath) {
  assert.equal(urlPath.startsWith('/assets/'), true)
  return path.resolve(import.meta.dirname, '../../../../public', urlPath.replace(/^\//, ''))
}

test('revealedMonsterTemplateUrl matches dungeonRunnerAssetPack entry', () => {
  assert.equal(revealedMonsterTemplateUrl(), dungeonRunnerAssetPack.cards.revealedMonster.runtimePath)
})

test('monsterBackUrl matches dungeonRunnerAssetPack entry', () => {
  assert.equal(monsterBackUrl(), dungeonRunnerAssetPack.cards.monsterBack.runtimePath)
})

test('card grammar layer URLs use DUNGEON_RUNNER_RUNTIME_BASE from assetPack', () => {
  assert.equal(cardBlankUrl(), `${DUNGEON_RUNNER_RUNTIME_BASE}/cards/card-blank.png`)
  assert.equal(monsterDoodleUrl('goblin'), `${DUNGEON_RUNNER_RUNTIME_BASE}/cards/doodles/goblin.png`)
  assert.equal(symbolUrl('torch'), `${DUNGEON_RUNNER_RUNTIME_BASE}/symbols/torch.png`)
})

test('monster card grammar runtime URLs exist on disk', async () => {
  const urls = [...monsterCardGrammarRuntimeUrls()]
  const unique = new Set(urls)
  for (const url of urls) {
    assert.equal(url.startsWith('/assets/dungeon-runner/runtime/'), true)
    assert.equal(url.endsWith('.png'), true)
  }
  for (const url of unique) {
    await access(publicPathToPublicFile(url))
  }
})
