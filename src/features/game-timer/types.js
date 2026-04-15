/**
 * Game Timer JSDoc shapes (players, UI rows, P2P sync payload). In other `.js` / `<script>` files, reference them with a file-top
 * `@import` of this module (path relative to that file). See core.js, protocol.js, session.js, composables/useGameTimerP2P.js, and gameTimer.js.
 *
 * @see https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html
 */

/**
 * Multiplayer UI / PeerJS session phase (`p2p/session.js`, sync control).
 *
 * @typedef {'idle' | 'connecting' | 'reconnecting' | 'hosting' | 'guest_connected'} GameTimerSessionPhase
 */

/**
 * @typedef {object} GameTimerPlayer
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {number} bankedMs All rounds combined (lifetime banked).
 * @property {Record<string, number>} [bankedMsByRound] Banked ms per round key (`"1"`, `"2"`, …).
 */

/**
 * @typedef {object} GameTimerPlayerRow
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {number} displayedMs
 * @property {number} progress
 * @property {number} displayedMsRound
 * @property {number} progressRound
 * @property {boolean} isActive
 */

/**
 * Serializable slice of the game timer Pinia store (matches `persist.pick`); identical shape on the P2P wire.
 *
 * @typedef {object} GameTimerSyncPayload
 * @property {GameTimerPlayer[]} players
 * @property {string | null} activePlayerId
 * @property {number | null} turnStartedAt
 * @property {number | null} turnStartedRound
 * @property {number} round
 * @property {Record<string, string[]>} playerOrderByRound
 * @property {boolean} hardPassEnabled
 * @property {boolean} hardPassOrderNextRound
 * @property {Record<string, string[]>} hardPassOrderByRound
 */

export {}
