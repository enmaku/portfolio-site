import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { dungeonRunnerAssetPack, dungeonRunnerEquipmentSymbolRuntimePath } from './assetPack.js'

function flattenPackEntries() {
  const { equipment, ...rest } = dungeonRunnerAssetPack
  return [
    ...Object.values(rest.cards),
    ...Object.values(rest.piles),
    ...Object.values(rest.icons),
    ...Object.values(rest.counters),
    ...Object.values(rest.board),
    equipment.plate,
  ]
}

function flattenMasterBackedEntries() {
  return flattenPackEntries().filter((a) => 'masterPath' in a && a.masterPath != null)
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
  assert.ok(dungeonRunnerAssetPack.equipment.plate)
})

test('equipment pack exposes shared runtime-only plate token art', () => {
  assert.deepEqual(Object.keys(dungeonRunnerAssetPack.equipment), ['plate'])
  assert.equal(dungeonRunnerAssetPack.equipment.plate.runtimePath, '/assets/dungeon-runner/runtime/equipment/plate.png')
  assert.equal('masterPath' in dungeonRunnerAssetPack.equipment.plate, false)
})

test('dungeonRunnerEquipmentSymbolRuntimePath matches runtime symbols folder', () => {
  assert.equal(
    dungeonRunnerEquipmentSymbolRuntimePath('shield'),
    '/assets/dungeon-runner/runtime/symbols/shield.png',
  )
})

test('runtime asset paths resolve as png files', () => {
  for (const asset of flattenPackEntries()) {
    assert.equal(asset.runtimePath.startsWith('/assets/dungeon-runner/runtime/'), true)
    assert.equal(asset.runtimePath.endsWith('.png'), true)
  }
})

test('master asset paths resolve as svg files', () => {
  for (const asset of flattenMasterBackedEntries()) {
    assert.equal(asset.masterPath.startsWith('/assets/dungeon-runner/masters/'), true)
    assert.equal(asset.masterPath.endsWith('.svg'), true)
  }
})

test('asset files exist for runtime and masters', async () => {
  for (const asset of flattenPackEntries()) {
    const runtimeFile = path.resolve(import.meta.dirname, '../../../../public', asset.runtimePath.replace('/assets/', 'assets/'))
    await access(runtimeFile)
    if ('masterPath' in asset && asset.masterPath) {
      const masterFile = path.resolve(import.meta.dirname, '../../../../public', asset.masterPath.replace(/^\//, ''))
      await access(masterFile)
    }
  }
})
