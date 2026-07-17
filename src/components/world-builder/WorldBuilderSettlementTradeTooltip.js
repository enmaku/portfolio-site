import { defineComponent, h } from 'vue'
import { CP_PER_GP, CP_PER_SP } from '../../../world-builder/core/economy/commodityCatalog.js'

/** @type {Readonly<Record<string, string>>} */
const COMMODITY_LABELS = Object.freeze({
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

/**
 * Floating settlement trade inspect panel. Renders from buildSettlementTradeTooltip model.
 * Domain: world-builder/CONTEXT.md — settlement trade tooltip.
 */
export default defineComponent({
  name: 'WorldBuilderSettlementTradeTooltip',
  props: {
    tooltip: {
      type: Object,
      default: null,
    },
    position: {
      type: Object,
      default: null,
    },
  },
  setup(props) {
    return () => {
      const tooltip = props.tooltip
      if (!tooltip) {
        return null
      }
      const left = props.position?.x ?? 0
      const top = props.position?.y ?? 0

      return h(
        'div',
        {
          'data-testid': 'world-builder-settlement-trade-tooltip',
          class: 'world-builder-settlement-trade-tooltip bg-grey-10 text-white q-pa-sm shadow-2',
          style: {
            position: 'fixed',
            left: `${left}px`,
            top: `${top}px`,
            zIndex: 20,
            pointerEvents: 'none',
            minWidth: '14rem',
            fontSize: '0.8rem',
            lineHeight: '1.35',
          },
        },
        [
          labeledValueRow({
            testId: 'world-builder-settlement-trade-tooltip-balance',
            label: 'Balance',
            value: formatCp(tooltip.realmBalanceCp),
          }),
          tooltip.isPort
            ? labeledValueRow({
                testId: 'world-builder-settlement-trade-tooltip-port-credit',
                label: 'Off-map credit',
                value: formatCp(tooltip.portOffMapCreditCp ?? 0),
              })
            : null,
          h(
            'div',
            {
              'data-testid': 'world-builder-settlement-trade-tooltip-commodities',
              class: 'q-mt-xs',
            },
            (tooltip.commodities ?? []).map((entry) =>
              h(
                'div',
                {
                  key: entry.commodityId,
                  'data-testid': `world-builder-settlement-trade-tooltip-commodity-${entry.commodityId}`,
                  class: 'row items-center no-wrap justify-between q-gutter-sm',
                },
                [
                  h(
                    'span',
                    {
                      'data-testid': `world-builder-settlement-trade-tooltip-commodity-${entry.commodityId}-label`,
                      class: 'col',
                    },
                    commodityLabel(entry.commodityId),
                  ),
                  h(
                    'span',
                    {
                      'data-testid': `world-builder-settlement-trade-tooltip-commodity-${entry.commodityId}-direction`,
                      'data-trade-role': entry.role,
                      class: directionClass(entry),
                      'aria-hidden': 'true',
                    },
                    directionMark(entry),
                  ),
                  h(
                    'span',
                    {
                      'data-testid': `world-builder-settlement-trade-tooltip-commodity-${entry.commodityId}-price`,
                      class: 'text-right',
                      style: { minWidth: '4.5rem' },
                    },
                    formatCp(entry.localPriceCp),
                  ),
                ],
              ),
            ),
          ),
        ],
      )
    }
  },
})

/**
 * @param {{ testId: string, label: string, value: string }} params
 */
function labeledValueRow({ testId, label, value }) {
  return h(
    'div',
    {
      'data-testid': testId,
      class: 'row items-center no-wrap justify-between q-gutter-sm',
    },
    [
      h('span', { 'data-testid': `${testId}-label`, class: 'text-weight-medium' }, label),
      h('span', { 'data-testid': `${testId}-value` }, value),
    ],
  )
}

/**
 * @param {string} commodityId
 * @returns {string}
 */
function commodityLabel(commodityId) {
  return COMMODITY_LABELS[commodityId] ?? commodityId
}

/**
 * @param {number} amountCp
 * @returns {string}
 */
function formatCp(amountCp) {
  const value = Number.isFinite(amountCp) ? amountCp : 0
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= CP_PER_GP) {
    return `${sign}${trimTrailingZeros(abs / CP_PER_GP)} gp`
  }
  if (abs >= CP_PER_SP) {
    return `${sign}${trimTrailingZeros(abs / CP_PER_SP)} sp`
  }
  return `${sign}${trimTrailingZeros(abs)} cp`
}

/**
 * @param {number} value
 * @returns {string}
 */
function trimTrailingZeros(value) {
  return value
    .toFixed(2)
    .replace(/\.?0+$/, '')
}

/**
 * @param {{ role: string, imports: boolean, exports: boolean }} entry
 * @returns {string}
 */
function directionMark(entry) {
  if (entry.role === 'both' || (entry.imports && entry.exports)) {
    return '↕'
  }
  if (entry.exports) {
    return '↑'
  }
  if (entry.imports) {
    return '↓'
  }
  return '–'
}

/**
 * @param {{ role: string, imports: boolean, exports: boolean }} entry
 * @returns {string}
 */
function directionClass(entry) {
  if (entry.role === 'both' || (entry.imports && entry.exports)) {
    return 'text-amber'
  }
  if (entry.exports) {
    return 'text-positive'
  }
  if (entry.imports) {
    return 'text-negative'
  }
  return 'text-grey-5'
}
