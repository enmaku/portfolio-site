/**
 * Visibility model for manager-linked vs standalone Game Timer chrome.
 *
 * @param {{
 *   isManagerLinked: boolean,
 *   isGuest: boolean,
 *   canShuffle: boolean,
 *   hasPlayers: boolean,
 * }} input
 */
export function getManagerLinkedChromeModel(input) {
  const isManagerLinked = Boolean(input.isManagerLinked)
  const isGuest = Boolean(input.isGuest)
  const canShuffle = Boolean(input.canShuffle)
  const hasPlayers = Boolean(input.hasPlayers)
  const isLinkedHost = isManagerLinked && !isGuest

  return {
    showMoreOptions: isLinkedHost,
    showSettingsCog: !isLinkedHost,
    showTopBarShuffle: canShuffle && !isGuest && !isManagerLinked,
    showMoreOptionsShuffle: isLinkedHost && canShuffle,
    showTopBarNewGame: !isManagerLinked && !isGuest && hasPlayers && !canShuffle,
    hideAddClearFabs: isManagerLinked,
    showGameEnd: isLinkedHost,
  }
}
