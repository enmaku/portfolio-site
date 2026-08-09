import { defineComponent, h, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { clampSettlementTradeTooltipPosition } from '../../composables/clampSettlementTradeTooltipPosition.js'

/**
 * Floating political map-cue tooltip (swords / handshake / sack).
 * Domain: world-builder/CONTEXT.md — Conquest, Quashed rebellion, Alliance, Trade partner.
 */
export default defineComponent({
  name: 'WorldBuilderPoliticalMarkerTooltip',
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
          'data-testid': 'world-builder-political-marker-tooltip',
          'data-cue-kind': tooltip.cueKind,
          class: 'world-builder-political-marker-tooltip bg-grey-10 text-white shadow-2',
          style: {
            position: 'fixed',
            left: `${placedLeft.value}px`,
            top: `${placedTop.value}px`,
            zIndex: 21,
            pointerEvents: 'none',
            maxWidth: '16rem',
            padding: '6px 8px',
            fontSize: '0.875rem',
            lineHeight: 1.3,
          },
        },
        [
          h(
            'div',
            {
              class: 'text-weight-medium',
              'data-testid': 'world-builder-political-marker-tooltip-title',
            },
            tooltip.title,
          ),
          h(
            'div',
            {
              class: 'text-grey-5 q-mt-xs',
              'data-testid': 'world-builder-political-marker-tooltip-body',
            },
            tooltip.body,
          ),
        ],
      )
    }
  },
})
