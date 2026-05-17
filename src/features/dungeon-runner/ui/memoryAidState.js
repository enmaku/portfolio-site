export function createMemoryAidState(overrides = {}) {
  return {
    enabled: false,
    deckSplayOpen: false,
    ...overrides,
  }
}

export function setMemoryAidEnabled(state, enabled) {
  const nextEnabled = enabled === true
  return {
    ...state,
    enabled: nextEnabled,
    deckSplayOpen: nextEnabled ? state.deckSplayOpen : false,
  }
}

export function tapDeck(state) {
  if (!state.enabled) return state
  return {
    ...state,
    deckSplayOpen: true,
  }
}

export function closeDeckSplay(state) {
  return {
    ...state,
    deckSplayOpen: false,
  }
}
