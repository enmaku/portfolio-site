/**
 * ColorBrewer qualitative Paired (12 classes). More saturated than the World Builder's
 * Set3, which keeps stacked segments and pie slices distinct on the dark surface.
 * Ordered saturated-first so a small number of series gets the strongest colors and
 * the pale half of each pair is only reached once the saturated six run out.
 *
 * Source: https://colorbrewer2.org/?type=qualitative&scheme=Paired&n=12
 */
export const STATS_CHART_COLORS = [
  '#1f78b4',
  '#33a02c',
  '#e31a1c',
  '#ff7f00',
  '#6a3d9a',
  '#b15928',
  '#a6cee3',
  '#b2df8a',
  '#fb9a99',
  '#fdbf6f',
  '#cab2d6',
  '#ffff99',
]

/**
 * Palette color for the row at `index`, after skipping the first `offset` slots so a
 * second breakdown picks up colors the first one did not use.
 *
 * @param {number} index
 * @param {number} [offset]
 */
export function statsRowColor(index, offset = 0) {
  return STATS_CHART_COLORS[(offset + index) % STATS_CHART_COLORS.length]
}

/** Segment for project ranks past the palette, in the stacked bar chart only. */
export const STATS_OTHER_COLOR = '#9e9e9e'

export const MAX_STACKED_SERIES = STATS_CHART_COLORS.length
