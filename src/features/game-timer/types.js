/**
 * Game Timer JSDoc shapes. In other `.js` / `<script>` files, reference them with a file-top
 * `@import` of this module (path relative to that file). See core.js and gameTimer.js for examples.
 *
 * @see https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html
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

export {}
