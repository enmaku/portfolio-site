/**
 * @typedef {object} StatsNumericSeriesChart
 * @property {string[]} labels
 * @property {number[]} values
 * @property {(number | null)[]} [rollingAverageValues]
 * @property {ModelPublishMarkerView[]} [modelPublishMarkers]
 */

/**
 * @typedef {object} TrendWindowBounds
 * @property {number} min
 * @property {number} max
 * @property {number} default
 */

/**
 * @typedef {object} ModelPublishMarkerView
 * @property {number} sequence
 * @property {string} modelId
 * @property {number} labelIndex
 */

/**
 * @typedef {object} HumanWinSeriesPoint
 * @property {boolean} humanWon
 * @property {unknown} [createdAt]
 */

export {}
