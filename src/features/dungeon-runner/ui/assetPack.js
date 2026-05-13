export const DUNGEON_RUNNER_RUNTIME_BASE = '/assets/dungeon-runner/runtime'
const BASE_RUNTIME_PATH = DUNGEON_RUNNER_RUNTIME_BASE
const BASE_MASTER_PATH = '/assets/dungeon-runner/masters'

function assetEntry(group, name) {
  return {
    runtimePath: `${BASE_RUNTIME_PATH}/${group}/${name}.png`,
    masterPath: `${BASE_MASTER_PATH}/${group}/${name}.svg`,
  }
}

function runtimeOnlyPng(group, name) {
  return { runtimePath: `${BASE_RUNTIME_PATH}/${group}/${name}.png` }
}

/** @param {string} symbolKey */
export function dungeonRunnerEquipmentSymbolRuntimePath(symbolKey) {
  return `${BASE_RUNTIME_PATH}/symbols/${symbolKey}.png`
}

export const dungeonRunnerAssetPack = {
  cards: {
    monsterBack: assetEntry('cards', 'monster-back'),
    revealedMonster: assetEntry('cards', 'revealed-monster'),
  },
  piles: {
    deck: assetEntry('piles', 'deck-back'),
    dungeon: assetEntry('piles', 'dungeon-back'),
  },
  icons: {
    runner: assetEntry('icons', 'runner'),
    monster: assetEntry('icons', 'monster'),
  },
  counters: {
    turn: assetEntry('counters', 'turn'),
  },
  board: {
    biddingTexture: assetEntry('board', 'bidding-texture'),
  },
  equipment: {
    plate: runtimeOnlyPng('equipment', 'plate'),
  },
}
