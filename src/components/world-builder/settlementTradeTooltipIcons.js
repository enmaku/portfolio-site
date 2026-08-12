import { h } from 'vue'
import {
  mdiAccount,
  mdiCircleSlice1,
  mdiSack,
  mdiSale,
} from '@quasar/extras/mdi-v7'
import { COMMODITY_ICON_STYLES } from '../../../world-builder/renderer/commodityIconCatalog.js'

const ICON_SIZE = 18

/**
 * @param {string} accessibleName
 * @param {string} pathData
 * @param {string} fill
 */
function mdiIcon(accessibleName, pathData, fill) {
  return h(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      width: ICON_SIZE,
      height: ICON_SIZE,
      role: 'img',
      'aria-label': accessibleName,
      focusable: 'false',
      style: { display: 'block', flexShrink: 0 },
    },
    [h('path', { d: pathData, fill })],
  )
}

export function personIcon() {
  return mdiIcon('Population', mdiAccount, '#B0BEC5')
}

export function moneyBagIcon() {
  return mdiIcon('Balance', mdiSack, '#C9A227')
}

export function portTollsIcon() {
  return mdiIcon('Port tolls', mdiCircleSlice1, '#6BA3B8')
}

export function factionTaxIcon() {
  return mdiIcon('Faction tax', mdiSale, '#C48B5A')
}

/**
 * @param {keyof typeof COMMODITY_ICON_STYLES} commodityId
 */
function commodityIcon(commodityId) {
  const style = COMMODITY_ICON_STYLES[commodityId]
  return mdiIcon(style.accessibleName, style.path, style.fill)
}

export function wheatIcon() {
  return commodityIcon('grain')
}

export function fishIcon() {
  return commodityIcon('fish')
}

export function saltIcon() {
  return commodityIcon('salt')
}

export function timberIcon() {
  return commodityIcon('timber')
}

export function baseMetalsIcon() {
  return commodityIcon('baseMetals')
}

export function copperIcon() {
  return commodityIcon('copper')
}

export function silverIcon() {
  return commodityIcon('silver')
}

export function goldIcon() {
  return commodityIcon('gold')
}

export function diamondsIcon() {
  return commodityIcon('diamonds')
}

/** @type {Readonly<Record<string, () => ReturnType<typeof mdiIcon>>>} */
export const COMMODITY_ICONS = Object.freeze({
  grain: wheatIcon,
  fish: fishIcon,
  salt: saltIcon,
  timber: timberIcon,
  baseMetals: baseMetalsIcon,
  copper: copperIcon,
  silver: silverIcon,
  gold: goldIcon,
  diamonds: diamondsIcon,
})

/** @type {Readonly<Record<string, string>>} */
export const COMMODITY_ACCESSIBLE_NAMES = Object.freeze(
  Object.fromEntries(
    Object.entries(COMMODITY_ICON_STYLES).map(([id, style]) => [id, style.accessibleName]),
  ),
)
