import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { dungeonRunnerAssetPack } from './assetPack.js'

test('dungeonRunnerAssetPack includes representative core assets', () => {
  assert.ok(dungeonRunnerAssetPack.cards.monsterBack)
  assert.ok(dungeonRunnerAssetPack.cards.revealedMonster)
  assert.ok(dungeonRunnerAssetPack.icons.runner)
  assert.ok(dungeonRunnerAssetPack.icons.monster)
  assert.ok(dungeonRunnerAssetPack.counters.turn)
  assert.ok(dungeonRunnerAssetPack.board.biddingTexture)
})

test('runtime asset paths resolve as png files', () => {
  const runtimeAssets = [
    ...Object.values(dungeonRunnerAssetPack.cards),
    ...Object.values(dungeonRunnerAssetPack.icons),
    ...Object.values(dungeonRunnerAssetPack.counters),
    ...Object.values(dungeonRunnerAssetPack.board),
  ]
  for (const asset of runtimeAssets) {
    assert.equal(asset.runtimePath.startsWith('/assets/dungeon-runner/runtime/'), true)
    assert.equal(asset.runtimePath.endsWith('.png'), true)
  }
})

test('master asset paths resolve as svg files', () => {
  const masterAssets = [
    ...Object.values(dungeonRunnerAssetPack.cards),
    ...Object.values(dungeonRunnerAssetPack.icons),
    ...Object.values(dungeonRunnerAssetPack.counters),
    ...Object.values(dungeonRunnerAssetPack.board),
  ]
  for (const asset of masterAssets) {
    assert.equal(asset.masterPath.startsWith('/artifacts/dungeon-runner/assets/masters/'), true)
    assert.equal(asset.masterPath.endsWith('.svg'), true)
  }
})

test('asset files exist for runtime and masters', async () => {
  const entries = [
    ...Object.values(dungeonRunnerAssetPack.cards),
    ...Object.values(dungeonRunnerAssetPack.icons),
    ...Object.values(dungeonRunnerAssetPack.counters),
    ...Object.values(dungeonRunnerAssetPack.board),
  ]
  for (const asset of entries) {
    const runtimeFile = path.resolve(import.meta.dirname, '../../../../public', asset.runtimePath.replace('/assets/', 'assets/'))
    const masterFile = path.resolve(import.meta.dirname, '../../../../', asset.masterPath.replace(/^\//, ''))
    await access(runtimeFile)
    await access(masterFile)
  }
})
