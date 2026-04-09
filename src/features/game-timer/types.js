/**
 * @typedef {object} GameTimerPlayer
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {number} bankedMs — all rounds combined
 * @property {Record<string, number>} [bankedMsByRound] — banked ms per round key (`"1"`, `"2"`, …)
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
