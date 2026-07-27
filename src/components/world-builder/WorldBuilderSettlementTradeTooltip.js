import { defineComponent, h, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { formatMoneyCp } from '../../../world-builder/core/economy/formatMoneyCp.js'
import { clampSettlementTradeTooltipPosition } from '../../composables/clampSettlementTradeTooltipPosition.js'
import {
  COMMODITY_ACCESSIBLE_NAMES,
  COMMODITY_ICONS,
  moneyBagIcon,
  personIcon,
  portTollsIcon,
} from './settlementTradeTooltipIcons.js'

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
    const rootRef = ref(/** @type {HTMLElement | null} */ (null))
    const placedLeft = ref(0)
    const placedTop = ref(0)

    function reposition() {
      const el = rootRef.value
      const anchorX = props.position?.x
      const anchorY = props.position?.y
      if (
        !el ||
        typeof anchorX !== 'number' ||
        typeof anchorY !== 'number' ||
        typeof window === 'undefined'
      ) {
        return
      }
      const rect = el.getBoundingClientRect()
      const placed = clampSettlementTradeTooltipPosition({
        anchorX,
        anchorY,
        width: rect.width || el.offsetWidth,
        height: rect.height || el.offsetHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      })
      placedLeft.value = placed.left
      placedTop.value = placed.top
    }

    watch(
      () => [props.tooltip, props.position?.x, props.position?.y],
      async () => {
        if (!props.tooltip || !props.position) {
          return
        }
        placedLeft.value = props.position.x
        placedTop.value = props.position.y
        await nextTick()
        reposition()
      },
      { immediate: true, flush: 'post' },
    )

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', reposition)
      onBeforeUnmount(() => {
        window.removeEventListener('resize', reposition)
      })
    }

    return () => {
      const tooltip = props.tooltip
      if (!tooltip) {
        return null
      }

      return h(
        'div',
        {
          ref: rootRef,
          'data-testid': 'world-builder-settlement-trade-tooltip',
          class: 'world-builder-settlement-trade-tooltip bg-grey-10 text-white shadow-2',
          style: {
            position: 'fixed',
            left: `${placedLeft.value}px`,
            top: `${placedTop.value}px`,
            zIndex: 20,
            pointerEvents: 'none',
            minWidth: '10rem',
            padding: '2px 4px',
            fontSize: '0.875rem',
            lineHeight: 1.2,
          },
        },
        [
          iconValueRow({
            testId: 'world-builder-settlement-trade-tooltip-population',
            accessibleName: 'Population',
            icon: personIcon(),
            valueText: formatPopulation(tooltip.population),
            valueClass: 'text-grey-5',
          }),
          iconValueRow({
            testId: 'world-builder-settlement-trade-tooltip-balance',
            accessibleName: 'Balance',
            icon: moneyBagIcon(),
            valueText: formatMoneyCp(tooltip.balanceCp),
            valueClass: signedAmountClass(tooltip.balanceCp),
          }),
          ...(typeof tooltip.portTollsCp === 'number'
            ? [
                iconValueRow({
                  testId: 'world-builder-settlement-trade-tooltip-port-tolls',
                  accessibleName: 'Port tolls',
                  icon: portTollsIcon(),
                  valueText: formatMoneyCp(tooltip.portTollsCp),
                  valueClass: signedAmountClass(tooltip.portTollsCp),
                }),
              ]
            : []),
          h(
            'div',
            {
              'data-testid': 'world-builder-settlement-trade-tooltip-commodities',
              style: {
                marginTop: '2px',
                paddingTop: '2px',
                borderTop: '1px solid rgba(255, 255, 255, 0.22)',
              },
            },
            (tooltip.commodities ?? []).map((entry) => commodityRow(entry)),
          ),
        ],
      )
    }
  },
})

/**
 * @param {{
 *   testId: string,
 *   accessibleName: string,
 *   icon: ReturnType<typeof h>,
 *   valueText: string,
 *   valueClass: string,
 * }} params
 */
function iconValueRow({ testId, accessibleName, icon, valueText, valueClass }) {
  return h(
    'div',
    {
      'data-testid': testId,
      class: 'row items-center no-wrap justify-between',
      style: { gap: '4px' },
    },
    [
      h(
        'span',
        {
          'data-testid': `${testId}-label`,
          title: accessibleName,
          class: 'row items-center',
        },
        [icon],
      ),
      h(
        'span',
        {
          'data-testid': `${testId}-value`,
          class: ['text-right', valueClass],
        },
        valueText,
      ),
    ],
  )
}

/**
 * @param {number | undefined} population
 * @returns {string}
 */
function formatPopulation(population) {
  const value =
    typeof population === 'number' && Number.isFinite(population)
      ? Math.max(0, Math.floor(population))
      : 0
  return value.toLocaleString('en-US')
}

/**
 * @param {{
 *   commodityId: string,
 *   role: string,
 *   imports: boolean,
 *   exports: boolean,
 *   localPriceCp: number,
 *   priceVsReference?: string,
 * }} entry
 */
function commodityRow(entry) {
  const iconFactory = COMMODITY_ICONS[entry.commodityId]
  const accessibleName =
    COMMODITY_ACCESSIBLE_NAMES[entry.commodityId] ?? entry.commodityId
  return h(
    'div',
    {
      key: entry.commodityId,
      'data-testid': `world-builder-settlement-trade-tooltip-commodity-${entry.commodityId}`,
      class: 'row items-center no-wrap justify-between',
      style: { gap: '4px' },
    },
    [
      h(
        'span',
        {
          'data-testid': `world-builder-settlement-trade-tooltip-commodity-${entry.commodityId}-label`,
          title: accessibleName,
          class: 'row items-center',
        },
        [iconFactory ? iconFactory() : accessibleName],
      ),
      h(
        'span',
        {
          'data-testid': `world-builder-settlement-trade-tooltip-commodity-${entry.commodityId}-direction`,
          'data-trade-role': entry.role,
          class: 'text-grey-5 text-center',
          style: { minWidth: '1.1rem' },
          'aria-hidden': 'true',
        },
        directionMark(entry),
      ),
      h(
        'span',
        {
          'data-testid': `world-builder-settlement-trade-tooltip-commodity-${entry.commodityId}-price`,
          'data-price-vs-reference': entry.priceVsReference ?? 'equal',
          class: ['text-right', priceVsReferenceClass(entry.priceVsReference)],
          style: { minWidth: '4rem' },
        },
        formatMoneyCp(entry.localPriceCp),
      ),
    ],
  )
}

/**
 * @param {number} amountCp
 * @returns {string}
 */
function signedAmountClass(amountCp) {
  if (amountCp > 0) {
    return 'text-positive'
  }
  if (amountCp < 0) {
    return 'text-negative'
  }
  return 'text-grey-5'
}

/**
 * @param {string | undefined} priceVsReference
 * @returns {string}
 */
function priceVsReferenceClass(priceVsReference) {
  if (priceVsReference === 'above') {
    return 'text-positive'
  }
  if (priceVsReference === 'below') {
    return 'text-negative'
  }
  return 'text-grey-5'
}

/**
 * @param {{ role: string, imports: boolean, exports: boolean }} entry
 * @returns {string}
 */
function directionMark(entry) {
  if (entry.role === 'both' || (entry.imports && entry.exports)) {
    return '↔'
  }
  if (entry.exports) {
    return '→'
  }
  if (entry.imports) {
    return '←'
  }
  return '–'
}
