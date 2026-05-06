/**
 * @param {{ isGuest: boolean }} input
 */
export function getGameTimerSettingsModel(input) {
  return {
    showRoundRules: !input.isGuest,
    showFullscreen: true,
  }
}

