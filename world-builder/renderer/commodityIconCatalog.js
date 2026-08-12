/**
 * Shared commodity icon path/color catalog for tooltip Vue nodes and map FX.
 */

import {
  mdiBarley,
  mdiDiamondStone,
  mdiFish,
  mdiGold,
  mdiPineTree,
  mdiShaker,
} from '@quasar/extras/mdi-v7'

/**
 * @typedef {Object} CommodityIconStyle
 * @property {string} path MDI SVG path data
 * @property {string} fill CSS color
 * @property {string} accessibleName
 */

/** @type {Readonly<Record<string, CommodityIconStyle>>} */
export const COMMODITY_ICON_STYLES = Object.freeze({
  grain: Object.freeze({ path: mdiBarley, fill: '#D4A84B', accessibleName: 'Grain' }),
  fish: Object.freeze({ path: mdiFish, fill: '#4A9FD4', accessibleName: 'Fish' }),
  salt: Object.freeze({ path: mdiShaker, fill: '#E8ECF0', accessibleName: 'Salt' }),
  timber: Object.freeze({ path: mdiPineTree, fill: '#6B8F3C', accessibleName: 'Timber' }),
  baseMetals: Object.freeze({ path: mdiGold, fill: '#8E9094', accessibleName: 'Base metals' }),
  copper: Object.freeze({ path: mdiGold, fill: '#B87333', accessibleName: 'Copper' }),
  silver: Object.freeze({ path: mdiGold, fill: '#C0C5CE', accessibleName: 'Silver' }),
  gold: Object.freeze({ path: mdiGold, fill: '#D4AF37', accessibleName: 'Gold' }),
  diamonds: Object.freeze({
    path: mdiDiamondStone,
    fill: '#A8D4F0',
    accessibleName: 'Diamonds',
  }),
})

/**
 * @param {string} commodityId
 * @returns {CommodityIconStyle | null}
 */
export function commodityIconStyle(commodityId) {
  return COMMODITY_ICON_STYLES[commodityId] ?? null
}
