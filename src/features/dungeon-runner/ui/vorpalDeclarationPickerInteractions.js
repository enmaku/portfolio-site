import { ACTION_TYPES } from '../engine/kernel.js'
import { createVorpalDeclarationPromptView } from './dungeonEquipmentInteractions.js'

export function applyVorpalPickerSpeciesTap({
  selectedSpecies = null,
  tappedSpecies = null,
  humanGameplayBlocked = false,
} = {}) {
  if (humanGameplayBlocked || typeof tappedSpecies !== 'string') return selectedSpecies
  if (selectedSpecies === tappedSpecies) return selectedSpecies
  return tappedSpecies
}

/**
 * @typedef {'splay' | 'above' | 'selected' | 'below-break' | 'below'} VorpalPickerCardLayoutRole
 */

/**
 * @param {Array<{ species: string, selected: boolean, selectable: boolean, memoryAidCaption: string | null }>} cards
 * @param {string | null} selectedSpecies
 */
export function annotateVorpalPickerHandCards(cards = [], selectedSpecies = null) {
  const selectedIndex = cards.findIndex((card) => card.species === selectedSpecies)
  if (selectedIndex < 0) {
    return cards.map((card) => ({
      ...card,
      layoutRole: 'splay',
    }))
  }

  return cards.map((card, index) => {
    if (index === selectedIndex) {
      return {
        ...card,
        layoutRole: 'selected',
      }
    }
    if (index > selectedIndex) {
      return {
        ...card,
        layoutRole: index === selectedIndex + 1 ? 'below-break' : 'below',
      }
    }
    return {
      ...card,
      layoutRole: 'above',
    }
  })
}

export function createVorpalDeclarationPickerView({
  isHumanTurn = false,
  gameplayInputLocked = false,
  phase = null,
  subphase = null,
  legalActions = [],
  memoryAidEnabled = false,
  viewerOwnPileAdds = [],
  selectedSpecies = null,
  humanGameplayBlocked = false,
} = {}) {
  const prompt = createVorpalDeclarationPromptView({
    isHumanTurn,
    gameplayInputLocked,
    phase,
    subphase,
    legalActions,
    memoryAidEnabled,
    viewerOwnPileAdds,
  })

  const counts = prompt.vorpalSpeciesOwnPileCounts
  const cards = prompt.speciesOptions.map((species) => {
    const ownPileCount = counts?.[species] ?? 0
    return {
      species,
      selected: selectedSpecies === species,
      selectable: !humanGameplayBlocked,
      memoryAidCaption: ownPileCount > 0 ? String(ownPileCount) : null,
    }
  })

  const handCards = annotateVorpalPickerHandCards(cards, selectedSpecies)
  const confirmEnabled = selectedSpecies != null && !humanGameplayBlocked
  const confirmAction =
    confirmEnabled && typeof selectedSpecies === 'string'
      ? { type: ACTION_TYPES.DECLARE_VORPAL, species: selectedSpecies }
      : null

  return {
    open: prompt.open,
    cards,
    handCards,
    confirmEnabled,
    confirmAction,
  }
}
