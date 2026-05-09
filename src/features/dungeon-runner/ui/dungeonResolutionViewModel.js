import { buildDungeonEquipmentTokenView, pickAutoResolveDungeonAction } from './dungeonEquipmentInteractions.js'

export function createDungeonResolutionViewModel({
  visibleState = {},
  previousVisibleState = {},
  legalActions = [],
  activeAnimation = null,
} = {}) {
  const dungeon = visibleState?.dungeon ?? {}
  const previousDungeon = previousVisibleState?.dungeon ?? {}
  const currentMonster = dungeon.currentMonster ?? null
  const inPlayEquipmentIds = dungeon.inPlayEquipmentIds ?? []
  const autoAdvanceAction = pickAutoResolveDungeonAction({ legalActions })
  const tokenView = buildDungeonEquipmentTokenView({ inPlayEquipmentIds, legalActions })
  const highlightedEquipmentIds = tokenView.filter((token) => token.glow).map((token) => token.equipmentId)
  const hpDelta = buildHpDelta({
    previousHp: previousDungeon.hp,
    currentHp: dungeon.hp,
    activeAnimationKind: activeAnimation?.kind ?? null,
  })

  return {
    monster: buildMonsterView({
      currentMonster,
      previousMonster: previousDungeon.currentMonster ?? null,
      activeAnimationKind: activeAnimation?.kind ?? null,
      revealPayloadMonsterId: activeAnimation?.payload?.revealedMonsterId ?? null,
      dungeon,
      previousDungeon,
    }),
    resolutionStatus: deriveResolutionStatus({
      activeAnimationKind: activeAnimation?.kind ?? null,
      highlightedEquipmentIds,
      autoAdvanceAction,
      legalActions,
    }),
    highlightedEquipmentIds,
    autoAdvanceAction,
    hpDelta,
    hpBar: buildHpBar({
      currentHp: dungeon.hp,
      startingHp: dungeon.startingHp,
    }),
  }
}

function inferSpeciesFromDungeonDelta(previousDungeon, dungeon) {
  if (!previousDungeon || !dungeon) return null
  const prevR = previousDungeon.remainingMonsters ?? []
  const nextR = dungeon.remainingMonsters ?? []
  if (prevR.length > nextR.length) return prevR[0] ?? null
  const prevD = previousDungeon.discardedRunMonsters ?? []
  const nextD = dungeon.discardedRunMonsters ?? []
  if (nextD.length > prevD.length) return nextD[nextD.length - 1] ?? null
  return null
}

function buildMonsterView({
  currentMonster,
  previousMonster,
  activeAnimationKind,
  revealPayloadMonsterId,
  dungeon,
  previousDungeon,
}) {
  const laneDeltaSpecies = inferSpeciesFromDungeonDelta(previousDungeon, dungeon)
  const engagedForAnimation =
    currentMonster ?? previousMonster ?? laneDeltaSpecies

  if (activeAnimationKind === 'DUNGEON_REVEAL') {
    return {
      visibility: 'face-down',
      species: null,
      frontFaceSpecies: currentMonster ?? revealPayloadMonsterId ?? null,
    }
  }
  if (
    (activeAnimationKind === 'DUNGEON_DAMAGE' ||
      activeAnimationKind === 'DUNGEON_NEUTRALIZE' ||
      activeAnimationKind === 'DUNGEON_CONTINUE' ||
      activeAnimationKind === 'DUNGEON_OUTCOME') &&
    engagedForAnimation
  ) {
    return {
      visibility: 'revealed',
      species: engagedForAnimation,
      frontFaceSpecies: engagedForAnimation,
    }
  }
  if (currentMonster) {
    return {
      visibility: 'revealed',
      species: currentMonster,
      frontFaceSpecies: currentMonster,
    }
  }
  return { visibility: 'empty', species: null, frontFaceSpecies: null }
}

function deriveResolutionStatus({
  activeAnimationKind,
  highlightedEquipmentIds,
  autoAdvanceAction,
  legalActions,
}) {
  if (activeAnimationKind === 'DUNGEON_REVEAL') return 'revealing'
  if (activeAnimationKind === 'DUNGEON_DAMAGE') return 'damage-taken'
  if (highlightedEquipmentIds.length > 0) return 'waiting-for-choice'
  if (hasNonDeterministicChoice(legalActions)) return 'waiting-for-choice'
  if (autoAdvanceAction) return 'auto-resolved'
  return 'auto-resolved'
}

function hasNonDeterministicChoice(legalActions = []) {
  if (legalActions.length < 2) return false
  const uniqueSignatures = new Set(legalActions.map((action) => JSON.stringify(action)))
  return uniqueSignatures.size > 1
}

function buildHpDelta({ previousHp, currentHp, activeAnimationKind }) {
  if (!Number.isFinite(previousHp) || !Number.isFinite(currentHp)) return null
  const value = currentHp - previousHp
  if (value === 0) return null
  if (value < 0 || activeAnimationKind === 'DUNGEON_DAMAGE') {
    return { value, tone: 'damage', text: `${value} HP` }
  }
  return { value, tone: 'heal', text: `+${value} HP` }
}

function buildHpBar({ currentHp, startingHp }) {
  if (!Number.isFinite(currentHp)) return null
  const baselineHp = Number.isFinite(startingHp) && startingHp > 0 ? startingHp : currentHp
  const displayMaxHp = Math.max(1, baselineHp, currentHp)
  const safeCurrentHp = Math.max(0, currentHp)
  return {
    currentHp: safeCurrentHp,
    baselineHp,
    displayMaxHp,
    percent: Math.min(100, Math.max(0, (safeCurrentHp / displayMaxHp) * 100)),
    text: `${safeCurrentHp} / ${displayMaxHp} HP`,
  }
}
