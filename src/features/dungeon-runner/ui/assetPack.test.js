import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { EQUIPMENT_IDS } from '../engine/kernel.js'
import { dungeonRunnerAssetPack } from './assetPack.js'

function flattenPackEntries() {
  const { equipment, ...rest } = dungeonRunnerAssetPack
  return [
    ...Object.values(rest.cards),
    ...Object.values(rest.piles),
    ...Object.values(rest.icons),
    ...Object.values(rest.counters),
    ...Object.values(rest.board),
    ...Object.values(equipment),
  ]
}

test('dungeonRunnerAssetPack includes representative core assets', () => {
  assert.ok(dungeonRunnerAssetPack.cards.monsterBack)
  assert.ok(dungeonRunnerAssetPack.cards.revealedMonster)
  assert.ok(dungeonRunnerAssetPack.piles.deck)
  assert.ok(dungeonRunnerAssetPack.piles.dungeon)
  assert.ok(dungeonRunnerAssetPack.icons.runner)
  assert.ok(dungeonRunnerAssetPack.icons.monster)
  assert.ok(dungeonRunnerAssetPack.counters.turn)
  assert.ok(dungeonRunnerAssetPack.board.biddingTexture)
})

test('equipment pack has one entry per kernel equipment id', () => {
  assert.equal(Object.keys(dungeonRunnerAssetPack.equipment).length, EQUIPMENT_IDS.length)
  for (const id of EQUIPMENT_IDS) {
    assert.ok(dungeonRunnerAssetPack.equipment[id])
  }
})

test('runtime asset paths resolve as png files', () => {
  for (const asset of flattenPackEntries()) {
    assert.equal(asset.runtimePath.startsWith('/assets/dungeon-runner/runtime/'), true)
    assert.equal(asset.runtimePath.endsWith('.png'), true)
  }
})

test('master asset paths resolve as svg files', () => {
  for (const asset of flattenPackEntries()) {
    assert.equal(asset.masterPath.startsWith('/assets/dungeon-runner/masters/'), true)
    assert.equal(asset.masterPath.endsWith('.svg'), true)
  }
})

test('asset files exist for runtime and masters', async () => {
  for (const asset of flattenPackEntries()) {
    const runtimeFile = path.resolve(import.meta.dirname, '../../../../public', asset.runtimePath.replace('/assets/', 'assets/'))
    const masterFile = path.resolve(import.meta.dirname, '../../../../public', asset.masterPath.replace(/^\//, ''))
    await access(runtimeFile)
    await access(masterFile)
  }
})
