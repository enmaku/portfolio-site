import { h } from 'vue'
import {
  mdiBarley,
  mdiDiamondStone,
  mdiFish,
  mdiGold,
  mdiPineTree,
  mdiSack,
  mdiShaker,
} from '@quasar/extras/mdi-v7'

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

export function moneyBagIcon() {
  return mdiIcon('Balance', mdiSack, '#C9A227')
}

export function wheatIcon() {
  return mdiIcon('Grain', mdiBarley, '#D4A84B')
}

export function fishIcon() {
  return mdiIcon('Fish', mdiFish, '#4A9FD4')
}

export function saltIcon() {
  return mdiIcon('Salt', mdiShaker, '#E8ECF0')
}

export function timberIcon() {
  return mdiIcon('Timber', mdiPineTree, '#6B8F3C')
}

export function baseMetalsIcon() {
  return mdiIcon('Base metals', mdiGold, '#8E9094')
}

export function copperIcon() {
  return mdiIcon('Copper', mdiGold, '#B87333')
}

export function silverIcon() {
  return mdiIcon('Silver', mdiGold, '#C0C5CE')
}

export function goldIcon() {
  return mdiIcon('Gold', mdiGold, '#D4AF37')
}

export function diamondsIcon() {
  return mdiIcon('Diamonds', mdiDiamondStone, '#A8D4F0')
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
export const COMMODITY_ACCESSIBLE_NAMES = Object.freeze({
  grain: 'Grain',
  fish: 'Fish',
  salt: 'Salt',
  timber: 'Timber',
  baseMetals: 'Base metals',
  copper: 'Copper',
  silver: 'Silver',
  gold: 'Gold',
  diamonds: 'Diamonds',
})
