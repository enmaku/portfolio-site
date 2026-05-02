const BASE_RUNTIME_PATH = '/assets/dungeon-runner/runtime'
const BASE_MASTER_PATH = '/artifacts/dungeon-runner/assets/masters'

function assetEntry(group, name) {
  return {
    runtimePath: `${BASE_RUNTIME_PATH}/${group}/${name}.png`,
    masterPath: `${BASE_MASTER_PATH}/${group}/${name}.svg`,
  }
}

export const dungeonRunnerAssetPack = {
  cards: {
    monsterBack: assetEntry('cards', 'monster-back'),
    revealedMonster: assetEntry('cards', 'revealed-monster'),
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
}
